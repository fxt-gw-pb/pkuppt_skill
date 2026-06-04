'use strict';
/* =============================================================================
 * measure.js — analytic layout measurement (shared by layout_engine,
 * validate_layout, critique_deck, auto_repair).
 *
 * The renderer places one fixed-size container at the template's safe content
 * area and lets blocks flow inside it (flow can't overlap; object-fit:contain
 * can't distort). So the ONLY layout risk is the flowed content being taller
 * than the fixed box (it would clip). This module estimates that flowed height
 * per layout, picks the largest readable body size that fits, and reports
 * image-too-small / table-too-dense problems. Deterministic, no browser.
 * ========================================================================== */

const { contentArea, measureTextHeight } = require('./theme');
const { plain } = require('./markdown');

const GAP = t => (t.id === 'left-sidebar' ? 36 : 22);

function isText(b) { return b.kind === 'paragraph' || b.kind === 'list'; }

/* height of a run of paragraph/list blocks flowed in a column `width` wide */
function textHeight(theme, blocks, width, bodyFont) {
  const lh = theme.type.lineHeight;
  let h = 0, first = true;
  for (const b of blocks) {
    if (!isText(b)) continue;
    if (!first) h += bodyFont * 0.7; first = false;
    if (b.kind === 'paragraph') {
      h += measureTextHeight(plain(b.text), bodyFont, width, lh).height;
    } else {
      for (const it of b.items) {
        h += measureTextHeight('• ' + plain(it), bodyFont, width * 0.95, lh).height + bodyFont * 0.4;
      }
    }
  }
  return h;
}

function captionH(theme, bodyFont) { return theme.type.caption * theme.type.lineHeight + bodyFont * 0.4; }

/* The box (w,h) the text portion gets, per layout, inside the content area. */
function textRegion(theme, area, layout) {
  const g = GAP(theme);
  switch (layout) {
    case 'text-only': return { w: area.w, h: area.h };
    case 'text-image-right':
    case 'image-text-right': return { w: Math.round(area.w * 0.54), h: area.h };
    case 'text-image-bottom': return { w: area.w, h: Math.round(area.h * 0.42) };
    case 'comparison': return { w: Math.round((area.w - g) / 2), h: area.h };
    case 'three-points': return { w: Math.round((area.w - 2 * g) / 3), h: area.h };
    case 'four-cards': return { w: Math.round((area.w - g) / 2), h: Math.round((area.h - g) / 2) };
    case 'image-grid':
    case 'image-grid-2': return { w: area.w, h: Math.round(area.h * 0.18) }; // optional lead band
    case 'image-full':
    case 'table':
    case 'timeline': return { w: area.w, h: area.h };
    default: return { w: area.w, h: area.h };
  }
}

/* image boxes (w,h) per layout for nImg images */
function imageBoxes(theme, area, layout, nImg, hasText) {
  const g = GAP(theme);
  if (nImg === 0) return [];
  switch (layout) {
    case 'image-full': {
      const h = area.h - (hasText ? 0 : 0);
      return [{ w: area.w, h }];
    }
    case 'text-image-right':
    case 'image-text-right': {
      const w = area.w - Math.round(area.w * 0.54) - g;
      return [{ w, h: area.h }];
    }
    case 'text-image-bottom': {
      const h = area.h - Math.round(area.h * 0.42) - g;
      return [{ w: area.w, h }];
    }
    case 'image-grid-2':
      return Array.from({ length: nImg }, () => ({ w: Math.round((area.w - g) / 2), h: area.h * (hasText ? 0.78 : 1) }));
    case 'image-grid': {
      const cols = nImg <= 2 ? 2 : 2, rows = Math.ceil(nImg / cols);
      const w = Math.round((area.w - (cols - 1) * g) / cols);
      const usableH = area.h * (hasText ? 0.78 : 1);
      const h = Math.round((usableH - (rows - 1) * g) / rows);
      return Array.from({ length: nImg }, () => ({ w, h }));
    }
    default: return [{ w: area.w, h: area.h }];
  }
}

function contained(ratio, boxW, boxH) {
  let w = boxW, h = boxW / ratio;
  if (h > boxH) { h = boxH; w = boxH * ratio; }
  return { w, h, minSide: Math.min(w, h) };
}

/* Analyze a single content slide at a given body size. */
function analyze(theme, slide, bodyFont) {
  const area = contentArea(theme, slide);
  const layout = slide.layout || 'text-only';
  const blocks = slide.blocks || [];
  const textBlocks = blocks.filter(isText);
  const images = blocks.filter(b => b.kind === 'image');
  const tables = blocks.filter(b => b.kind === 'table');
  const hasText = textBlocks.length > 0;
  const issues = [];

  // ---- text fit ----
  const tr = textRegion(theme, area, layout);
  const capH = images.some(im => im.caption) ? captionH(theme, bodyFont) : 0;
  let th = textHeight(theme, textBlocks, tr.w, bodyFont);
  let textAvail = tr.h - (['image-full'].includes(layout) ? 0 : 0);
  if (layout === 'image-grid' || layout === 'image-grid-2') textAvail = tr.h; // lead band only
  const textOverflow = th > textAvail + 1;

  // ---- images ----
  let imgMinSide = Infinity;
  if (images.length) {
    const boxes = imageBoxes(theme, area, layout, images.length, hasText);
    images.forEach((im, k) => {
      const box = boxes[Math.min(k, boxes.length - 1)];
      const ratio = im.ratio || 4 / 3;
      const c = contained(ratio, box.w, box.h - (im.caption ? capH : 0));
      imgMinSide = Math.min(imgMinSide, c.minSide);
    });
  }
  if (images.length && imgMinSide < (theme.id === 'left-sidebar' ? 150 : 100)) {
    issues.push({ type: 'image_too_small', detail: Math.round(imgMinSide) });
  }

  // ---- table ----
  let tableOverflow = false, tableTooWide = false;
  if (tables.length) {
    const t = tables[0];
    const rowH = bodyFont * 2.2;
    const need = (t.rows.length + 1) * rowH;
    if (need > area.h + 1) { tableOverflow = true; issues.push({ type: 'table_too_dense', rows: t.rows.length }); }
    const cols = t.headers.length || (t.rows[0] ? t.rows[0].length : 1);
    const minColW = theme.id === 'left-sidebar' ? 120 : 80;
    if (cols * minColW > area.w + 1) { tableTooWide = true; issues.push({ type: 'table_too_wide', cols }); }
  }

  const fits = !textOverflow && !tableOverflow;
  return { layout, bodyFont, area, textHeight: Math.round(th), textAvail: Math.round(textAvail),
    textOverflow, tableOverflow, tableTooWide, imgMinSide: isFinite(imgMinSide) ? Math.round(imgMinSide) : null,
    fits, issues };
}

/* Pick the largest body size from the ladder that fits; report min-fit too. */
function pickBodySize(theme, slide) {
  const ladder = theme.type.body;
  let chosen = ladder[ladder.length - 1], result = null;
  for (const size of ladder) {
    const a = analyze(theme, slide, size);
    if (a.fits) { return { size, analysis: a, fitsAtMin: true }; }
    result = a;
  }
  // none fit even at min size
  const min = analyze(theme, slide, theme.type.bodyMin);
  return { size: theme.type.bodyMin, analysis: min, fitsAtMin: min.fits };
}

module.exports = { analyze, pickBodySize, textHeight, textRegion, imageBoxes, contained, GAP, isText };
