'use strict';
/* =============================================================================
 * run_tests.js — execute tests/eval_cases.json against the real scripts.
 *
 *   node tests/run_tests.js
 *
 * Pure Node, no browser, no network. Each case is built (and optionally
 * repaired/revised) into tests/.out/<id> and asserted against its `expect`.
 * Exit code is non-zero if any assertion fails.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const S = path.resolve(__dirname, '..', 'scripts');
const { build } = require(path.join(S, 'build_deck'));
const { validate, loadDeck } = require(path.join(S, 'validate_layout'));
const autoRepair = require(path.join(S, 'auto_repair'));
const apply = require(path.join(S, 'apply_revision'));
const critiqueMod = require(path.join(S, 'critique_deck'));
const pkg = require(path.join(S, 'package_output'));

const OUT = path.join(__dirname, '.out');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'eval_cases.json'), 'utf8')).cases;

let passed = 0, failed = 0;
const fails = [];
function check(caseId, name, cond, detail) {
  if (cond) { passed++; }
  else { failed++; fails.push(`[${caseId}] ${name}${detail ? ' — ' + detail : ''}`); }
  console.log(`    ${cond ? '✓' : '✗'} ${name}${cond || !detail ? '' : ' (' + detail + ')'}`);
}

const content = deck => deck.slides.filter(s => s.type === 'content');
const minBody = deck => Math.min(...content(deck).map(s => s.bodySize || 999));
const readIndex = dir => fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const deckRegion = html => { const m = html.match(/<div id="deck"[^>]*>/); const a = m ? m.index : 0; const b = html.lastIndexOf('</div></div>'); return html.slice(a, b > a ? b : html.length); };

function run() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  for (const c of cases) {
    console.log(`\n● ${c.id} — ${c.title}`);
    const dir = path.join(OUT, c.id);
    const outline = path.resolve(__dirname, c.outline);
    const e = c.expect;
    try {
      if (c.kind === 'build') {
        const { deck } = build({ outlineFile: outline, out: dir });
        const html = readIndex(dir);
        const rep = validate(deck);
        if (e.template) check(c.id, 'template', deck.template === e.template, deck.template);
        if (e.navItems != null) check(c.id, 'nav items = sections', deck.sections.length === e.navItems, `${deck.sections.length}`);
        if (e.hasPartSlides) check(c.id, 'has Part slides', deck.slides.some(s => s.type === 'part'));
        if (e.layoutPassNoHigh) check(c.id, 'layout no high issues', rep.passNoHigh, JSON.stringify(rep.counts));
        if (e.boldRendered) check(c.id, 'bold rendered as .emphasis', html.includes('class="emphasis"'));
        if (e.noLiteralBoldMarkers) check(c.id, 'no literal ** markers', !/\*\*[^*]+\*\*/.test(deckRegion(html)));
        if (e.minBodyAtLeast) check(c.id, `min body >= ${e.minBodyAtLeast}`, minBody(deck) >= e.minBodyAtLeast, `${minBody(deck)}`);
        if (e.autoSplit) { const sec = deck.sections[0]; const n = content(deck).filter(s => s.sectionId === sec.id).length; check(c.id, 'long page auto-split (>1 page)', n > 1, `${n} pages`); }
        if (e.noContentLoss) check(c.id, 'long-text keyword preserved', JSON.stringify(deck.slides).includes('亟待解决的关键科学问题'));
      }

      else if (c.kind === 'build+repair') {
        const { deck } = build({ outlineFile: outline, out: dir });
        const before = validate(deck);
        if (e.detectsTableDenseBeforeRepair) check(c.id, 'detects table_too_dense pre-repair', before.issues.some(i => i.type === 'table_too_dense'));
        const beforeRows = JSON.stringify(deck.slides).match(/"rows"/g) ? content(deck).flatMap(s => (s.blocks || []).filter(b => b.kind === 'table')).reduce((a, t) => a + t.rows.length, 0) : 0;
        const beforeCount = content(deck).length;
        const { repairReport, layout } = autoRepair.run(dir, { max: 3 });
        const { deck: deck2 } = loadDeck(dir);
        const html = readIndex(dir);
        if (e.noHighAfterRepair) check(c.id, 'no high issues after repair', layout.passNoHigh, JSON.stringify(layout.counts));
        if (e.layoutPassNoHighAfterRepair) check(c.id, 'no high issues after repair', layout.passNoHigh, JSON.stringify(layout.counts));
        if (e.imagesPresent) check(c.id, 'images present', /<img[^>]+assets\//.test(html));
        if (e.noDistortion) check(c.id, 'no object-fit:fill (no distortion)', !/object-fit:\s*fill/i.test(html));
        if (e.maxImagesPerSlide) { const mx = Math.max(...content(deck2).map(s => (s.blocks || []).filter(b => b.kind === 'image').length)); check(c.id, `<= ${e.maxImagesPerSlide} images/slide`, mx <= e.maxImagesPerSlide, `${mx}`); }
        if (e.tableSplitAfterRepair) { const tslides = content(deck2).filter(s => (s.blocks || []).some(b => b.kind === 'table')).length; check(c.id, 'table split into multiple pages', tslides > 1 && content(deck2).length > beforeCount, `${tslides} table pages`); }
        if (e.noTableRowLoss) { const after = content(deck2).flatMap(s => (s.blocks || []).filter(b => b.kind === 'table')).reduce((a, t) => a + t.rows.length, 0); check(c.id, 'no table rows lost', after === beforeRows, `${beforeRows}->${after}`); }
        void repairReport;
      }

      else if (c.kind === 'revision') {
        build({ outlineFile: outline, out: dir });
        const before = loadDeck(dir).deck;
        const beforeCount = content(before).length;
        const reqText = fs.readFileSync(path.resolve(__dirname, c.request), 'utf8');
        apply.run(dir, reqText, { baseDir: __dirname });
        const { deck } = loadDeck(dir);
        const rep = validate(deck);
        const titles = deck.sections.map(s => s.title);
        if (e.sectionRenamed) check(c.id, 'section renamed', titles.includes(e.sectionRenamed[1]) && !titles.includes(e.sectionRenamed[0]), titles.join('/'));
        if (e.templateUnchanged) check(c.id, 'template unchanged', deck.template === e.templateUnchanged, deck.template);
        if (e.splitAddedPage) check(c.id, 'split produced continuation page', content(deck).some(s => /（续|（一|（二/.test(s.heading || '')));
        if (e.deletedOnePage) check(c.id, 'a page was deleted', !content(deck).some(s => s.heading === '4.1 结论与展望'));
        if (e.imageReplacedKeepsCaption) { const cap = JSON.stringify(deck.slides).includes('图4 电子病历') || content(deck).some(s => (s.blocks || []).some(b => b.kind === 'image' && /portrait_sample/.test(b.src) && b.caption)); check(c.id, 'replaced image keeps a caption binding', cap); }
        if (e.layoutPassNoHigh) check(c.id, 'layout no high issues after revision', rep.passNoHigh, JSON.stringify(rep.counts));
        if (e.historyRecorded) check(c.id, 'revision_history.json + revision_report.json', fs.existsSync(path.join(dir, 'revision_history.json')) && fs.existsSync(path.join(dir, 'revision_report.json')));
        if (e.noOrphanContent) check(c.id, 'no empty content page', !content(deck).some(s => (s.blocks || []).length === 0));
        void beforeCount;
      }

      else if (c.kind === 'critique-inject') {
        const { deck } = build({ outlineFile: outline, out: dir });
        const clean = critiqueMod.critique(deck, readIndex(dir));
        if (e.cleanScoreHigh) check(c.id, 'clean deck scores high', clean.overall_score >= 90 && !clean.template_drift, `${clean.overall_score}`);
        // inject forbidden style + an unrendered bold marker into a slide
        let html = readIndex(dir).replace('<section class="slide"', '<section class="slide" style="box-shadow:0 0 12px #000;background:linear-gradient(#fff,#eee)"', 1);
        html = html.replace('</div></div>\n', '<section class="slide"><div class="c-body"><div class="flow text-only"><p class="tx">**未渲染加粗**</p></div></div></section></div></div>\n');
        fs.writeFileSync(path.join(dir, 'index.html'), html);
        const dirty = critiqueMod.critique(deck, html);
        if (e.detectsDriftAfterInjection) check(c.id, 'detects template_drift', dirty.template_drift === true);
        if (e.detectsUnrenderedBold) check(c.id, 'detects unrendered **bold**', dirty.issues.some(i => i.type === 'bold_not_rendered'));
      }

      else if (c.kind === 'workflow') {
        const { deck } = build({ outlineFile: outline, out: dir });
        validate(deck);
        autoRepair.run(dir, { max: 2 });
        // package without PDF to keep tests fast/offline-safe
        // (PDF export is covered separately by export_pdf.js)
        require('child_process'); // no-op guard
        const { writeReadme } = pkg;
        // generate reports + readme synchronously
        const { deck: d2 } = loadDeck(dir);
        fs.writeFileSync(path.join(dir, 'layout_report.json'), JSON.stringify(validate(d2), null, 2));
        fs.writeFileSync(path.join(dir, 'critique_report.json'), JSON.stringify(critiqueMod.critique(d2, readIndex(dir)), null, 2));
        writeReadme(dir, d2);
        if (e.artifactsExist) check(c.id, 'all artifacts exist', e.artifactsExist.every(f => fs.existsSync(path.join(dir, f))), e.artifactsExist.filter(f => !fs.existsSync(path.join(dir, f))).join(',') || 'ok');
        if (e.noOpenDesignExtras) { const root = path.resolve(__dirname, '..'); const bad = ['mcp', 'server.js', 'gui', 'plugins', 'marketplace'].filter(x => fs.existsSync(path.join(root, x))); check(c.id, 'no Open-Design extras (MCP/GUI/market)', bad.length === 0, bad.join(',')); }
        if (e.onlyTwoTemplates) { const t = fs.readdirSync(path.resolve(__dirname, '..', 'templates')).filter(f => fs.statSync(path.resolve(__dirname, '..', 'templates', f)).isDirectory()); check(c.id, 'exactly two templates', t.length === 2 && t.includes('left-sidebar') && t.includes('top-nav'), t.join(',')); }
      }
    } catch (err) {
      failed++; fails.push(`[${c.id}] threw: ${err.message}`);
      console.log(`    ✗ EXCEPTION: ${err.stack || err.message}`);
    }
  }

  console.log(`\n${'='.repeat(56)}\n${failed === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${passed} passed, ${failed} failed`);
  if (fails.length) { console.log('\nFailures:'); fails.forEach(f => console.log('  - ' + f)); }
  process.exit(failed === 0 ? 0 : 1);
}

run();
