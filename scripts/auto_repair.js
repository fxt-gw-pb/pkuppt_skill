'use strict';
/* =============================================================================
 * auto_repair.js — read layout/critique findings and FIX them, surgically.
 *
 *   node auto_repair.js <output/ | deckConfig.json> [--max 3]
 *
 * Principles (from the brief): fix locally, never rewrite the whole deck;
 * adjust layout before shrinking fonts; never go below the min font; split
 * when content can't fit; never edit the author's words; never reorder
 * sections; never introduce a new style. After each pass it re-validates, and
 * it loops until clean or the iteration cap is hit. Writes repair_report.json
 * and re-emits index.html / deckConfig.json / layout_report / critique_report.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const { getTheme, contentArea } = require('./lib/theme');
const measure = require('./lib/measure');
const { splitPage } = require('./layout_engine');
const { validate, loadDeck } = require('./validate_layout');
const { renderDeck } = require('./build_deck');
const critiqueMod = require('./critique_deck');

let _uid = 0;
const uid = () => `content-r${Date.now().toString(36)}-${++_uid}`;

function pageToSlides(theme, sectionId, page) {
  return splitPage(theme, page).map(bucket => {
    const s = { id: uid(), type: 'content', sectionId, heading: bucket.heading, layout: bucket.layout, blocks: bucket.blocks, subtitle: page.subtitle, _splitIndex: bucket._splitIndex, _splitTotal: bucket._splitTotal };
    const pick = measure.pickBodySize(theme, s);
    s.bodySize = pick.size; s._fits = pick.fitsAtMin;
    return s;
  });
}

function splitTable(theme, slide) {
  const table = (slide.blocks || []).find(b => b.kind === 'table');
  if (!table) return [slide];
  const area = contentArea(theme, slide);
  const rowH = (slide.bodySize || theme.type.bodyMin) * 2.2;
  const perPage = Math.max(2, Math.floor(area.h / rowH) - 1);
  if (table.rows.length <= perPage) return [slide];
  const base = (slide.heading || '').replace(/（续\d*）\s*$/, '');
  const hadCont = base !== (slide.heading || '');
  const out = [];
  for (let i = 0, part = 0; i < table.rows.length; i += perPage, part++) {
    const rows = table.rows.slice(i, i + perPage);
    const n = (hadCont ? 1 : 0) + part; // continuation index across the section
    const heading = part === 0 ? slide.heading : `${base}（续${n === 1 ? '' : n}）`;
    const s = { id: uid(), type: 'content', sectionId: slide.sectionId, heading, layout: 'table', subtitle: slide.subtitle, blocks: [{ kind: 'table', headers: table.headers, rows }] };
    s.bodySize = measure.pickBodySize(theme, s).size;
    out.push(s);
  }
  return out;
}

/* one repair pass: returns {slides, actions} */
function repairPass(deck, report) {
  const theme = getTheme(deck.template);
  const byId = new Map();
  for (const iss of report.issues) {
    if (!iss.slideId) continue;
    if (!byId.has(iss.slideId)) byId.set(iss.slideId, new Set());
    byId.get(iss.slideId).add(iss.type);
  }
  const actions = [];
  const out = [];
  for (const slide of deck.slides) {
    if (slide.type !== 'content' || !byId.has(slide.id)) { out.push(slide); continue; }
    const types = byId.get(slide.id);

    // 1) image too small -> bigger-image layout (no font shrink, no text loss)
    if (types.has('image_too_small')) {
      const imgs = (slide.blocks || []).filter(b => b.kind === 'image').length;
      const before = slide.layout;
      if (slide.layout === 'text-image-right' || slide.layout === 'image-text-right') slide.layout = 'text-image-bottom';
      else if (slide.layout === 'image-grid' && imgs > 2) slide.layout = 'image-grid'; // will be page-split below
      if (slide.layout !== before) { slide.bodySize = measure.pickBodySize(theme, slide).size; actions.push({ slide: slide._page, action: 'enlarge_image', detail: `${before} -> ${slide.layout}` }); }
    }

    // 2) table too dense -> split into continuation table pages
    if (types.has('table_too_dense')) {
      const parts = splitTable(theme, slide);
      if (parts.length > 1) { actions.push({ slide: slide._page, action: 'split_table', detail: `${parts.length} 页` }); out.push(...parts); continue; }
    }

    // 3) text overflow / sub-min font -> re-split into ordered continuation pages
    if (types.has('text_overflow') || types.has('font_too_small')) {
      const parts = pageToSlides(theme, slide.sectionId, { heading: slide.heading, blocks: slide.blocks, layout: null, subtitle: slide.subtitle });
      if (parts.length > 1 || parts[0].bodySize > (slide.bodySize || 0)) {
        actions.push({ slide: slide._page, action: parts.length > 1 ? 'split_text' : 'resize_font', detail: `${parts.length} 页` });
        out.push(...parts); continue;
      }
    }
    out.push(slide);
  }
  return { slides: out, actions };
}

function renumber(deck) {
  let pageNo = 0;
  deck.slides.forEach((s, i) => { s._index = i; if (s.type === 'content') s._page = ++pageNo; else delete s._page; });
}

function autoRepair(deck, opts = {}) {
  const maxPasses = opts.max || 3;
  const log = [];
  const before = validate(deck);
  for (let pass = 0; pass < maxPasses; pass++) {
    const report = validate(deck);
    const actionable = report.issues.filter(i => ['text_overflow', 'font_too_small', 'table_too_dense', 'image_too_small'].includes(i.type) && i.slideId);
    if (!actionable.length) break;
    const { slides, actions } = repairPass(deck, report);
    if (!actions.length) break;
    deck.slides = slides;
    renumber(deck);
    log.push({ pass: pass + 1, actions });
  }
  return { deck, log, before, after: validate(deck) };
}

function run(input, opts = {}) {
  const { deck, dir } = loadDeck(input);
  const res = autoRepair(deck, opts);
  // re-emit artifacts
  renderDeck(res.deck, dir);
  const layout = validate(res.deck);
  fs.writeFileSync(path.join(dir, 'layout_report.json'), JSON.stringify(layout, null, 2));
  const idx = path.join(dir, 'index.html');
  const html = fs.existsSync(idx) ? fs.readFileSync(idx, 'utf8') : '';
  const crit = critiqueMod.critique(res.deck, html);
  fs.writeFileSync(path.join(dir, 'critique_report.json'), JSON.stringify(crit, null, 2));
  const repairReport = {
    generatedAt: new Date().toISOString(),
    template: res.deck.template,
    passes: res.log.length,
    actions: res.log.flatMap(l => l.actions),
    before: { high: res.before.counts.high, medium: res.before.counts.medium, slides: res.before.slides },
    after: { high: res.after.counts.high, medium: res.after.counts.medium, slides: res.deck.slides.length },
    pass: layout.passNoHigh,
  };
  fs.writeFileSync(path.join(dir, 'repair_report.json'), JSON.stringify(repairReport, null, 2));
  return { dir, repairReport, layout, crit };
}

if (require.main === module) {
  const input = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
  const mi = process.argv.indexOf('--max');
  const max = mi >= 0 ? parseInt(process.argv[mi + 1], 10) : 3;
  if (!input) { console.error('usage: node auto_repair.js <dir|deckConfig.json> [--max N]'); process.exit(1); }
  const { repairReport } = run(input, { max });
  console.log(`auto-repair: ${repairReport.passes} pass(es), ${repairReport.actions.length} action(s); high ${repairReport.before.high}->${repairReport.after.high}, slides ${repairReport.before.slides}->${repairReport.after.slides}`);
  for (const a of repairReport.actions) console.log(`  • slide ${a.slide}: ${a.action} (${a.detail || ''})`);
}

module.exports = { autoRepair, run, splitTable, pageToSlides };
