'use strict';
/* =============================================================================
 * apply_revision.js — turn a revision request into surgical edits + history.
 *
 *   node apply_revision.js <output/ | deckConfig.json> <revision.md|.yaml>
 *   node apply_revision.js <output/> --text "第5页图片放大；所有加粗用北大红"
 *
 * Accepts natural-language Markdown bullets AND structured YAML (`revision:`).
 * It locates targets precisely, applies only what was asked, then ALWAYS
 * re-renders, re-validates, auto-repairs anything that overflowed, re-critiques,
 * re-exports the PDF (unless --no-pdf), appends to revision_history.json and
 * writes revision_report.json with a real change summary.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const yaml = require('./lib/yaml');
const { loadDeck, validate } = require('./validate_layout');
const { applyOps } = require('./revision_engine');
const { autoRepair } = require('./auto_repair');
const { renderDeck } = require('./build_deck');
const critiqueMod = require('./critique_deck');

const IMG_RE = /([^\s，。、）)]+\.(?:png|jpe?g|svg|webp|gif))/i;

function parseTarget(str) {
  const s = String(str || '').trim();
  if (/^global$|全局|所有/.test(s)) return { global: true };
  let m;
  if ((m = s.match(/slide\s*(\d+)/i)) || (m = s.match(/第\s*(\d+)\s*页/)) || (m = s.match(/\bp(\d+)\b/i))) return { page: +m[1] };
  if ((m = s.match(/figure\s*(\d+)/i)) || (m = s.match(/图\s*(\d+)/))) return { figure: +m[1] };
  if ((m = s.match(/section\s*(.+)/i)) || (m = s.match(/章节\s*(.+)/))) return { sectionTitle: m[1].trim() };
  return { raw: s };
}

/* one natural-language line -> an op (or null) */
function parseNL(line) {
  const t = line.trim();
  if (!t) return null;
  const target = parseTarget(t);
  const page = target.page;
  const figure = target.figure;

  // constraints handled by caller; skip pure-constraint lines here
  if (/(保持模板不变|不更换模板|不要换模板|keep\s*template)/i.test(t) && !/(放大|拆|换成|删除|改成|加粗)/.test(t)) return { action: '_constraint', keepTemplate: true };
  if (/(只(修复|改|优化)?(排版|布局)|不要动内容|不改文案|only\s*layout|修复溢出|修复重叠|reflow)/i.test(t)) return { action: 'reflow' };

  if (/(放大|变大|大一?点|enlarge|larger)/i.test(t)) { const m = t.match(/(\d+)\s*%/); return { action: 'enlarge_image', target: page ? { page } : { figure }, amount: m ? m[1] + '%' : undefined }; }
  if (/(拆|分成|split)/i.test(t)) {
    const heads = [...t.matchAll(/[「"“']([^」"”']+)[」"”']/g)].map(x => x[1]);
    if (/(表格?|table)/i.test(t)) return { action: 'split_table', target: { page } };
    return { action: 'split_text', target: { page }, headings: heads.length ? heads : undefined };
  }
  if (/(换成|改成).*(上文下图|下图|text-image-bottom)/i.test(t)) return { action: 'change_layout', target: { page }, to: 'text-image-bottom' };
  if (/(换成|改成).*(左文右图|右图|text-image-right)/i.test(t)) return { action: 'change_layout', target: { page }, to: 'text-image-right' };
  if (/(换成|改成).*(左图右文|image-text-right)/i.test(t)) return { action: 'change_layout', target: { page }, to: 'image-text-right' };
  if (/(独立大图|整页大图|image-full)/i.test(t)) return { action: 'change_layout', target: { page }, to: 'image-full' };
  if (/(加粗).*(北大红|红色|pku\s*red)/i.test(t)) return { action: 'emphasize_bold', style: 'pku-red' };
  if (/(加粗).*(深色|黑色|dark)/i.test(t)) return { action: 'emphasize_bold', style: 'dark' };
  if (/(删除|去掉|delete|remove).*(第\s*\d+\s*页|slide)/i.test(t)) return { action: 'delete_slide', target: { page } };
  if (/(换成|替换|replace).*(图|image|\.png|\.jpg|\.svg)/i.test(t)) { const m = t.match(IMG_RE); return { action: 'replace_image', target: figure ? { figure } : { page }, with: m ? m[1] : undefined }; }
  if (/(改成|改为|重命名|改名).*(章节|导航|这一?章)/.test(t) || /(章节|导航).*(改成|改为)/.test(t)) {
    const m = t.match(/[「"“']([^」"”']+)[」"”']/g);
    const to = m && m.length ? m[m.length - 1].replace(/[「"“'」"”']/g, '') : (t.match(/(?:改成|改为)\s*(.+)$/) || [])[1];
    const secName = m && m.length > 1 ? m[0].replace(/[「"“'」"”']/g, '') : (t.match(/把?\s*(.+?)\s*(?:这一?章|章节|的导航)/) || [])[1];
    return { action: 'rename_section', target: { sectionTitle: secName }, to };
  }
  if (/(换|改).*(模板|上方栏|左侧栏|template)/i.test(t)) { const to = /上方栏|top/.test(t) ? 'top-nav' : 'left-sidebar'; return { action: 'set_template', to }; }
  return null;
}

function parseRequest(text) {
  const ops = [];
  const constraints = { keepTemplate: false, onlyLayout: false };
  // structured YAML?
  let y = null; try { y = yaml.parse(text); } catch { y = null; }
  if (y && Array.isArray(y.revision)) {
    for (const it of y.revision) {
      if (!it || !it.action) continue;
      if (it.action === 'keep_template') { constraints.keepTemplate = true; continue; }
      ops.push({
        action: it.action, target: parseTarget(it.target), to: it.to || it.layout, style: it.style,
        with: it.with || it.src, headings: it.headings, english: it.english, amount: it.amount,
      });
    }
    if (y.keep_template) constraints.keepTemplate = true;
    if (y.only_layout) constraints.onlyLayout = true;
    return { ops, constraints };
  }
  // natural-language Markdown bullets / lines
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*+]|\d+[.)])\s*/, '').trim();
    if (!line || /^#/.test(line)) continue;
    if (/(保持模板不变|不更换模板|不要换模板|keep\s*template)/i.test(line)) constraints.keepTemplate = true;
    if (/(只(修复|改|优化)?(排版|布局)|不要动内容|不改文案|only\s*layout)/i.test(line)) constraints.onlyLayout = true;
    const op = parseNL(line);
    if (op && op.action !== '_constraint') ops.push(op);
    if (op && op.keepTemplate) constraints.keepTemplate = true;
  }
  return { ops, constraints };
}

function summarize(rep) { return { slides: rep.slides, high: rep.counts.high, medium: rep.counts.medium, pass: rep.pass }; }

function run(deckInput, requestText, opts = {}) {
  const { deck, dir } = loadDeck(deckInput);
  const before = validate(deck);
  const { ops, constraints } = parseRequest(requestText);
  const baseDir = opts.baseDir || dir;

  const { changes } = applyOps(deck, ops.filter(o => o.action !== 'reflow'), { baseDir, keepTemplate: constraints.keepTemplate });

  // auto-repair if asked to reflow, or if the revision left any overflow/overlap
  const wantsReflow = ops.some(o => o.action === 'reflow') || constraints.onlyLayout;
  const mid = validate(deck);
  let autoRepairApplied = false;
  if (wantsReflow || !mid.passNoHigh) {
    const r = autoRepair(deck, { max: 3 });
    autoRepairApplied = r.log.length > 0;
  }

  // re-emit everything
  renderDeck(deck, dir);
  const layout = validate(deck);
  fs.writeFileSync(path.join(dir, 'layout_report.json'), JSON.stringify(layout, null, 2));
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const crit = critiqueMod.critique(deck, html);
  fs.writeFileSync(path.join(dir, 'critique_report.json'), JSON.stringify(crit, null, 2));

  // history + report
  const histPath = path.join(dir, 'revision_history.json');
  const history = fs.existsSync(histPath) ? JSON.parse(fs.readFileSync(histPath, 'utf8')) : [];
  const affected = [...new Set(changes.flatMap(c => c.affected))];
  const entry = {
    revision_id: `rev-${history.length + 1}`,
    revision_time: new Date().toISOString(),
    user_request: requestText,
    ops, constraints, changes,
    affected_slides: affected,
    changed_files: ['index.html', 'deckConfig.json', 'slides.json', 'layout_report.json', 'critique_report.json'],
    before_summary: summarize(before),
    after_summary: summarize(layout),
    validation_result: { pass: layout.pass, passNoHigh: layout.passNoHigh, high: layout.counts.high, medium: layout.counts.medium },
    critique_result: { score: crit.overall_score, style_match: crit.style_match, template_drift: crit.template_drift },
    auto_repair_applied: autoRepairApplied,
  };
  history.push(entry);
  fs.writeFileSync(histPath, JSON.stringify(history, null, 2));
  fs.writeFileSync(path.join(dir, 'revision_report.json'), JSON.stringify(entry, null, 2));
  return { dir, entry, ops, constraints, deck };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const noPdf = args.includes('--no-pdf');
  const ti = args.indexOf('--text');
  const positional = args.filter((a, i) => !a.startsWith('--') && !(ti >= 0 && i === ti + 1));
  const deckInput = positional[0];
  let requestText;
  if (ti >= 0) requestText = args[ti + 1];
  else if (positional[1]) requestText = fs.readFileSync(positional[1], 'utf8');
  if (!deckInput || !requestText) { console.error('usage: node apply_revision.js <dir|deckConfig.json> <revision.md|.yaml | --text "...">  [--no-pdf]'); process.exit(1); }
  const baseDir = (ti < 0 && positional[1]) ? path.dirname(path.resolve(positional[1])) : undefined;
  const { entry } = run(deckInput, requestText, { baseDir });
  console.log(`✓ ${entry.revision_id}: ${entry.changes.filter(c => c.ok).length}/${entry.changes.length} ops applied; pages ${entry.before_summary.slides}->${entry.after_summary.slides}; layout ${entry.validation_result.passNoHigh ? 'PASS' : 'ISSUES'}; critique ${entry.critique_result.score}/100; auto_repair=${entry.auto_repair_applied}`);
  for (const c of entry.changes) console.log(`  • ${c.action}: ${c.ok ? '✓' : '✗'} ${c.note}`);
  if (!noPdf) { try { require('./export_pdf').exportPdf(entry.dir).then(r => r.ok && console.log('  PDF: ' + r.pdf)); } catch (e) { } }
}

module.exports = { run, parseRequest, parseNL, parseTarget };
