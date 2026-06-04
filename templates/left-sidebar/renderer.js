'use strict';
/* =============================================================================
 * left-sidebar/renderer.js — render a laid-out deck into one self-contained
 * HTML file using the PKU red left-vertical-nav chrome (1920×1080).
 *
 * Static pre-render: every slide is emitted as final HTML (no in-browser
 * template engine), so the printed PDF and the on-screen deck can never
 * diverge. The left nav + TOC are generated from deck.sections, so they grow
 * or shrink with the actual outline (never hard-coded to 4 items).
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const { getTheme } = require('../../scripts/lib/theme');
const { esc } = require('../../scripts/lib/markdown');
const { renderBody, flowCSS, emphasisColor } = require('../../scripts/lib/render_blocks');
const { baseCSS, controlsHTML, runtimeJS } = require('../../scripts/lib/runtime');

const A = 'assets/seal-white.png';
const AR = 'assets/seal-red.png';
const AP = 'assets/pagoda.png';

function renderCover(deck, slide) {
  const m = deck.meta;
  const isEnd = slide.type === 'ending';
  const title = isEnd ? (slide.title || '谢谢聆听') : (slide.title || m.title);
  const sub = isEnd ? (slide.subtitle || 'THANKS') : (slide.subtitle || m.subtitle);
  const people = isEnd ? '' : `
    <div class="cover-people">
      <div class="item"><b>答辩人</b>：${esc(m.presenter)}</div>
      <div class="item"><b>指导老师</b>：${esc(m.advisor)}</div>
    </div>
    <div class="cover-date">答辩时间：${esc(m.date)}</div>`;
  const tlen = [...String(title)].length;
  const tsize = tlen <= 10 ? 120 : tlen <= 15 ? 100 : tlen <= 20 ? 84 : tlen <= 26 ? 70 : 58;
  return `
    <div class="cover-logo"><img src="${AR}" alt="北京大学校徽"></div>
    <div class="cover-block"></div>
    <div class="cover-textwrap" style="--cover-title-size:${tsize}px">
      <div class="cover-title">${esc(title)}</div>
      <div class="cover-sub">${esc(sub)}</div>
    </div>${people}`;
}

function renderContents(deck) {
  const t = getTheme('left-sidebar');
  const n = deck.sections.length;
  const fs2 = t.toc.fs(n), gap = t.toc.gap(n);
  const rows = deck.sections.map((sec, i) => `
      <div class="toc-row" style="font-size:${fs2}px">
        <span class="part">Part ${i + 1}</span>
        <span class="ttl">${esc(sec.title)}</span>
      </div>`).join('');
  return `
    <div class="toc-panel"></div>
    <div class="toc-seal"><img src="${A}" alt="校徽"></div>
    <div class="toc-cn">目录</div>
    <div class="toc-en">CONTENTS</div>
    <img class="toc-pagoda" src="${AP}" alt="博雅塔">
    <div class="toc-list" style="gap:${gap}px">${rows}</div>`;
}

function renderContent(deck, slide, opts) {
  const t = getTheme('left-sidebar');
  const n = deck.sections.length;
  const navFs = t.nav.fs(n), navGap = t.nav.gap(n);
  const idx = deck.sections.findIndex(s => s.id === slide.sectionId);
  const sec = deck.sections[idx] || { title: '' };
  const nav = deck.sections.map(item => {
    const on = item.id === slide.sectionId ? ' active' : '';
    return `<div class="nav-item${on}" style="font-size:${navFs}px">${esc(item.title)}</div>`;
  }).join('');
  const num = idx >= 0 ? `${idx + 1}. ` : '';
  const body = renderBody(t, slide, opts.src);
  return `
    <div class="side">
      <div class="side-seal"><img src="${A}" alt="校徽"></div>
      <div class="side-rule"></div>
      <div class="side-nav" style="gap:${navGap}px">${nav}</div>
    </div>
    <div class="c-title">${num}${esc(sec.title)}</div>
    <div class="c-rule-gray"></div>
    <div class="c-rule-red"></div>
    <div class="c-sub">${esc(slide.heading || '')}</div>
    <div class="c-body">${body}</div>
    <div class="page-no">${esc(slide._page || '')}</div>`;
}

function renderSlide(deck, slide, opts) {
  switch (slide.type) {
    case 'cover': return renderCover(deck, slide);
    case 'contents': return renderContents(deck);
    case 'content': return renderContent(deck, slide, opts);
    case 'ending': return renderCover(deck, slide);
    default: return `<div class="c-body">未知页型：${esc(slide.type)}</div>`;
  }
}

function render(deck, opts = {}) {
  const t = getTheme('left-sidebar');
  const src = opts.src || (b => b.outSrc || b.src);
  const chrome = fs.readFileSync(path.join(__dirname, 'theme.css'), 'utf8');
  const sections = deck.slides.map((s, i) =>
    `<section class="slide" data-screen-label="${String(i + 1).padStart(2, '0')}" data-type="${s.type}">${renderSlide(deck, s, { src })}</section>`
  ).join('\n');
  return `<!DOCTYPE html>
<html lang="${esc(deck.meta.lang || 'zh-CN')}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(deck.meta.title)} · 北京大学 HTML PPT</title>
<style>${baseCSS(t)}
${chrome}
${flowCSS(t)}</style>
</head>
<body>
<div id="stage"><div id="deck" style="--emphasis-color:${emphasisColor(deck.meta)}">
${sections}
</div></div>
${controlsHTML()}
<script>${runtimeJS(t, 'pku_left_slide')}</script>
</body>
</html>`;
}

module.exports = { render };
