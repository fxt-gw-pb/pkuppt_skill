'use strict';
/* =============================================================================
 * top-nav/renderer.js — render a laid-out deck with the PKU red top-horizontal
 * nav chrome + Part transition pages (1280×720). Same static-pre-render
 * contract as the left-sidebar renderer. Nav / TOC / Part numbering all come
 * from deck.sections, so 3 sections show 3, 7 show 7 — never hard-coded.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const { getTheme } = require('../../scripts/lib/theme');
const { esc } = require('../../scripts/lib/markdown');
const { renderBody, flowCSS, emphasisColor } = require('../../scripts/lib/render_blocks');
const { baseCSS, controlsHTML, runtimeJS } = require('../../scripts/lib/runtime');

const SEAL = 'assets/pku-seal.png';
const pad2 = n => String(n).padStart(2, '0');
const emblem = cls => `<img class="emblem ${cls}" src="${SEAL}" alt="北京大学校徽">`;

function renderCover(deck) {
  const m = deck.meta;
  const tlen = [...String(m.title || '')].length;
  const tsize = tlen <= 12 ? 80 : tlen <= 18 ? 64 : tlen <= 26 ? 52 : 44;
  return `<div class="cover-logo">${emblem('lg')}</div>
    <div class="cover-band-inner" style="--cover-title-size:${tsize}px">
      <div class="cover-title">${esc(m.title)}</div>
      <div class="cover-sub">${esc(m.subtitle)}</div>
    </div>
    <div class="cover-foot">
      <div class="row"><span>答辩人：${esc(m.presenter)}</span><span>指导老师：${esc(m.advisor)}</span></div>
      <span>答辩时间：${esc(m.date)}</span>
    </div>`;
}

function renderEnding(deck) {
  const m = deck.meta;
  return `<div class="cover-logo">${emblem('lg')}</div>
    <div class="cover-band-inner">
      <div class="end-title">感谢倾听！欢迎批评指正！</div>
      <div class="end-sub">Thanks for your listening!</div>
    </div>
    <div class="cover-foot">
      <div class="row"><span>答辩人：${esc(m.presenter)}</span><span>指导老师：${esc(m.advisor)}</span></div>
      <span>答辩时间：${esc(m.date)}</span>
    </div>`;
}

function renderContents(deck) {
  const t = getTheme('top-nav');
  const gap = t.toc.gap(deck.sections.length);
  const items = deck.sections.map((s, i) => `
    <div class="toc-item">
      <div class="num">${pad2(i + 1)}</div>
      <div class="t">${esc(s.title)}</div>
      <div class="line"></div>
    </div>`).join('');
  return `<div class="toc">
    <div class="toc-left"><div class="cn">目录</div><div class="en">CONTENTS</div><div class="deco"></div></div>
    <div class="toc-right" style="--toc-gap:${gap}px">${items}</div>
  </div>`;
}

function renderPart(deck, slide) {
  const idx = deck.sections.findIndex(s => s.id === slide.sectionId);
  const sec = deck.sections[idx] || {};
  return `<div class="cover-logo part-logo">${emblem('part')}</div>
    <div class="part-label">Part.${pad2(idx + 1)}</div>
    <div class="part-band-inner">
      <div class="part-cn">${esc(sec.title || '')}</div>
      <div class="part-en">${esc(sec.englishTitle || '')}</div>
    </div>`;
}

function navHTML(deck, activeId) {
  const t = getTheme('top-nav');
  const n = deck.sections.length;
  const fs2 = t.nav.fs(n), fsOn = t.nav.fsOn(n);
  const items = deck.sections.map(s => {
    const on = s.id === activeId;
    return `<div class="nav-item ${on ? 'on' : ''}" style="font-size:${on ? fsOn : fs2}px">${esc(s.title)}</div>`;
  }).join('');
  return `<div class="nav"><div class="nav-logo">${emblem('sm')}</div><div class="nav-items">${items}</div></div>`;
}

function renderContent(deck, slide, opts) {
  const t = getTheme('top-nav');
  const heading = slide.heading || '';
  const m = heading.match(/^[\d.]+/);
  let titleHtml;
  if (m) titleHtml = `<span class="no">${esc(m[0])}</span><span>${esc(heading.slice(m[0].length).trim())}</span>`;
  else titleHtml = `<span>${esc(heading)}</span>`;
  const bar = slide.subtitle ? `<div class="page-bar">${esc(slide.subtitle)}</div>` : '';
  const body = renderBody(t, slide, opts.src);
  return navHTML(deck, slide.sectionId)
    + `<div class="page-title">${titleHtml}</div>`
    + bar
    + `<div class="page-body ${slide.subtitle ? '' : 'no-bar'}">${body}</div>`;
}

function renderSlide(deck, slide, opts) {
  switch (slide.type) {
    case 'cover': return renderCover(deck);
    case 'contents': return renderContents(deck);
    case 'part': return renderPart(deck, slide);
    case 'content': return renderContent(deck, slide, opts);
    case 'ending': return renderEnding(deck);
    default: return `<div class="page-body"><div class="flow text-only">未知页型：${esc(slide.type)}</div></div>`;
  }
}

function render(deck, opts = {}) {
  const t = getTheme('top-nav');
  const src = opts.src || (b => b.outSrc || b.src);
  const chrome = fs.readFileSync(path.join(__dirname, 'theme.css'), 'utf8');
  const sections = deck.slides.map((s, i) => {
    const dark = s.type === 'cover' || s.type === 'part' || s.type === 'ending';
    const band = dark ? '<div class="band"></div>' : '';
    return `<section class="slide${dark ? ' slide--dark' : ''}" data-screen-label="${pad2(i + 1)}" data-type="${s.type}">${band}${renderSlide(deck, s, { src })}<div class="pagenum">${pad2(i + 1)}</div></section>`;
  }).join('\n');
  return `<!doctype html>
<html lang="${esc(deck.meta.lang || 'zh-CN')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
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
<script>${runtimeJS(t, 'pku_top_slide')}</script>
</body>
</html>`;
}

module.exports = { render };
