'use strict';
/* =============================================================================
 * validate_layout.js — geometric layout check on a built deck.
 *
 *   node validate_layout.js <output/index.html | output/ | deckConfig.json>
 *
 * Every slide is fully absolutely-positioned in a fixed design space and the
 * body flows inside a fixed-size safe box, so overflow/overlap is decided by
 * exact arithmetic (measure.js) — no browser needed (Playwright is an optional
 * accuracy upgrade, never a requirement). It flags overflow, sub-min fonts,
 * too-small images, over-dense/over-wide tables, nav overflow, missing images,
 * and broken page-number continuity, and writes layout_report.json.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const { getTheme, contentArea, avgCharWidth } = require('./lib/theme');
const measure = require('./lib/measure');

function loadDeck(input) {
  let p = path.resolve(input);
  const st = fs.statSync(p);
  if (st.isDirectory()) p = path.join(p, 'deckConfig.json');
  else if (p.endsWith('.html')) p = path.join(path.dirname(p), 'deckConfig.json');
  if (!fs.existsSync(p)) throw new Error('deckConfig.json not found near ' + input);
  return { deck: JSON.parse(fs.readFileSync(p, 'utf8')), deckPath: p, dir: path.dirname(p) };
}

/* top-nav: do the horizontal nav labels fit the available bar width? */
function navOverflow(theme, deck) {
  if (theme.id !== 'top-nav') {
    // left-sidebar: vertical stack must fit the sidebar nav area
    const n = deck.sections.length;
    const fs2 = theme.nav.fs(n), gap = theme.nav.gap(n);
    const itemH = Math.max(52, fs2 * 1.2 + 20);
    const need = n * itemH + (n - 1) * gap;
    const avail = theme.H - 300 - 60;
    return need > avail ? { need: Math.round(need), avail } : null;
  }
  const n = deck.sections.length;
  const fsOn = theme.nav.fsOn(n), fs2 = theme.nav.fs(n);
  const avail = theme.W - theme.navHLogoW || (theme.W - 332);
  let need = 0;
  deck.sections.forEach(s => {
    const f = fs2; // non-active width (active is larger but only one)
    need += avgCharWidth(s.title, f) * [...s.title].length + 16;
  });
  need += avgCharWidth('x', fsOn) * 2; // slack for the active (larger) item
  return need > avail ? { need: Math.round(need), avail } : null;
}

function validate(deck) {
  const theme = getTheme(deck.template);
  const issues = [];
  const perSlide = [];
  const add = (slide, type, severity, message, extra) =>
    issues.push(Object.assign({ slideId: slide && slide.id, page: slide && slide._page, slideIndex: slide && slide._index, type, severity, message }, extra || {}));

  const content = deck.slides.filter(s => s.type === 'content');
  for (const s of content) {
    const a = measure.analyze(theme, s, s.bodySize || theme.type.body[0]);
    perSlide.push({ slideId: s.id, page: s._page, layout: s.layout, bodySize: s.bodySize, textHeight: a.textHeight, textAvail: a.textAvail, fits: a.fits, imgMinSide: a.imgMinSide });

    if (a.textOverflow) add(s, 'text_overflow', 'high', `正文超出内容区 (${a.textHeight}px > ${a.textAvail}px)`, { layout: s.layout });
    if (a.tableOverflow) add(s, 'table_too_dense', 'high', '表格行数超出内容区，建议分页');
    if (a.tableTooWide) add(s, 'table_too_wide', 'medium', '表格列数过多，可能拥挤');
    if ((s.bodySize || 0) < theme.type.bodyMin) add(s, 'font_too_small', 'high', `正文字号 ${s.bodySize}px 低于阈值 ${theme.type.bodyMin}px`);
    for (const iss of a.issues) {
      if (iss.type === 'image_too_small') add(s, 'image_too_small', 'medium', `图片显示尺寸过小 (~${iss.detail}px)，建议放大或改用大图布局`, { layout: s.layout });
    }
    for (const b of (s.blocks || [])) {
      if (b.kind === 'image' && b.missing) add(s, 'image_missing', 'medium', `图片文件缺失：${b.src}`, { src: b.src });
    }
  }

  // nav fit
  const nav = navOverflow(theme, deck);
  if (nav) add(null, 'nav_overflow', 'medium', `导航栏可能溢出 (${nav.need}px > ${nav.avail}px)，建议精简章节标题`, nav);

  // page-number continuity
  const pages = content.map(s => s._page);
  let continuous = true;
  for (let i = 0; i < pages.length; i++) if (pages[i] !== i + 1) continuous = false;
  if (!continuous) add(null, 'page_discontinuous', 'high', '内容页页码不连续');

  // geometry sanity (constants): content box must sit inside the slide & below reserved zones
  const area = contentArea(theme, { type: 'content', subtitle: theme.id === 'top-nav' ? undefined : 'x' });
  const geomOk = area.x >= 0 && area.y >= 0 && area.x + area.w <= theme.W && area.y + area.h <= theme.H;
  if (!geomOk) add(null, 'geometry', 'high', '内容安全区超出页面边界（模板常量异常）');

  const high = issues.filter(i => i.severity === 'high').length;
  const medium = issues.filter(i => i.severity === 'medium').length;
  return {
    template: deck.template,
    generatedAt: new Date().toISOString(),
    slides: deck.slides.length,
    contentSlides: content.length,
    pass: high === 0 && medium === 0,
    passNoHigh: high === 0,
    counts: { high, medium, low: issues.length - high - medium },
    checks: { pageNumbersContinuous: continuous, navFits: !nav, geometryOk: geomOk },
    thresholds: { bodyMin: theme.type.bodyMin, captionMin: theme.type.captionMin, titleMin: theme.type.titleMin },
    issues,
    perSlide,
  };
}

function run(input, outDir) {
  const { deck, dir } = loadDeck(input);
  const report = validate(deck);
  const out = path.join(outDir || dir, 'layout_report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  return { report, out };
}

if (require.main === module) {
  const input = process.argv[2];
  if (!input) { console.error('usage: node validate_layout.js <index.html|dir|deckConfig.json>'); process.exit(1); }
  const { report, out } = run(input);
  console.log(`layout: ${report.pass ? '✓ PASS' : '✗ ' + report.counts.high + ' high / ' + report.counts.medium + ' medium'} (${report.contentSlides} content slides) -> ${out}`);
  for (const i of report.issues) console.log(`  [${i.severity}] ${i.type} ${i.page ? 'p' + i.page : ''} — ${i.message}`);
  if (!report.passNoHigh) process.exitCode = 3;
}

module.exports = { validate, loadDeck, run };
