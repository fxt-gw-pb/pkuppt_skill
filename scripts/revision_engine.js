'use strict';
/* =============================================================================
 * revision_engine.js — apply structured revision operations to a deck.
 *
 * Pure transforms on the deck object (the renderer/validator run afterwards).
 * It LOCATES the target precisely (page number / section title / figure number
 * or caption), edits only that, preserves section order, and never deletes
 * content unless the op is an explicit delete_slide.
 *
 * Page numbers in ONE request refer to the deck as it was BEFORE the batch:
 * applyOps snapshots page->slide up front and renumbers only once at the end,
 * so "split slide 2" then "delete slide 7" both mean the original pages.
 *
 * Op shape: { action, target?, ... }. Supported: enlarge_image, change_layout,
 * split_text, split_table, rename_section, emphasize_bold, replace_image,
 * delete_slide, set_template, reflow. See docs/REVISION_WORKFLOW.md.
 * ========================================================================== */

const path = require('path');
const fs = require('fs');
const { getTheme } = require('./lib/theme');
const measure = require('./lib/measure');
const imageFit = require('./image_fit');
const { buildDeck, chooseLayout } = require('./layout_engine');
const { splitTable, pageToSlides } = require('./auto_repair');

let _uid = 0;
const uid = () => `content-x${Date.now().toString(36)}-${++_uid}`;

const contentSlides = deck => deck.slides.filter(s => s.type === 'content');
function slideByPage(deck, page, idx) {
  if (page == null) return null;
  if (idx) return idx.get(Number(page)) || null;
  return contentSlides(deck).find(s => s._page === Number(page)) || null;
}

function findSection(deck, t) {
  if (!t) return null;
  if (t.sectionId) return deck.sections.find(s => s.id === t.sectionId);
  const name = t.sectionTitle || t.section || t.name;
  if (!name) return null;
  return deck.sections.find(s => s.title === name)
    || deck.sections.find(s => s.title.includes(name) || name.includes(s.title));
}

function findImage(deck, t) {
  const imgs = [];
  for (const s of contentSlides(deck)) for (const b of (s.blocks || [])) if (b.kind === 'image') imgs.push({ slide: s, block: b });
  if (t.page) { const local = imgs.filter(x => x.slide._page === Number(t.page)); if (local.length) return local[t.figureOnPage ? t.figureOnPage - 1 : 0]; }
  if (t.caption) { const hit = imgs.find(x => (x.block.caption || '').includes(t.caption)); if (hit) return hit; }
  if (t.figure) {
    const byCap = imgs.find(x => new RegExp(`图\\s*${t.figure}\\b`).test(x.block.caption || ''));
    if (byCap) return byCap;
    if (imgs[t.figure - 1]) return imgs[t.figure - 1];
  }
  return null;
}

function renumber(deck) {
  let p = 0;
  deck.slides.forEach((s, i) => { s._index = i; if (s.type === 'content') s._page = ++p; else delete s._page; });
}
function replaceSlide(deck, slide, replacement) {
  const i = deck.slides.indexOf(slide);
  if (i < 0) return false;
  deck.slides.splice(i, 1, ...replacement);
  return true; // NOTE: caller renumbers once after the whole batch
}

/* split a page's content into two non-empty halves (list items / sentences) */
function forceSplitBlocks(blocks) {
  if (!blocks || !blocks.length) return null;
  if (blocks.length === 1) {
    const b = blocks[0];
    if (b.kind === 'list' && b.items.length >= 2) {
      const mid = Math.ceil(b.items.length / 2);
      return [[{ ...b, items: b.items.slice(0, mid) }], [{ ...b, items: b.items.slice(mid) }]];
    }
    if (b.kind === 'paragraph') {
      const sents = b.text.split(/(?<=[。！？!?；;])\s*/).filter(Boolean);
      if (sents.length >= 2) { const mid = Math.ceil(sents.length / 2); return [[{ kind: 'paragraph', text: sents.slice(0, mid).join('') }], [{ kind: 'paragraph', text: sents.slice(mid).join('') }]]; }
    }
    return null;
  }
  const mid = Math.ceil(blocks.length / 2);
  return [blocks.slice(0, mid), blocks.slice(mid)];
}

/* rebuild a parse-like structure so set_template can re-run the full layout */
function deckToParsed(deck) {
  const pages = [];
  for (const s of contentSlides(deck)) pages.push({ sectionId: s.sectionId, heading: s.heading, blocks: s.blocks, layout: null });
  return { meta: Object.assign({}, deck.meta), sections: deck.sections.map(s => ({ id: s.id, title: s.title, englishTitle: s.englishTitle })), pages };
}

function applyOp(deck, op, opts = {}) {
  const theme = getTheme(deck.template);
  const idx = opts._pageIndex;
  const change = { action: op.action, ok: false, affected: [], note: '', _refs: null };
  const mkSlide = (bl, h, src) => { const s = { id: uid(), type: 'content', sectionId: src.sectionId, heading: h, layout: chooseLayout(bl, null), blocks: bl, subtitle: src.subtitle }; s.bodySize = measure.pickBodySize(theme, s).size; return s; };

  switch (op.action) {
    case 'enlarge_image': {
      const slide = (op.target && op.target.page) ? slideByPage(deck, op.target.page, idx) : (findImage(deck, op.target || {}) || {}).slide;
      if (!slide) { change.note = '未找到目标页/图片'; break; }
      const promote = { 'text-image-right': 'text-image-bottom', 'image-text-right': 'text-image-bottom', 'text-image-bottom': 'image-full' };
      const hasText = (slide.blocks || []).some(b => b.kind === 'paragraph' || b.kind === 'list');
      const before = slide.layout;
      if (before === 'text-image-bottom' && hasText) { change.note = '已是大图布局，保持文字可见，未切到 image-full'; change.ok = true; change._refs = [slide]; break; }
      slide.layout = promote[before] || before;
      slide.bodySize = measure.pickBodySize(theme, slide).size;
      change.ok = true; change._refs = [slide]; change.note = `${before} -> ${slide.layout}`;
      break;
    }
    case 'change_layout': {
      const slide = slideByPage(deck, op.target && op.target.page, idx);
      if (!slide) { change.note = '未找到目标页'; break; }
      const before = slide.layout; slide.layout = op.to || op.layout;
      slide.bodySize = measure.pickBodySize(theme, slide).size;
      change.ok = true; change._refs = [slide]; change.note = `${before} -> ${slide.layout}`;
      break;
    }
    case 'split_text': {
      const slide = slideByPage(deck, op.target && op.target.page, idx);
      if (!slide) { change.note = '未找到目标页'; break; }
      const headings = op.headings || null;
      let parts = pageToSlides(theme, slide.sectionId, { heading: slide.heading, blocks: slide.blocks, layout: null, subtitle: slide.subtitle });
      if (parts.length < 2) {
        const halves = forceSplitBlocks(slide.blocks || []);
        if (!halves) { change.note = '该页内容无法进一步拆分'; change.ok = true; change._refs = [slide]; break; }
        parts = [mkSlide(halves[0], (headings && headings[0]) || slide.heading, slide), mkSlide(halves[1], (headings && headings[1]) || `${slide.heading}（续）`, slide)];
      } else if (headings) {
        parts.forEach((p, i) => { if (headings[i]) p.heading = headings[i]; });
      }
      replaceSlide(deck, slide, parts);
      change.ok = true; change._refs = parts; change.note = `拆为 ${parts.length} 页`;
      break;
    }
    case 'split_table': {
      const slide = slideByPage(deck, op.target && op.target.page, idx);
      if (!slide) { change.note = '未找到目标页'; break; }
      const parts = splitTable(theme, slide);
      replaceSlide(deck, slide, parts);
      change.ok = parts.length > 1; change._refs = parts; change.note = `拆为 ${parts.length} 页`;
      break;
    }
    case 'rename_section': {
      const sec = findSection(deck, op.target || op);
      if (!sec) { change.note = '未找到章节'; break; }
      const before = sec.title; sec.title = op.to || op.name;
      if (op.english) sec.englishTitle = op.english;
      change.ok = true; change.affected = [sec.id]; change.note = `「${before}」-> 「${sec.title}」`;
      break;
    }
    case 'emphasize_bold': {
      deck.meta.emphasis = op.style || 'pku-red';
      change.ok = true; change.note = `加粗重点样式 -> ${deck.meta.emphasis}`;
      break;
    }
    case 'replace_image': {
      const hit = findImage(deck, op.target || op);
      if (!hit) { change.note = '未找到目标图片'; break; }
      const baseDir = opts.baseDir || process.cwd();
      const newSrc = op.with || op.src;
      const abs = path.isAbsolute(newSrc) ? newSrc : path.resolve(baseDir, newSrc);
      const info = imageFit.classify(abs, hit.block.alt);
      hit.block.src = newSrc; hit.block.absPath = abs; delete hit.block.outSrc;
      hit.block.missing = !fs.existsSync(abs);
      Object.assign(hit.block, { w: info.w, h: info.h, ratio: info.ratio, shape: info.shape, fit: info.fit, keepBig: info.keepBig, preferLayout: info.preferLayout });
      hit.slide.bodySize = measure.pickBodySize(theme, hit.slide).size;
      change.ok = true; change._refs = [hit.slide]; change.note = `图片替换为 ${newSrc}（图注与位置保持不变）`;
      break;
    }
    case 'delete_slide': {
      const slide = slideByPage(deck, op.target && op.target.page, idx);
      if (!slide) { change.note = '未找到目标页'; break; }
      const heading = slide.heading;
      replaceSlide(deck, slide, []);
      change.ok = true; change.affected = [op.target.page]; change.note = `已删除：${heading || '第' + op.target.page + '页'}`;
      break;
    }
    case 'set_template': {
      if (opts.keepTemplate) { change.note = '用户要求保持模板不变，忽略'; break; }
      const to = op.to || op.template;
      if (to !== 'left-sidebar' && to !== 'top-nav') { change.note = '未知模板'; break; }
      if (to === deck.template) { change.ok = true; change.note = '模板未变'; break; }
      const rebuilt = buildDeck(deckToParsed(deck), { baseDir: opts.baseDir, template: to });
      deck.slides = rebuilt.slides; deck.template = to; deck.meta.template = to;
      change.ok = true; change.note = `模板 -> ${to}`;
      break;
    }
    case 'reflow':
      change.ok = true; change.note = '交由自动修复处理排版'; break;
    default:
      change.note = `未知操作：${op.action}`;
  }
  return change;
}

function applyOps(deck, ops, opts = {}) {
  const snapshot = new Map();
  contentSlides(deck).forEach(s => snapshot.set(s._page, s));
  const changes = [];
  for (const op of ops) changes.push(applyOp(deck, op, { ...opts, _pageIndex: snapshot }));
  renumber(deck);
  for (const c of changes) {
    if (c._refs) { c.affected = c._refs.filter(s => deck.slides.includes(s)).map(s => s._page); delete c._refs; }
    else delete c._refs;
  }
  return { deck, changes };
}

module.exports = { applyOps, applyOp, findSection, findImage, slideByPage, deckToParsed, forceSplitBlocks };
