'use strict';
/* =============================================================================
 * parse_outline.js — Markdown outline  ->  parsed deck skeleton.
 *
 * Recognises the PKU outline format (see docs/OUTLINE_FORMAT.md):
 *   ---  front matter (template/title/subtitle/presenter/advisor/date/lang) ---
 *   #  目录                      ignored label
 *   ## Section          english: <EN>     -> a section (drives nav + TOC + Part)
 *   ### Page heading                       -> a content page
 *   paragraph text · - bullet · ![alt](src) · caption: · | md table |
 *   **bold** is preserved downstream as the emphasis style.
 *
 * It does NOT lay anything out, split, or render — it only structures the
 * author's content faithfully (no reordering, no deletion). Usage:
 *   node parse_outline.js outline.md            # prints JSON
 * ========================================================================== */

const fs = require('fs');
const yaml = require('./lib/yaml');
const { slug } = require('./lib/markdown');

function splitFrontMatter(src) {
  const m = src.match(/^﻿?---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (m) return { meta: yaml.parse(m[1]) || {}, body: m[2] };
  return { meta: {}, body: src };
}

function parseTableRow(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
}
const isTableSep = l => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l) && /-/.test(l);

function parseOutline(src) {
  src = String(src).replace(/\r\n?/g, '\n');
  const { meta, body } = splitFrontMatter(src);
  const lines = body.split('\n');

  const sections = [];
  const pages = [];
  let curSection = null;
  let curPage = null;
  const usedIds = new Set();

  function newId(seed, n) {
    let id = slug(seed, `sec${n}`);
    if (!id) id = `sec${n}`;
    let final = id, k = 2;
    while (usedIds.has(final)) final = `${id}-${k++}`;
    usedIds.add(final);
    return final;
  }
  function ensurePage() {
    if (!curPage) {
      if (!curSection) { curSection = { id: newId('section', sections.length + 1), title: '正文', englishTitle: '' }; sections.push(curSection); }
      curPage = { sectionId: curSection.id, heading: '', blocks: [], layout: null };
      pages.push(curPage);
    }
    return curPage;
  }
  function pushBlock(b) { ensurePage().blocks.push(b); }
  let para = [];           // pending paragraph lines
  function flushPara() {
    if (para.length) { pushBlock({ kind: 'paragraph', text: para.join(' ').trim() }); para = []; }
  }
  let list = null;         // pending list
  function flushList() { if (list) { pushBlock(list); list = null; } }
  let table = null;        // pending table

  function flushTable() {
    if (table && table.rows.length) pushBlock({ kind: 'table', headers: table.headers, rows: table.rows });
    table = null;
  }
  function flushInline() { flushPara(); flushList(); flushTable(); }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    // ----- table accumulation -----
    if (/^\|.*\|/.test(line)) {
      flushPara(); flushList();
      const cells = parseTableRow(line);
      if (!table) { table = { headers: cells, rows: [] }; }
      else if (isTableSep(line)) { /* separator row, skip */ }
      else { table.rows.push(cells); }
      continue;
    } else if (table) { flushTable(); }

    if (line === '') { flushPara(); flushList(); continue; }

    // ----- headings -----
    let m;
    if ((m = line.match(/^#\s+(.*)$/))) { flushInline(); continue; } // TOC label, ignore
    if ((m = line.match(/^##\s+(.*)$/))) {
      flushInline(); curPage = null;
      curSection = { id: newId(m[1], sections.length + 1), title: m[1].trim(), englishTitle: '' };
      sections.push(curSection);
      continue;
    }
    if ((m = line.match(/^###\s+(.*)$/))) {
      flushInline();
      if (!curSection) { curSection = { id: newId('section', sections.length + 1), title: '正文', englishTitle: '' }; sections.push(curSection); }
      curPage = { sectionId: curSection.id, heading: m[1].trim(), blocks: [], layout: null };
      pages.push(curPage);
      continue;
    }

    // ----- directives -----
    if ((m = line.match(/^english\s*[:：]\s*(.*)$/i))) {
      if (curSection) curSection.englishTitle = m[1].trim();
      continue;
    }
    if ((m = line.match(/^layout\s*[:：]\s*(.*)$/i))) {
      flushInline(); ensurePage().layout = m[1].trim();
      continue;
    }
    if ((m = line.match(/^caption\s*[:：]\s*(.*)$/i))) {
      // attach to last image block on the current page
      const p = ensurePage();
      const lastImg = [...p.blocks].reverse().find(b => b.kind === 'image' && !b.caption);
      if (lastImg) lastImg.caption = m[1].trim();
      else pushBlock({ kind: 'paragraph', text: m[1].trim() });
      continue;
    }

    // ----- image -----
    if ((m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*(.*)$/))) {
      flushPara(); flushList();
      const img = { kind: 'image', alt: m[1].trim(), src: m[2].trim(), caption: '' };
      // inline caption after the image on same line?
      const trailing = m[3] && m[3].replace(/^caption\s*[:：]\s*/i, '').trim();
      if (trailing) img.caption = trailing;
      pushBlock(img);
      continue;
    }

    // ----- list item -----
    if ((m = line.match(/^([-*+]|\d+[.)])\s+(.*)$/))) {
      flushPara();
      const ordered = /\d/.test(m[1]);
      if (!list || list.ordered !== ordered) { flushList(); list = { kind: 'list', ordered, items: [] }; }
      list.items.push(m[2].trim());
      continue;
    }

    // ----- plain paragraph text -----
    flushList();
    para.push(line);
  }
  flushInline();

  return { meta: meta || {}, sections, pages };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node parse_outline.js <outline.md>'); process.exit(1); }
  const out = parseOutline(fs.readFileSync(file, 'utf8'));
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

module.exports = { parseOutline, splitFrontMatter };
