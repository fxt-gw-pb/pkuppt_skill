'use strict';
/* runtime.js — shared stage CSS, on-screen controls, and the tiny viewer
 * script (scale-to-fit + keyboard/click navigation + print). Identical for
 * both templates; only the design-space W×H differs. Slides are pre-rendered
 * static HTML, so this script never touches content — just shows/scales. */

const { PKU } = require('./theme');

function baseCSS(theme) {
  const { W, H } = theme;
  return `
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{background:#111;font-family:${PKU.fontSans};overflow:hidden}
*,*::before,*::after{-webkit-print-color-adjust:exact;print-color-adjust:exact}
#stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#111}
#deck{width:${W}px;height:${H}px;flex:none;flex-shrink:0;position:relative;transform-origin:center center}
.slide{position:absolute;inset:0;width:${W}px;height:${H}px;background:#fff;overflow:hidden;display:none}
.slide.active{display:block}
#nav{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;z-index:50;background:rgba(0,0,0,.5);border-radius:999px;padding:8px 16px;color:#fff;backdrop-filter:blur(4px);opacity:.85;transition:opacity .2s}
#nav:hover{opacity:1}
#nav button{appearance:none;border:none;background:transparent;color:#fff;font-size:20px;cursor:pointer;padding:4px 10px;border-radius:6px;line-height:1}
#nav button:hover{background:rgba(255,255,255,.18)}
#nav .count{font-size:14px;min-width:60px;text-align:center;letter-spacing:1px;opacity:.9;font-family:Arial,sans-serif}
@media print{
  @page{size:${W}px ${H}px;margin:0}
  html,body{background:#fff;overflow:visible}
  #stage{position:static;display:block;overflow:visible;background:#fff}
  #deck{transform:none!important;width:${W}px;height:${H}px}
  #nav{display:none!important}
  .slide{display:block!important;position:relative;page-break-after:always;break-after:page}
  .slide:last-child{page-break-after:auto}
}`;
}

function controlsHTML() {
  return `<div id="nav">
  <button id="prev" title="上一页 (←)">‹</button>
  <span class="count"><span id="cur">1</span> / <span id="total">1</span></span>
  <button id="next" title="下一页 (→)">›</button>
  <button id="print" title="打印 / 导出 PDF">⎙</button>
</div>`;
}

function runtimeJS(theme, storeKey) {
  const { W, H } = theme;
  return `(function(){
  var W=${W},H=${H},KEY=${JSON.stringify(storeKey)};
  var deck=document.getElementById('deck');
  var slides=[].slice.call(document.querySelectorAll('.slide'));
  var TOTAL=slides.length;
  var totalEl=document.getElementById('total'); if(totalEl) totalEl.textContent=TOTAL;
  var cur=Math.min(TOTAL-1,Math.max(0,parseInt((function(){try{return localStorage.getItem(KEY)}catch(e){return 0}})()||'0',10)||0));
  function show(i){cur=(i+TOTAL)%TOTAL;slides.forEach(function(el,k){el.classList.toggle('active',k===cur)});var c=document.getElementById('cur');if(c)c.textContent=cur+1;try{localStorage.setItem(KEY,cur)}catch(e){}}
  function fit(){var w=window.innerWidth,h=window.innerHeight;if(!w||!h)return;var s=Math.min(w/W,h/H);if(s>0)deck.style.transform='scale('+s+')';}
  window.addEventListener('resize',fit);window.addEventListener('load',fit);
  if(window.ResizeObserver){new ResizeObserver(fit).observe(document.documentElement);}
  var p=document.getElementById('prev'),n=document.getElementById('next'),pr=document.getElementById('print');
  if(p)p.onclick=function(){show(cur-1)};if(n)n.onclick=function(){show(cur+1)};if(pr)pr.onclick=function(){window.print()};
  window.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){show(cur+1);e.preventDefault();}
    else if(e.key==='ArrowLeft'||e.key==='PageUp'){show(cur-1);e.preventDefault();}
    else if(e.key==='Home')show(0);else if(e.key==='End')show(TOTAL-1);
  });
  requestAnimationFrame(fit);fit();show(cur);
})();`;
}

module.exports = { baseCSS, controlsHTML, runtimeJS };
