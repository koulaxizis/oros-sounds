#!/usr/bin/env node
// Builds the Salamander Grand Piano pack (Alexander Holm, CC BY 3.0) in
// packs/salamander-grand-piano/ from a checkout of
// sfzinstruments/SalamanderGrandPiano (samples in Samples/, the key map
// in Data/region.txt, the velocity layers in Data/notes.txt).
//
//   node tools/build-salamander.js <SalamanderGrandPiano checkout>
//
// The original's .sfz needs ARIA extensions (#include, #define, CC
// controls); this pack is written from its data instead: the 30 notes
// sampled in minor thirds, natural tuning, 4 of the 16 velocity layers
// (5, 10, 14, 16, each widened down to the next kept one), no release
// noises, leading silence trimmed (3 ms kept), tails cut at 7 s with a
// fade, MP3 V2 44.1 kHz. CC BY asks for the credit and a note of the
// changes: both are in the .sfz header, LICENSE.txt and the index.
// Needs ffmpeg with libmp3lame. Updates packs/index.json.
"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ID = "salamander-grand-piano";
const LAYERS = [5, 10, 14, 16];
const LEN = 7, FADE = 0.5, VELTRACK = 50, RELEASE = 1;

function encode(src, dest) {
  const d = +cp.execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).toString().trim();
  const af = ["silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.003", "aresample=44100"];
  if (d > LEN) af.push("atrim=0:" + LEN, "afade=t=out:st=" + (LEN - FADE) + ":d=" + FADE);
  cp.execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-af", af.join(","), "-ar", "44100", "-c:a", "libmp3lame", "-q:a", "2", dest]);
}

function main() {
  const src = process.argv[2];
  if (!src) { console.error("usage: build-salamander.js <SalamanderGrandPiano checkout>"); process.exit(2); }
  const regionTxt = fs.readFileSync(path.join(src, "Data", "region.txt"), "utf8");
  const notesTxt = fs.readFileSync(path.join(src, "Data", "notes.txt"), "utf8");
  // velocity layer N → its top velocity in the original
  const top = {};
  notesTxt.replace(/vel_(\d+)\.txt" lovel=(\d+) hivel=(\d+)/g, (m, n, lo, hi) => { top[+n] = +hi; });
  const keys = [];
  regionTxt.split("\n").forEach((l) => {
    const m = /lokey=(\d+) hikey=(\d+) pitch_keycenter=(\d+) sample=([A-G]#?\d)\$VEL/.exec(l);
    if (!m) return;
    const rel = /ampeg_release=([\d.]+)/.exec(l);
    keys.push({ lo: +m[1], hi: +m[2], center: +m[3], note: m[4], release: rel ? rel[1] : null });
  });
  if (keys.length !== 30) throw new Error("expected 30 notes, found " + keys.length);
  const root = path.join(__dirname, "..", "packs");
  const dir = path.join(root, ID);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const lines = [
    "// Salamander Grand Piano V3 (Yamaha C5) by Alexander Holm, CC BY 3.0",
    "// https://archive.org/details/SalamanderGrandPianoV3 (SFZ by kinwie, sfzinstruments/SalamanderGrandPiano)",
    "// Changed for orOS Studio by koulaxizis/oros-sounds: 4 of 16 velocity layers, no release noises,",
    "// leading silence trimmed, tails cut at " + LEN + " s with a fade, MP3. Not endorsed by the author.",
    "<global>",
    "ampeg_release=" + RELEASE,
    "amp_veltrack=" + VELTRACK
  ];
  let bytes = 0, files = 0;
  keys.forEach((k) => {
    LAYERS.forEach((v, i) => {
      const lovel = i === 0 ? 1 : top[LAYERS[i - 1]] + 1, hivel = i === LAYERS.length - 1 ? 127 : top[v];
      const name = k.note.replace("#", "s").toLowerCase() + "v" + v + ".mp3";
      encode(path.join(src, "Samples", k.note + "v" + v + ".flac"), path.join(dir, name));
      bytes += fs.statSync(path.join(dir, name)).size;
      files++;
      lines.push("<region> sample=" + name + " lokey=" + k.lo + " hikey=" + k.hi + " pitch_keycenter=" + k.center +
        " lovel=" + (i === 0 ? 0 : lovel) + " hivel=" + hivel + (k.release ? " ampeg_release=" + k.release : ""));
    });
  });
  const text = lines.join("\n") + "\n";
  fs.writeFileSync(path.join(dir, "instrument.sfz"), text);
  bytes += Buffer.byteLength(text);
  fs.writeFileSync(path.join(dir, "LICENSE.txt"),
    "Salamander Grand Piano V3 by Alexander Holm, licensed under CC BY 3.0\n" +
    "(https://creativecommons.org/licenses/by/3.0/). Source: https://archive.org/details/SalamanderGrandPianoV3\n" +
    "SFZ mapping by kinwie (https://github.com/sfzinstruments/SalamanderGrandPiano).\n" +
    "Changes in this pack (koulaxizis/oros-sounds): 4 of the 16 velocity layers, no release noises, leading\n" +
    "silence trimmed, tails cut at " + LEN + " s with a fade, encoded as MP3. Not endorsed by the author.\n\n" +
    fs.readFileSync(path.join(src, "LICENSE"), "utf8"));
  const idxFile = path.join(root, "index.json");
  const idx = JSON.parse(fs.readFileSync(idxFile, "utf8"));
  idx.packs = idx.packs.filter((p) => p.id !== ID);
  idx.packs.push({
    id: ID, name: "Grand Piano", names: { el: "Πιάνο με ουρά", de: "Flügel" }, category: "Keys", kind: "piano", lic: "by",
    by: "Alexander Holm (Salamander Grand Piano V3)", url: "https://archive.org/details/SalamanderGrandPianoV3",
    sfz: "instrument.sfz", files, bytes, keys: [21, 108], layers: LAYERS.length
  });
  idx.packs.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 1) + "\n");
  let rev = "";
  try { rev = cp.execFileSync("git", ["-C", src, "rev-parse", "HEAD"]).toString().trim(); } catch (e) {}
  fs.writeFileSync(path.join(root, "salamander-release.txt"), "sfzinstruments/SalamanderGrandPiano " + rev + "\n");
  console.log(ID + ": " + files + " samples, " + (bytes / 1e6).toFixed(1) + " MB");
}
main();
