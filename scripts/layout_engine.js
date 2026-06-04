'use strict';
/* =============================================================================
 * layout_engine.js — parsed outline  ->  fully laid-out deck.
 *
 * Responsibilities (it NEVER reorders, merges or drops the author's content):
 *   1. resolve the template (explicit, else by section count: <=4 left, >=5 top)
 *   2. classify every image (real pixels -> shape -> layout/fit)
 *   3. choose a layout per page from its blocks (or honour a `layout:` hint)
 *   4. split a page into ordered continuation pages when content can't fit,
 *      preserving sequence; continuation headings get （续）
 *   5. pick the largest readable body size per slide
 *   6. add cover / contents / (top-nav) Part / ending and number content pages
 *
 * Output `deck` is the single source of truth consumed by the renderers,
 * validator, critique, auto-repair and revision engine.
 * ========================================================================== */

const path = require('path');
const { getTheme, contentArea } = require('./lib/theme');
const { plain } = require('./lib/markdown');
const measure = require('./lib/measure');
const imageFit = require('./image_fit');

const KNOWN_LAYOUTS = new Set([
  'text-only', 'image-full', 'text-image-right', 'image-text-right',
  'text-image-bottom', 'three-points', 'four-cards', 'timeline',
  'table', 'comparison', 'image-grid-2', 'image-grid',
]);

function chooseTemplate(parsed, opts) {
  const explicit = (opts && opts.template) || (parsed.meta && parsed.meta.template);
  if (explicit) {
    if (!getTheme.length) {/*noop*/}
    if (explicit === 'left-sidebar' || explicit === 'top-nav') return explicit;
    throw new Error(`template must be left-sidebar | top-nav (got "${explicit}")`);
  }
  return parsed.sections.length >= 5 ? 'top-nav' : 'left-sidebar';
}

function resolveImages(blocks, baseDir) {
  for (const b of blocks) {
    if (b.kind !== 'image') continue;
    const abs = path.isAbsolute(b.src) ? b.src : path.resolve(baseDir, b.src);
    const info = imageFit.classify(abs, b.alt);
    b.absPath = abs;
    b.missing = info.unknown && !require('fs').existsSync(abs);
    Object.assign(b, { w: info.w, h: info.h, ratio: info.ratio, shape: info.shape, fit: info.fit, keepBig: info.keepBig, preferLayout: info.preferLayout });
  }
}

function allShort(items) { return items.every(it => plain(it).length <= 16); }

function chooseLayout(blocks, hint) {
  if (hint && KNOWN_LAYOUTS.has(hint)) return hint;
  const images = blocks.filter(b => b.kind === 'image');
  const tables = blocks.filter(b => b.kind === 'table');
  const text = blocks.filter(b => b.kind === 'paragraph' || b.kind === 'list');
  if (tables.length) return 'table';
  if (images.length === 0) {
    if (text.length === 1 && text[0].kind === 'list') {
      const n = text[0].items.length;
      if (n === 3 && allShort(text[0].items)) return 'three-points';
      if (n === 4 && allShort(text[0].items)) return 'four-cards';
    }
    return 'text-only';
  }
  if (images.length === 1) {
    if (text.length === 0) return 'image-full';
    return images[0].preferLayout || 'text-image-right';
  }
  if (images.length === 2) return 'image-grid-2';
  return 'image-grid';
}

/* does this set of blocks fit on one slide at the minimum body size? */
function fitsWith(theme, blocks, hint) {
  const slide = { type: 'content', blocks, layout: chooseLayout(blocks, hint), subtitle: undefined };
  const images = blocks.filter(b => b.kind === 'image').length;
  const hasText = blocks.some(b => b.kind === 'paragraph' || b.kind === 'list');
  if (images > (hasText ? 3 : 4)) return false;       // hard clutter cap
  return measure.analyze(theme, slide, theme.type.bodyMin).fits;
}

/* split any paragraph too tall to ever fit into sentence-grouped paragraphs */
function presplitParagraphs(theme, blocks) {
  const area = contentArea(theme, { type: 'content' });
  const out = [];
  for (const b of blocks) {
    if (b.kind !== 'paragraph') { out.push(b); continue; }
    const tooTall = measure.textHeight(theme, [b], area.w, theme.type.bodyMin) > area.h;
    if (!tooTall) { out.push(b); continue; }
    const sentences = b.text.split(/(?<=[。！？!?；;])\s*/).filter(Boolean);
    let chunk = [];
    const flush = () => { if (chunk.length) { out.push({ kind: 'paragraph', text: chunk.join('') }); chunk = []; } };
    for (const s of sentences) {
      const trial = [{ kind: 'paragraph', text: chunk.join('') + s }];
      if (chunk.length && measure.textHeight(theme, trial, area.w, theme.type.bodyMin) > area.h) flush();
      chunk.push(s);
    }
    flush();
  }
  return out;
}

function contHeading(h, i) {
  if (!h) return '';
  if (i === 1) return `${h}（续）`;
  return `${h}（续${i}）`;
}

function splitPage(theme, page) {
  const blocks = presplitParagraphs(theme, page.blocks);
  if (!blocks.length) return [{ heading: page.heading, blocks: [], layout: chooseLayout([], page.layout) }];
  const buckets = [];
  let cur = [];
  const flush = () => { if (cur.length) { buckets.push(cur); cur = []; } };
  for (const b of blocks) {
    if (b.kind === 'table') { flush(); buckets.push([b]); continue; }
    const trial = [...cur, b];
    if (cur.length && !fitsWith(theme, trial, page.layout)) { flush(); cur = [b]; }
    else cur = trial;
  }
  flush();
  return buckets.map((bk, i) => ({
    heading: i === 0 ? page.heading : contHeading(page.heading, i),
    blocks: bk,
    layout: chooseLayout(bk, page.layout),
    _splitIndex: i,
    _splitTotal: buckets.length,
  }));
}

let _uid = 0;
const uid = p => `${p}-${++_uid}`;

function buildDeck(parsed, opts = {}) {
  const template = chooseTemplate(parsed, opts);
  const theme = getTheme(template);
  const baseDir = opts.baseDir || process.cwd();
  _uid = 0;

  const meta = Object.assign({
    title: '标题', subtitle: '副标题', presenter: 'XXX', advisor: 'XXX',
    date: 'XX年XX月XX日', lang: 'zh-CN',
  }, parsed.meta || {}, { template });

  const sections = parsed.sections.map((s, i) => ({
    id: s.id, title: s.title, englishTitle: s.englishTitle || '', _index: i,
  }));
  const secById = id => sections.find(s => s.id === id);

  const slides = [];
  slides.push({ id: uid('cover'), type: 'cover' });
  slides.push({ id: uid('contents'), type: 'contents' });

  // group pages by section, preserving section + page order
  for (const sec of sections) {
    if (template === 'top-nav') slides.push({ id: uid('part'), type: 'part', sectionId: sec.id });
    const pages = parsed.pages.filter(p => p.sectionId === sec.id);
    for (const page of pages) {
      resolveImages(page.blocks, baseDir); // classify BEFORE layout selection
      for (const bucket of splitPage(theme, page)) {
        const slide = {
          id: uid('content'), type: 'content', sectionId: sec.id,
          heading: bucket.heading, layout: bucket.layout, blocks: bucket.blocks,
          subtitle: undefined,
          _splitIndex: bucket._splitIndex, _splitTotal: bucket._splitTotal,
        };
        const pick = measure.pickBodySize(theme, slide);
        slide.bodySize = pick.size;
        slide._fits = pick.fitsAtMin;
        slides.push(slide);
      }
    }
  }
  slides.push({ id: uid('ending'), type: 'ending' });

  // page numbers count only content slides
  let pageNo = 0;
  slides.forEach((s, i) => { s._index = i; if (s.type === 'content') s._page = ++pageNo; });

  return { meta, template, sections, slides, baseDir };
}

if (require.main === module) {
  const fs = require('fs');
  const { parseOutline } = require('./parse_outline');
  const file = process.argv[2];
  if (!file) { console.error('usage: node layout_engine.js <outline.md>'); process.exit(1); }
  const parsed = parseOutline(fs.readFileSync(file, 'utf8'));
  const deck = buildDeck(parsed, { baseDir: path.dirname(path.resolve(file)) });
  process.stdout.write(JSON.stringify(deck, null, 2) + '\n');
}

module.exports = { buildDeck, chooseTemplate, chooseLayout, splitPage, KNOWN_LAYOUTS };
