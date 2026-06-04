'use strict';
/* =============================================================================
 * image_fit.js — figure out an image's real pixels & a sensible PKU layout.
 *
 * Reads intrinsic width/height straight from the file header (PNG/JPEG/GIF/BMP/
 * WebP) or the SVG width/height/viewBox — NO image library, so it runs anywhere.
 * From the aspect ratio it classifies the image and recommends:
 *   - object-fit  (contain by default; cover only for explicit decorative bg)
 *   - a layout    (wide -> bottom/full, tall -> side, square -> side/center)
 * Aspect ratio is ALWAYS preserved; we never stretch.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');

function be32(b, o) { return (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0; }
function le16(b, o) { return b[o] | b[o + 1] << 8; }
function le32(b, o) { return (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0; }

function sizeFromSVG(text) {
  const wt = text.match(/\bwidth\s*=\s*["']?\s*([\d.]+)/i);
  const ht = text.match(/\bheight\s*=\s*["']?\s*([\d.]+)/i);
  if (wt && ht) return { w: parseFloat(wt[1]), h: parseFloat(ht[1]) };
  const vb = text.match(/viewBox\s*=\s*["']\s*[\d.+-]+\s+[\d.+-]+\s+([\d.]+)\s+([\d.]+)/i);
  if (vb) return { w: parseFloat(vb[1]), h: parseFloat(vb[2]) };
  return null;
}

function readImageSize(file) {
  let buf;
  try { buf = fs.readFileSync(file); } catch { return null; }
  const ext = path.extname(file).toLowerCase();

  // SVG (text)
  if (ext === '.svg' || (buf.length > 5 && buf.slice(0, 5).toString('utf8').includes('<'))) {
    const s = sizeFromSVG(buf.toString('utf8'));
    if (s) return s;
  }
  // PNG
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: be32(buf, 16), h: be32(buf, 20) };
  }
  // GIF
  if (buf.length > 10 && buf.slice(0, 3).toString('ascii') === 'GIF') {
    return { w: le16(buf, 6), h: le16(buf, 8) };
  }
  // BMP
  if (buf.length > 26 && buf[0] === 0x42 && buf[1] === 0x4d) {
    return { w: le32(buf, 18), h: Math.abs(le32(buf, 22) | 0) };
  }
  // WebP
  if (buf.length > 30 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
    const fmt = buf.slice(12, 16).toString('ascii');
    if (fmt === 'VP8X') return { w: 1 + (buf[24] | buf[25] << 8 | buf[26] << 16), h: 1 + (buf[27] | buf[28] << 8 | buf[29] << 16) };
    if (fmt === 'VP8 ') return { w: le16(buf, 26) & 0x3fff, h: le16(buf, 28) & 0x3fff };
  }
  // JPEG
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const marker = buf[o + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { h: buf[o + 5] << 8 | buf[o + 6], w: buf[o + 7] << 8 | buf[o + 8] };
      }
      o += 2 + (buf[o + 2] << 8 | buf[o + 3]);
    }
  }
  return null;
}

const DECOR_RE = /(背景|装饰|底图|\bbg\b|background|decor)/i;
const KEEP_BIG_RE = /(流程|框架|架构|模型|结构|截图|统计|图谱|flow|chart|diagram|architecture|screenshot|pipeline|model)/i;

/* Classify by aspect ratio + filename/alt hints. Returns a descriptor used by
 * the layout engine and the renderer. Unknown size -> assume 4:3 landscape. */
function classify(file, alt) {
  const dim = readImageSize(file) || { w: 4, h: 3, _unknown: true };
  const ratio = dim.w / dim.h;
  const hintSrc = `${file} ${alt || ''}`;
  let shape;
  if (ratio >= 1.7) shape = 'wide';
  else if (ratio <= 0.72) shape = 'tall';
  else if (ratio >= 0.88 && ratio <= 1.15) shape = 'square';
  else shape = 'landscape';
  const decorative = DECOR_RE.test(hintSrc);
  const keepBig = KEEP_BIG_RE.test(hintSrc);
  return {
    w: dim.w, h: dim.h, ratio: +ratio.toFixed(3), shape,
    unknown: !!dim._unknown,
    fit: decorative ? 'cover' : 'contain',
    keepBig,
    // preferred layout for a single-image slide that ALSO has text (so text is
    // never dropped — image-full is reserved for image-only slides downstream)
    preferLayout: shape === 'wide' ? 'text-image-bottom'
      : shape === 'tall' ? 'text-image-right'
        : keepBig ? 'text-image-bottom' : 'text-image-right',
  };
}

/* Fit a box (boxW × boxH) to an image ratio without distortion (object-fit
 * contain math) — used by the validator to confirm nothing overflows. */
function containedBox(ratio, boxW, boxH) {
  let w = boxW, h = boxW / ratio;
  if (h > boxH) { h = boxH; w = boxH * ratio; }
  return { w: Math.round(w), h: Math.round(h) };
}

if (require.main === module) {
  const f = process.argv[2];
  if (!f) { console.error('usage: node image_fit.js <image>'); process.exit(1); }
  console.log(JSON.stringify(classify(f, ''), null, 2));
}

module.exports = { readImageSize, classify, containedBox };
