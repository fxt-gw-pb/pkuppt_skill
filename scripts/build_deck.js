'use strict';
/* =============================================================================
 * build_deck.js — orchestrate outline -> artifact.
 *
 *   node build_deck.js <outline.md> [--out output] [--template left-sidebar|top-nav]
 *
 * Pipeline: parse_outline -> layout_engine.buildDeck -> copy assets/images ->
 * template renderer -> write index.html + deckConfig.json + slides.json +
 * source_outline.md. `renderDeck()` is reused by auto-repair and the revision
 * engine to re-render an already-laid-out deck (deckConfig.json) without
 * re-running the splitter.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const { parseOutline } = require('./parse_outline');
const { buildDeck } = require('./layout_engine');

const SKILL_ROOT = path.resolve(__dirname, '..');

function loadRenderer(template) {
  const file = path.join(SKILL_ROOT, 'templates', template, 'renderer.js');
  if (!fs.existsSync(file)) throw new Error(`no renderer for template "${template}"`);
  return require(file);
}

function copyFile(srcAbs, destAbs) {
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.copyFileSync(srcAbs, destAbs);
}

/* copy template chrome assets + author images into <out>/assets, set outSrc */
function prepareAssets(deck, outDir) {
  const assetsDir = path.join(outDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  // template assets
  const tplAssets = path.join(SKILL_ROOT, 'templates', deck.template, 'assets');
  if (fs.existsSync(tplAssets)) {
    for (const f of fs.readdirSync(tplAssets)) {
      copyFile(path.join(tplAssets, f), path.join(assetsDir, f));
    }
  }
  // author images
  const used = new Map();
  for (const slide of deck.slides) {
    for (const b of (slide.blocks || [])) {
      if (b.kind !== 'image') continue;
      // re-render from a persisted deck: image already copied next to index.html
      if (b.outSrc && fs.existsSync(path.join(outDir, b.outSrc))) { b.missing = false; continue; }
      const abs = b.absPath || b.src;
      if (abs && fs.existsSync(abs)) {
        let name = path.basename(abs);
        if (used.has(name) && used.get(name) !== abs) {
          const ext = path.extname(name);
          name = path.basename(name, ext) + '-' + (used.size + 1) + ext;
        }
        used.set(name, abs);
        copyFile(abs, path.join(assetsDir, name));
        b.outSrc = 'assets/' + name;
        b.missing = false;
      } else {
        b.missing = true;
      }
    }
  }
}

/* deck -> plain JSON safe to persist (drops machine-local absolute paths) */
function cleanDeck(deck) {
  const clone = JSON.parse(JSON.stringify(deck));
  delete clone.baseDir;
  for (const s of clone.slides) {
    for (const b of (s.blocks || [])) { delete b.absPath; }
  }
  return clone;
}

function renderDeck(deck, outDir, opts = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  if (opts.prepareAssets !== false) prepareAssets(deck, outDir);
  const renderer = loadRenderer(deck.template);
  const html = renderer.render(deck, {});
  const indexPath = path.join(outDir, 'index.html');
  const clean = cleanDeck(deck);
  fs.writeFileSync(indexPath, html, 'utf8');
  fs.writeFileSync(path.join(outDir, 'deckConfig.json'), JSON.stringify(clean, null, 2));
  fs.writeFileSync(path.join(outDir, 'slides.json'), JSON.stringify(clean.slides, null, 2));
  return { html, indexPath, outDir };
}

function build(opts) {
  const outDir = path.resolve(opts.out || 'output');
  let deck;
  if (opts.outline || opts.outlineFile) {
    const file = opts.outlineFile && path.resolve(opts.outlineFile);
    const src = opts.outline != null ? opts.outline : fs.readFileSync(file, 'utf8');
    const baseDir = opts.baseDir || (file ? path.dirname(file) : process.cwd());
    const parsed = parseOutline(src);
    deck = buildDeck(parsed, { baseDir, template: opts.template });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'source_outline.md'), src, 'utf8');
  } else if (opts.deck) {
    deck = opts.deck;
  } else if (opts.config) {
    deck = JSON.parse(fs.readFileSync(path.resolve(opts.config), 'utf8'));
  } else {
    throw new Error('build() needs outlineFile | outline | deck | config');
  }
  const res = renderDeck(deck, outDir);
  return { deck, ...res };
}

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i];
    else if (a === '--template') o.template = argv[++i];
    else if (a === '--config') o.config = argv[++i];
    else o._.push(a);
  }
  return o;
}

if (require.main === module) {
  const a = parseArgs(process.argv.slice(2));
  if (!a._[0] && !a.config) { console.error('usage: node build_deck.js <outline.md> [--out dir] [--template left-sidebar|top-nav]'); process.exit(1); }
  const { deck, indexPath } = build({ outlineFile: a._[0], out: a.out, template: a.template, config: a.config });
  console.log(`✓ built ${deck.template} deck: ${deck.slides.length} slides -> ${indexPath}`);
}

module.exports = { build, renderDeck, prepareAssets, cleanDeck, loadRenderer };
