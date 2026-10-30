// Reads the plain SFZ files of an existing library (the subset VSCO 2 CE
// and Salamander use): headers <control> <global> <master> <group>
// <region>, opcodes as key=value, // comments. Returns the regions with
// every inherited opcode copied in, and default_path folded into sample.
// Only for building packs; Studio has its own reader (studio/sfz.js).
"use strict";

function strip(text) {
  return String(text).replace(/\r/g, "").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function tokens(text) {
  const out = [];
  const re = /<(\w+)>|([A-Za-z0-9_]+)=/g;
  let m, last = null;
  const s = strip(text);
  while ((m = re.exec(s))) {
    if (last) { last.value = s.slice(last.end, m.index).trim(); out.push(last); last = null; }
    if (m[1]) out.push({ header: m[1].toLowerCase() });
    else last = { key: m[2].toLowerCase(), end: re.lastIndex };
  }
  if (last) { last.value = s.slice(last.end).trim(); out.push(last); }
  return out;
}

function resolve(text) {
  const lv = { control: {}, global: {}, master: {}, group: {} };
  const regions = [];
  let where = null, cur = null;
  tokens(text).forEach((t) => {
    if (t.header) {
      where = t.header;
      if (where === "region") {
        cur = Object.assign({}, lv.global, lv.master, lv.group);
        regions.push(cur);
        return;
      }
      cur = null;
      if (where === "global") { lv.global = {}; lv.master = {}; lv.group = {}; }
      else if (where === "master") { lv.master = {}; lv.group = {}; }
      else if (where === "group") lv.group = {};
      else if (where === "control") lv.control = {};
      return;
    }
    if (where === "region" && cur) cur[t.key] = t.value;
    else if (lv[where]) lv[where][t.key] = t.value;
  });
  const dp = (lv.control.default_path || "").replace(/\\/g, "/");
  regions.forEach((r) => {
    if (r.sample) r.sample = (dp + r.sample).replace(/\\/g, "/");
    if (r.key != null) { r.lokey = r.hikey = r.pitch_keycenter = r.key; delete r.key; }
  });
  return { regions, control: lv.control };
}

const NOTES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
// 60, "c4", "C#4", "db4" → MIDI note (c4 = 60), or NaN
function note(v) {
  if (v == null) return NaN;
  const s = String(v).trim().toLowerCase();
  if (/^-?\d+$/.test(s)) return +s;
  const m = /^([a-g])([#b]?)(-?\d+)$/.exec(s);
  if (!m) return NaN;
  return (+m[3] + 1) * 12 + NOTES[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

module.exports = { parse: resolve, note, tokens };
