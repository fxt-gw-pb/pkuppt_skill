'use strict';
/* markdown.js — tiny, dependency-free inline helpers shared across scripts.
 * We deliberately support ONLY what the PKU outline format needs. */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

/* Inline markdown → safe HTML. Escapes first, then re-introduces a closed set
 * of inline marks. **bold** becomes the PKU emphasis span (the one rule the
 * brief insists on preserving). */
function inline(s) {
  let t = esc(s);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong class="emphasis">$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  return t;
}

/* true if the markdown text contains a **bold** run (used by critique). */
function hasBold(s) { return /\*\*[^*]+\*\*/.test(String(s || '')); }

/* deterministic, url-safe id from a (possibly Chinese) string */
function slug(s, fallback) {
  const base = String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || fallback || '';
}

/* plain text (strip the inline marks) — for length/measurement */
function plain(s) {
  return String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

module.exports = { esc, inline, hasBold, slug, plain };
