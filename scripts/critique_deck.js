'use strict';
/* =============================================================================
 * critique_deck.js — Open-Design-style self-critique. READ ONLY: it never
 * changes the deck, it only finds problems and recommends repairs.
 *
 *   node critique_deck.js <output/index.html | output/ | deckConfig.json>
 *
 * Checks: PKU_DESIGN adherence + template drift (forbidden gradients/shadows/
 * 3D/emoji/over-rounded cards), heading hierarchy, nav correctness, body
 * readability, image/text balance, image-caption binding, bold-emphasis
 * rendering, overflow/overlap (via validate_layout), and page-number
 * continuity. Writes critique_report.json.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const { getTheme } = require('./lib/theme');
const { hasBold } = require('./lib/markdown');
const { validate, loadDeck } = require('./validate_layout');

const FORBIDDEN = [
  { re: /linear-gradient|radial-gradient|conic-gradient/i, type: 'gradient', msg: '检测到渐变，PKU 学术风格应使用纯色' },
  { re: /box-shadow\s*:(?!\s*none)/i, type: 'shadow', msg: '检测到阴影，应保持扁平克制' },
  { re: /text-shadow\s*:(?!\s*none)/i, type: 'text_shadow', msg: '检测到文字阴影' },
  { re: /perspective\(|rotate3d|rotatex|rotatey|translateZ/i, type: '3d', msg: '检测到 3D 变换' },
  { re: /<svg[^>]*>[\s\S]*<animate/i, type: 'animation', msg: '检测到 SVG 动画' },
];
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F900}-\u{1F9FF}⭐✨]/u;

/* the slide content lives between <div id="deck"> ... </div></div> (the two
 * closing divs belong to #deck and #stage). The on-screen control bar (#nav)
 * and the print @media block sit OUTSIDE that, so scanning this region only
 * inspects actual slide chrome + body, not the viewer UI. */
function deckRegion(html) {
  const m = html.match(/<div id="deck"[^>]*>/);
  const a = m ? m.index : -1;
  const b = html.lastIndexOf('</div></div>');
  return a >= 0 && b > a ? html.slice(a, b) : html;
}

function critique(deck, html) {
  const theme = getTheme(deck.template);
  const issues = [];
  const repairs = [];
  const sid = s => (s && s.type === 'content') ? s._page : (s ? s._index + 1 : null);
  const add = (s, severity, type, message, suggested_fix) =>
    issues.push({ slide: sid(s), slideId: s && s.id, severity, type, message, suggested_fix });

  // ---- 1. fold in layout validation ----
  const layout = validate(deck);
  for (const i of layout.issues) {
    const s = deck.slides.find(x => x.id === i.slideId) || null;
    const fix = ({ text_overflow: 'split_text', table_too_dense: 'split_table', table_too_wide: 'split_table',
      image_too_small: 'enlarge_image', font_too_small: 'split_text', image_missing: 'replace_image',
      nav_overflow: 'shrink_nav', page_discontinuous: 'renumber' })[i.type];
    add(s, i.severity, i.type, i.message, fix);
    if (fix && s) repairs.push({ slide: sid(s), slideId: s.id, action: fix });
  }

  // ---- 2. style / template drift (forbidden visual tropes) ----
  let templateDrift = false;
  const region = deckRegion(html || '');
  for (const f of FORBIDDEN) {
    if (f.re.test(region)) { templateDrift = true; add(null, 'medium', 'template_drift', f.msg, 'remove_decoration'); }
  }
  // emoji in slide text
  if (EMOJI.test(region.replace(/<[^>]+>/g, ''))) add(null, 'low', 'emoji', '幻灯片文本中出现 emoji，学术风格不建议使用', 'remove_emoji');
  // brand tokens present
  const styleMatch = /--pku-red/.test(html || '') && /(Microsoft YaHei|微软雅黑)/.test(html || '');
  if (!styleMatch) add(null, 'medium', 'style_match', '缺少 PKU 红主色或中文字体声明', 'restore_theme');

  // ---- 3. structure / content fidelity ----
  const content = deck.slides.filter(s => s.type === 'content');
  for (const s of content) {
    if (!s.heading || !s.heading.trim()) add(s, 'low', 'missing_heading', '该页缺少小标题', null);
    if (!deck.sections.find(sec => sec.id === s.sectionId)) add(s, 'high', 'orphan_section', '该页引用了不存在的章节', null);
    // bold emphasis rendered?
    const srcHasBold = (s.blocks || []).some(b => (b.kind === 'paragraph' && hasBold(b.text)) || (b.kind === 'list' && b.items.some(hasBold)));
    // images without caption (binding present but caption missing)
    for (const b of (s.blocks || [])) {
      if (b.kind === 'image' && (!b.caption || !b.caption.trim())) add(s, 'low', 'caption_missing', `图片「${b.alt || b.src}」缺少图注`, 'add_caption');
    }
    void srcHasBold;
  }
  // literal **bold** that failed to render anywhere
  if (/\*\*[^*]+\*\*/.test(region)) add(null, 'medium', 'bold_not_rendered', '检测到未渲染的 **加粗** 标记', 're-render');

  // ---- score ----
  const w = { high: 14, medium: 6, low: 2 };
  let score = 100;
  for (const i of issues) score -= (w[i.severity] || 2);
  score = Math.max(0, Math.min(100, score));

  // dedupe repairs
  const seen = new Set();
  const recommended_repairs = repairs.filter(r => { const k = r.slideId + ':' + r.action; if (seen.has(k)) return false; seen.add(k); return true; });

  return {
    template: deck.template,
    generatedAt: new Date().toISOString(),
    overall_score: score,
    style_match: styleMatch,
    template_drift: templateDrift,
    summary: { slides: deck.slides.length, contentSlides: content.length, issues: issues.length, high: issues.filter(i => i.severity === 'high').length, medium: issues.filter(i => i.severity === 'medium').length },
    issues,
    recommended_repairs,
  };
}

function run(input, outDir) {
  const { deck, dir } = loadDeck(input);
  const idx = path.join(dir, 'index.html');
  const html = fs.existsSync(idx) ? fs.readFileSync(idx, 'utf8') : '';
  const report = critique(deck, html);
  const out = path.join(outDir || dir, 'critique_report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  return { report, out };
}

if (require.main === module) {
  const input = process.argv[2];
  if (!input) { console.error('usage: node critique_deck.js <index.html|dir|deckConfig.json>'); process.exit(1); }
  const { report, out } = run(input);
  console.log(`critique: score ${report.overall_score}/100  style_match=${report.style_match}  drift=${report.template_drift} -> ${out}`);
  for (const i of report.issues) console.log(`  [${i.severity}] ${i.type} ${i.slide ? 'slide ' + i.slide : ''} — ${i.message}`);
}

module.exports = { critique, run };
