'use strict';
/* =============================================================================
 * theme.js — single source of truth for PKU-red geometry + typography.
 *
 * Both templates are FULLY absolutely-positioned inside a fixed design space,
 * so every bounding box is computable in plain numbers. The renderers, the
 * layout engine, and the layout validator all import these constants — that is
 * what keeps "what we draw" and "what we measure" in lock-step (no Playwright
 * needed). All numbers are in design-space px.
 * ========================================================================== */

const PKU = {
  red: '#9E0000',
  redCover: '#9B0000',
  gold: '#CFAF6A',
  ink: '#262626',
  inkBody: '#222222',
  inkSoft: '#404040',
  lineGray: '#BFBFBF',
  pageGray: '#A6A6A6',
  white: '#FFFFFF',
  navBg: '#FAFAFA',
  soft: '#F0F0F0',
  fontSans: '"Microsoft YaHei","微软雅黑","PingFang SC","Hiragino Sans GB",Arial,sans-serif',
  fontSerif: '"SimSun","宋体","Songti SC",STSong,serif',
};

/* ---- left-sidebar : 1920 × 1080 ------------------------------------------ */
const LEFT = {
  id: 'left-sidebar',
  W: 1920,
  H: 1080,
  sidebarW: 306,
  // safe content area to the right of the sidebar, below the title block.
  safe: { x: 338, y: 240, w: 1492, h: 750 },
  title: { x: 338, y: 30, size: 56 },     // "1. 研究背景"
  subtitle: { x: 338, y: 150, size: 40 }, // "1.1 引言"
  pageNo: { rightPad: 46, bottomPad: 38, size: 26 },
  // typography ladders + readability floors (design px; ≈1.5× the 1280-space).
  type: {
    titleMin: 39,
    body: [34, 30, 28, 26, 24], bodyMin: 24,
    caption: 24, captionMin: 18,
    lineHeight: 1.7,
  },
  // nav font auto-shrink ladder by section count (mirrors original renderer).
  nav: { fs: n => (n <= 5 ? 30 : n <= 7 ? 26 : n <= 9 ? 22 : 19),
         gap: n => (n <= 5 ? 10 : n <= 7 ? 6 : 4) },
  toc: { fs: n => (n <= 4 ? 72 : n <= 6 ? 60 : n <= 8 ? 50 : 42),
         gap: n => (n <= 4 ? 96 : n <= 6 ? 64 : 44) },
};

/* ---- top-nav : 1280 × 720 ------------------------------------------------- */
const TOP = {
  id: 'top-nav',
  W: 1280,
  H: 720,
  navH: 62,
  padX: 101,
  pageTitle: { y: 103, size: 28 },
  pageBar: { y: 206, h: 83, size: 37 },   // red subtitle bar
  // content area WITH a subtitle bar, and WITHOUT one (no-bar).
  safe: { x: 101, y: 320, w: 1078, h: 336 },
  safeNoBar: { x: 101, y: 170, w: 1078, h: 486 },
  pageNo: { rightPad: 34, bottomPad: 24, size: 20 },
  type: {
    titleMin: 26,
    body: [20, 19, 18, 17, 16], bodyMin: 16,
    caption: 13, captionMin: 12,
    lineHeight: 1.7,
  },
  nav: { fs: n => (n <= 5 ? 21 : n <= 6 ? 19 : n <= 7 ? 17 : 15),
         fsOn: n => (n <= 5 ? 27 : n <= 6 ? 24 : n <= 7 ? 22 : 19) },
  toc: { gap: n => (n <= 5 ? 30 : n <= 6 ? 22 : n <= 7 ? 16 : 12) },
};

const TEMPLATES = { 'left-sidebar': LEFT, 'top-nav': TOP };

function getTheme(id) {
  const t = TEMPLATES[id];
  if (!t) throw new Error(`unknown template "${id}" (use left-sidebar | top-nav)`);
  return t;
}

/* The usable content box for a content slide, accounting for whether a
 * subtitle bar is present (only matters on top-nav). */
function contentArea(theme, slide) {
  if (theme.id === 'top-nav') {
    return slide && slide.subtitle ? { ...theme.safe } : { ...theme.safeNoBar };
  }
  return { ...theme.safe };
}

/* Count of CJK (full-width) vs latin (≈half-width) chars → average advance. */
function avgCharWidth(text, fontPx) {
  const s = String(text || '');
  if (!s.length) return fontPx;
  let cjk = 0;
  for (const ch of s) if (/[　-鿿＀-￯]/.test(ch)) cjk++;
  const cjkRatio = cjk / [...s].length;
  // CJK glyph ≈ 1.0em, latin ≈ 0.55em.
  return fontPx * (cjkRatio * 1.0 + (1 - cjkRatio) * 0.55);
}

/* Estimate rendered height (px) of a run of text inside a column of width `w`. */
function measureTextHeight(text, fontPx, w, lineHeight) {
  const lh = fontPx * (lineHeight || 1.7);
  const adv = avgCharWidth(text, fontPx);
  const cpl = Math.max(1, Math.floor(w / adv));
  const lines = Math.max(1, Math.ceil([...String(text || '')].length / cpl));
  return { lines, height: lines * lh, cpl };
}

module.exports = {
  PKU, LEFT, TOP, TEMPLATES, getTheme, contentArea,
  avgCharWidth, measureTextHeight,
};
