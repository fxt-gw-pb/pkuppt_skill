'use strict';
/* =============================================================================
 * render_blocks.js — turn a content slide's blocks into flowed HTML.
 *
 * The renderer drops ONE absolutely-positioned, fixed-size box at the
 * template's safe content area; everything below flows inside it with plain
 * flex/grid CSS. Flowed boxes can't overlap, object-fit:contain can't distort,
 * and max-width/height:100% keeps images inside their box — so the structural
 * guarantees the brief demands hold by construction. The analytic measurer
 * (measure.js) only has to confirm the flow is not TALLER than the box.
 *
 * `flowCSS(theme)` is injected identically by both templates so layout
 * behaviour is shared; only the chrome (cover/nav/title) differs per template.
 * ========================================================================== */

const { inline } = require('./markdown');
const { GAP } = require('./measure');

function capPx(theme) { return theme.type.caption; }

function figureHTML(b, src) {
  const cap = b.caption ? `<figcaption>${inline(b.caption)}</figcaption>` : '';
  if (b.missing) {
    return `<figure class="fig"><div class="miss">[缺图] ${inline(b.alt || b.src)}</div>${cap}</figure>`;
  }
  const url = b.outSrc || src(b) || b.src;
  const fit = b.fit === 'cover' ? 'cover' : 'contain';
  return `<figure class="fig"><div class="fig-box"><img src="${url}" alt="${inline(b.alt || '')}" style="object-fit:${fit}"></div>${cap}</figure>`;
}

function paraHTML(b) { return `<p class="tx">${inline(b.text)}</p>`; }
function listHTML(b) {
  const tag = b.ordered ? 'ol' : 'ul';
  const cls = b.ordered ? 'num' : 'bul';
  return `<${tag} class="${cls}">${b.items.map(it => `<li>${inline(it)}</li>`).join('')}</${tag}>`;
}
function tableHTML(b) {
  const head = b.headers && b.headers.length
    ? `<thead><tr>${b.headers.map(h => `<th>${inline(h)}</th>`).join('')}</tr></thead>` : '';
  const body = `<tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<div class="tablewrap"><table class="ppt">${head}${body}</table></div>`;
}

function textRun(blocks) {
  return blocks.map(b => b.kind === 'list' ? listHTML(b) : paraHTML(b)).join('');
}

/* render the inner flow for one content slide */
function renderBody(theme, slide, src) {
  const blocks = slide.blocks || [];
  const text = blocks.filter(b => b.kind === 'paragraph' || b.kind === 'list');
  const images = blocks.filter(b => b.kind === 'image');
  const tables = blocks.filter(b => b.kind === 'table');
  const layout = slide.layout || 'text-only';
  const vars = `--body:${slide.bodySize || theme.type.body[0]}px;--caption:${capPx(theme)}px;--gap:${GAP(theme)}px`;
  const wrap = inner => `<div class="flow ${layout}" style="${vars}">${inner}</div>`;

  switch (layout) {
    case 'text-only':
      return wrap(textRun(text));

    case 'table':
      return wrap(tables.map(tableHTML).join('') + textRun(text));

    case 'image-full':
      return wrap(images.map(im => figureHTML(im, src)).join(''));

    case 'text-image-right':
      return wrap(`<div class="col-text">${textRun(text)}</div><div class="col-img">${images.map(im => figureHTML(im, src)).join('')}</div>`);

    case 'image-text-right':
      return wrap(`<div class="col-img">${images.map(im => figureHTML(im, src)).join('')}</div><div class="col-text">${textRun(text)}</div>`);

    case 'text-image-bottom':
      return wrap(`<div class="col-text">${textRun(text)}</div><div class="col-img">${images.map(im => figureHTML(im, src)).join('')}</div>`);

    case 'image-grid-2':
    case 'image-grid': {
      const lead = text.length ? `<div class="lead">${textRun(text)}</div>` : '';
      const grid = `<div class="grid">${images.map(im => figureHTML(im, src)).join('')}</div>`;
      return wrap(lead + grid);
    }

    case 'three-points':
    case 'four-cards': {
      const pts = (text.find(b => b.kind === 'list') || { items: [] }).items;
      const items = pts.length ? pts : text.filter(b => b.kind === 'paragraph').map(b => b.text);
      const cls = layout === 'three-points' ? 'three' : 'cards';
      const cards = items.map((t, i) => `<div class="card-pku"><div class="n">${String(i + 1).padStart(2, '0')}</div><div class="t">${inline(t)}</div></div>`).join('');
      return wrap(`<div class="${cls}">${cards}</div>`);
    }

    case 'timeline': {
      const steps = (text.find(b => b.kind === 'list') || { items: [] }).items;
      const html = steps.map((t, i) => `<div class="step"><div class="idx">${i + 1}</div><div class="t">${inline(t)}</div></div>`).join('');
      return wrap(`<div class="steps">${html}</div>`);
    }

    case 'comparison': {
      const mid = Math.ceil(text.length / 2);
      const left = textRun(text.slice(0, mid));
      const right = textRun(text.slice(mid)) + images.map(im => figureHTML(im, src)).join('');
      return wrap(`<div class="cmp"><div>${left}</div><div>${right}</div></div>`);
    }

    default:
      return wrap(textRun(text) + images.map(im => figureHTML(im, src)).join(''));
  }
}

/* layout CSS shared by both templates (chrome lives in each theme.css) */
function flowCSS(theme) {
  return `
.flow{position:absolute;inset:0;}
.flow .tx{font-size:var(--body);line-height:1.7;color:#222;margin:0 0 .55em;}
.flow .tx:last-child{margin-bottom:0;}
.flow .bul,.flow .num{margin:0;padding:0;list-style:none;}
.flow .num{counter-reset:li;}
.flow .bul li,.flow .num li{position:relative;padding-left:1.2em;font-size:var(--body);line-height:1.7;margin:.22em 0;color:#222;}
.flow .bul li::before{content:"";position:absolute;left:.05em;top:.62em;width:.46em;height:.46em;background:var(--pku-red);}
.flow .num li{counter-increment:li;}
.flow .num li::before{content:counter(li)".";position:absolute;left:0;color:var(--pku-red);font-weight:700;}
.emphasis{font-weight:700;color:var(--emphasis-color,var(--pku-red));}
.flow strong{font-weight:700;}
.flow .fig{margin:0;display:flex;flex-direction:column;min-height:0;height:100%;}
.flow .fig-box{flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.flow .fig-box img{max-width:100%;max-height:100%;width:auto;height:auto;object-position:center center;display:block;}
.flow figcaption{flex:0 0 auto;margin-top:.5em;text-align:center;font-size:var(--caption);color:#5a5a5a;line-height:1.4;}
.flow .miss{flex:1;display:flex;align-items:center;justify-content:center;border:1px dashed #ccc;color:#999;font-size:var(--caption);}
.flow.text-image-right,.flow.image-text-right{display:flex;gap:var(--gap);align-items:stretch;}
.flow.text-image-right .col-text{flex:0 0 54%;}
.flow.text-image-right .col-img{flex:1 1 auto;min-width:0;}
.flow.image-text-right .col-img{flex:1 1 auto;min-width:0;}
.flow.image-text-right .col-text{flex:0 0 46%;}
.flow.text-image-bottom{display:flex;flex-direction:column;gap:var(--gap);}
.flow.text-image-bottom .col-text{flex:0 0 auto;}
.flow.text-image-bottom .col-img{flex:1 1 auto;min-height:0;}
.flow.image-full{display:flex;flex-direction:column;}
.flow.image-grid .grid,.flow.image-grid-2 .grid{display:grid;gap:var(--gap);height:100%;min-height:0;}
.flow.image-grid-2 .grid{grid-template-columns:1fr 1fr;}
.flow.image-grid .grid{grid-template-columns:1fr 1fr;grid-auto-rows:1fr;}
.flow.image-grid .lead,.flow.image-grid-2 .lead{margin-bottom:var(--gap);}
.flow .lead .tx,.flow .lead li{font-size:var(--body);}
.flow.three-points .three{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--gap);height:100%;}
.flow.four-cards .cards{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:var(--gap);height:100%;}
.card-pku{background:#fff;border:1px solid #e3c9c9;border-top:6px solid var(--pku-red);padding:calc(var(--gap)*.7);display:flex;flex-direction:column;gap:.35em;}
.card-pku .n{font-size:1.5em;font-weight:700;color:var(--pku-red);font-family:Arial,sans-serif;line-height:1;}
.card-pku .t{font-size:var(--body);line-height:1.55;color:#333;}
.flow.comparison .cmp{display:flex;gap:var(--gap);height:100%;}
.flow.comparison .cmp>div{flex:1;}
.flow.timeline .steps{display:flex;flex-direction:column;gap:.55em;}
.flow.timeline .step{display:flex;gap:.7em;align-items:flex-start;font-size:var(--body);line-height:1.6;}
.flow.timeline .step .idx{flex:0 0 auto;width:1.7em;height:1.7em;border-radius:50%;background:var(--pku-red);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85em;}
.tablewrap{width:100%;overflow:hidden;}
table.ppt{border-collapse:collapse;width:100%;font-size:var(--body);}
table.ppt th{background:var(--pku-red);color:#fff;font-weight:700;}
table.ppt th,table.ppt td{border:1px solid #d3d3d3;padding:.4em .7em;text-align:left;line-height:1.5;}
table.ppt tr:nth-child(even) td{background:#faf4f4;}
`;
}

/* emphasis (**bold**) colour, controllable per deck via meta.emphasis */
function emphasisColor(meta) {
  return ({ 'pku-red': '#9E0000', dark: '#262626', plain: 'inherit' })[(meta && meta.emphasis) || 'pku-red'] || '#9E0000';
}

module.exports = { renderBody, flowCSS, figureHTML, emphasisColor };
