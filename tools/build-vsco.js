#!/usr/bin/env node
// Builds the VSCO 2 CE packs (CC0 1.0, Versilian Studios) in packs/ from
// a checkout of sgossner/VSCO-2-CE: the samples (branch master) and the
// SFZ files (branch SFZ, here as a folder of .sfz).
//
//   node tools/build-vsco.js <VSCO-2-CE checkout> <folder with its .sfz files>
//
// Each pack is reduced so that it downloads quickly in orOS Studio:
// at most `vel` velocity layers per key range (the louder ones; the others
// are dropped and the kept ones widened to cover 0-127), the first round robin only,
// leading silence trimmed (3 ms kept), long tails cut at `len` seconds
// with a fade, MP3 (LAME VBR V2, 44.1 kHz). The player in Studio skips
// the MP3 encoder's leading zeros itself, whichever browser decodes.
// Needs ffmpeg with libmp3lame. Writes packs/<id>/ and packs/index.json
// (keeps the entries of other builders, e.g. build-own.js).
"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const SFZ = require("./sfz-read.js");

// id, name, category, VSCO sfz, velocity layers kept, longest sample (s),
// built-in sound of the same kind (what an older Studio plays instead)
// Organ, harp, pizzicato violins, mallets and timpani were removed on 2026-10-31: Studio plays
// them with the NULL JSFX instruments (Organ Pipe voice, Pluck, Mallets) since NULL JSFX 2.8.
const PACKS = [
  ["vsco-upright-piano", "Upright Piano", "Keys", "UprightPiano", 2, 6, "piano"],
  ["vsco-violins", "Violin Section", "Strings", "ViolinEnsSusVib", 2, 8, "strings"],
  ["vsco-violas", "Viola Section", "Strings", "ViolaEnsSusVib", 2, 8, "strings"],
  ["vsco-cellos", "Cello Section", "Strings", "CelloEnsSusVib", 2, 8, "strings"],
  ["vsco-contrabass", "Contrabass", "Strings", "ContrabassSusVB", 2, 8, "bass"],
  ["vsco-flute", "Flute", "Woodwinds", "FluteSusVib", 2, 8, "lead"],
  ["vsco-oboe", "Oboe", "Woodwinds", "OboeSusVib", 2, 8, "lead"],
  ["vsco-clarinet", "Clarinet", "Woodwinds", "ClarinetSus", 2, 8, "lead"],
  ["vsco-bassoon", "Bassoon", "Woodwinds", "BassoonSus", 2, 8, "lead"],
  ["vsco-horn", "French Horn", "Brass", "FHornSus", 2, 8, "lead"],
  ["vsco-trumpet", "Trumpet", "Brass", "TrumpetSus", 2, 8, "lead"],
  ["vsco-trombone", "Trombone", "Brass", "TromboneSus", 2, 8, "lead"],
  ["vsco-tuba", "Tuba", "Brass", "TubaSus", 2, 8, "bass"],
  ["vsco-percussion", "Orchestral Percussion", "Percussion", "GM-StylePerc", 2, 6, "drums"]
];
// the names in Studio's other languages (Studio shows `name` otherwise)
const NAMES = {
 "Upright Piano": {
  "el": "Όρθιο πιάνο",
  "de": "Klavier"
 },
 "Pipe Organ": {
  "el": "Εκκλησιαστικό όργανο",
  "de": "Pfeifenorgel"
 },
 "Violin Section": {
  "el": "Βιολιά (ομάδα)",
  "de": "Violinen"
 },
 "Viola Section": {
  "el": "Βιόλες (ομάδα)",
  "de": "Bratschen"
 },
 "Cello Section": {
  "el": "Τσέλα (ομάδα)",
  "de": "Celli"
 },
 "Contrabass": {
  "el": "Κοντραμπάσο",
  "de": "Kontrabass"
 },
 "Violins Pizzicato": {
  "el": "Βιολιά πιτσικάτο",
  "de": "Violinen pizzicato"
 },
 "Harp": {
  "el": "Άρπα",
  "de": "Harfe"
 },
 "Flute": {
  "el": "Φλάουτο",
  "de": "Flöte"
 },
 "Oboe": {
  "el": "Όμποε",
  "de": "Oboe"
 },
 "Clarinet": {
  "el": "Κλαρινέτο",
  "de": "Klarinette"
 },
 "Bassoon": {
  "el": "Φαγκότο",
  "de": "Fagott"
 },
 "French Horn": {
  "el": "Κόρνο",
  "de": "Horn"
 },
 "Trumpet": {
  "el": "Τρομπέτα",
  "de": "Trompete"
 },
 "Trombone": {
  "el": "Τρομπόνι",
  "de": "Posaune"
 },
 "Tuba": {
  "el": "Τούμπα",
  "de": "Tuba"
 },
 "Glockenspiel": {
  "el": "Γκλόκενσπιλ",
  "de": "Glockenspiel"
 },
 "Marimba": {
  "el": "Μαρίμπα",
  "de": "Marimba"
 },
 "Xylophone": {
  "el": "Ξυλόφωνο",
  "de": "Xylofon"
 },
 "Timpani": {
  "el": "Τύμπανα (timpani)",
  "de": "Pauken"
 },
 "Orchestral Percussion": {
  "el": "Ορχηστρικά κρουστά",
  "de": "Orchesterschlagwerk"
 },
 "Tubular Bells": {
  "el": "Σωληνωτές καμπάνες",
  "de": "Röhrenglocken"
 }
};
const FADE = 0.5;
const PASS = ["lokey", "hikey", "pitch_keycenter", "lovel", "hivel", "volume", "tune", "transpose", "pan",
  "ampeg_attack", "ampeg_hold", "ampeg_decay", "ampeg_sustain", "ampeg_release"];

function num(v, d) { const n = SFZ.note(v); return isNaN(n) ? d : n; }

// keep `max` velocity layers of each key range, spread over 0..127
function reduce(regions, max) {
  const byKey = new Map();
  regions.forEach((r) => {
    if (r.trigger && r.trigger !== "attack") return;
    if (r.seq_position && +r.seq_position !== 1) return;
    if (r.lorand && +r.lorand > 0) return;
    if (r.sw_last != null) return;                      // keyswitched articulations are other instruments
    const k = num(r.lokey, 0) + ":" + num(r.hikey, 127);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  });
  const out = [];
  byKey.forEach((list) => {
    list.sort((a, b) => num(a.lovel, 0) - num(b.lovel, 0));
    let keep = list;
    if (list.length > max) {
      keep = [];
      for (let i = 0; i < max; i++) keep.push(list[Math.round((list.length - 1) * (i + 1) / max)]);   // the louder layers; velocity scales them down for soft notes
      keep = keep.filter((r, i) => keep.indexOf(r) === i);
    }
    keep.forEach((r, i) => {
      const c = Object.assign({}, r);
      // the boundary between two kept layers: where the upper one started
      c.lovel = i === 0 ? 0 : num(r.lovel, 0);
      c.hivel = i === keep.length - 1 ? 127 : num(keep[i + 1].lovel, 1) - 1;
      out.push(c);
    });
  });
  return out.sort((a, b) => num(a.lokey, 0) - num(b.lokey, 0) || a.lovel - b.lovel);
}

function fileName(s) {
  return path.basename(s).replace(/\.[^.]+$/, "").replace(/#/g, "s").replace(/[^A-Za-z0-9_-]+/g, "_").toLowerCase() + ".mp3";
}

function duration(f) {
  return +cp.execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim();
}

function encode(src, dest, len) {
  // trim silence before the first sound above -60 dBFS (3 ms kept), cut and fade the tail
  const head = "silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.003";
  const d = duration(src);
  const af = [head, "aresample=44100"];
  if (d > len) af.push("atrim=0:" + len, "afade=t=out:st=" + (len - FADE) + ":d=" + FADE);
  cp.execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-af", af.join(","), "-ar", "44100", "-c:a", "libmp3lame", "-q:a", "2", dest]);
}

function sfzText(p, regions, glob) {
  const lines = [
    "// " + p.name + " (VSCO 2 CE, reduced for orOS Studio by koulaxizis/oros-sounds)",
    "// Samples: VS Chamber Orchestra: Community Edition, Versilian Studios",
    "// (Sam Gossner, Simon Dalzell; sample cutting Elan Hickler/Soundemote). CC0 1.0.",
    "<global>"
  ];
  Object.keys(glob).forEach((k) => lines.push(k + "=" + glob[k]));
  regions.forEach((r) => {
    const ops = ["sample=" + r.file];
    PASS.forEach((k) => { if (r[k] != null && !(k in glob && glob[k] === r[k])) ops.push(k + "=" + r[k]); });
    lines.push("<region> " + ops.join(" "));
  });
  return lines.join("\n") + "\n";
}

function main() {
  const [src, sfzDir] = process.argv.slice(2);
  if (!src || !sfzDir) { console.error("usage: build-vsco.js <VSCO-2-CE checkout> <sfz folder>"); process.exit(2); }
  const root = path.join(__dirname, "..", "packs");
  fs.mkdirSync(root, { recursive: true });
  const idxFile = path.join(root, "index.json");
  const old = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, "utf8")) : { version: 1, packs: [] };
  const packs = old.packs.filter((p) => !/^vsco-/.test(p.id));
  const licence = fs.readFileSync(path.join(src, "LICENSE"), "utf8");
  let rev = "";
  try { rev = cp.execFileSync("git", ["-C", src, "rev-parse", "HEAD"]).toString().trim(); } catch (e) {}
  PACKS.forEach(([id, name, cat, sfz, vel, len, kind]) => {
    const p = { id, name };
    const dir = path.join(root, id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const parsed = SFZ.parse(fs.readFileSync(path.join(sfzDir, sfz + ".sfz"), "latin1"));
    const regions = reduce(parsed.regions, vel);
    // opcodes every region shares go to <global>
    const glob = {};
    ["ampeg_attack", "ampeg_release"].forEach((k) => {
      const v = regions[0] && regions[0][k];
      if (v != null && regions.every((r) => r[k] === v)) glob[k] = v;
    });
    const done = {};
    let bytes = 0;
    regions.forEach((r) => {
      r.file = fileName(r.sample);
      if (done[r.file] && done[r.file] !== r.sample) throw new Error(id + ": two samples named " + r.file);
      if (!done[r.file]) {
        encode(path.join(src, r.sample), path.join(dir, r.file), len);
        done[r.file] = r.sample;
        bytes += fs.statSync(path.join(dir, r.file)).size;
      }
    });
    const text = sfzText(p, regions, glob);
    fs.writeFileSync(path.join(dir, "instrument.sfz"), text);
    fs.writeFileSync(path.join(dir, "LICENSE.txt"), licence);
    bytes += Buffer.byteLength(text);
    const files = Object.keys(done).sort();
    packs.push({
      id, name, names: NAMES[name], category: cat, kind, lic: "cc0",
      by: "Versilian Studios (VSCO 2 CE)", url: "https://github.com/sgossner/VSCO-2-CE",
      sfz: "instrument.sfz", files: files.length, bytes,
      keys: [Math.min(...regions.map((r) => num(r.lokey, 0))), Math.max(...regions.map((r) => num(r.hikey, 127)))],
      layers: vel
    });
    console.log(id + ": " + regions.length + " regions, " + files.length + " samples, " + (bytes / 1e6).toFixed(1) + " MB");
  });
  packs.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const idx = { version: 1, packs };
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 1) + "\n");
  fs.writeFileSync(path.join(root, "vsco-release.txt"), "sgossner/VSCO-2-CE " + rev + "\n");
  console.log("packs: " + packs.length + ", " + (packs.reduce((n, p) => n + p.bytes, 0) / 1e6).toFixed(1) + " MB");
}
main();
