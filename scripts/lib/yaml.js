'use strict';
/* yaml.js — minimal indentation-based YAML reader (no dependencies).
 * Supports exactly what this skill needs: flat scalars, nested maps, and
 * lists of scalars or maps. Not a general YAML implementation. */

function coerce(v) {
  const s = v.trim().replace(/^["']|["']$/g, '');
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~' || s === '') return s === '' ? '' : null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function parse(src) {
  const lines = String(src || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter(l => l.trim() !== '' && !/^\s*#/.test(l));
  let i = 0;

  function indentOf(l) { return l.match(/^\s*/)[0].length; }

  function parseBlock(minIndent) {
    // list?
    if (i < lines.length && /^\s*-\s/.test(lines[i]) && indentOf(lines[i]) >= minIndent) {
      const arr = [];
      const ind = indentOf(lines[i]);
      while (i < lines.length && indentOf(lines[i]) === ind && /^\s*-\s/.test(lines[i])) {
        const rest = lines[i].replace(/^\s*-\s/, '');
        const childIndent = ind + 2;
        if (/^[^:\n]+:\s*(.*)$/.test(rest)) {
          // first key of an inline map item
          lines[i] = ' '.repeat(childIndent) + rest;
          arr.push(parseMap(childIndent));
        } else {
          arr.push(coerce(rest));
          i++;
        }
      }
      return arr;
    }
    return parseMap(minIndent);
  }

  function parseMap(minIndent) {
    const obj = {};
    while (i < lines.length) {
      const ind = indentOf(lines[i]);
      if (ind < minIndent) break;
      if (ind > minIndent) { i++; continue; }
      const m = lines[i].match(/^\s*([^:\n]+):\s*(.*)$/);
      if (!m) break;
      const key = m[1].trim();
      const val = m[2];
      i++;
      if (val.trim() === '') {
        // nested block (map or list)
        if (i < lines.length && indentOf(lines[i]) > minIndent) {
          obj[key] = parseBlock(indentOf(lines[i]));
        } else {
          obj[key] = null;
        }
      } else {
        obj[key] = coerce(val);
      }
    }
    return obj;
  }

  if (!lines.length) return {};
  return parseBlock(indentOf(lines[0]));
}

module.exports = { parse, coerce };
