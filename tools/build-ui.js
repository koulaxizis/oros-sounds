#!/usr/bin/env node
// Builds ui/: the interface sound packs orOS plays for taps, switches and
// opening and closing apps and panels (Settings › Sound › Interface
// sounds, off by default). Made only from this repository's own CC0
// VSCO 2 CE files in packs/ (Versilian Studios), so nothing new comes in.
//
//   node tools/build-ui.js
//
// Each sound: leading silence trimmed, cut short with a fade-out, its peak
// set to the pack's level, mono, MP3 44.1 kHz 96 kb/s. ui/index.json lists the packs with names in
// EN/EL/DE, licence, author and source. Needs ffmpeg on the PATH.
"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "ui");
const VSCO = { lic: "cc0", by: "Versilian Studios (VSCO 2 CE)", url: "https://github.com/sgossner/VSCO-2-CE" };
const SOUNDS = ["tap", "on", "off", "open", "close"];
// pack id, names EN/EL/DE, then sound → [file under packs/, length s, peak dB, rate factor]
const PACKS = [
  ["pebble", ["Pebble", "Βότσαλο", "Kiesel"], {
    tap: ["vsco-percussion/claves1_hit_v2_rr1_sum.mp3", 0.09, -14, 1],
    on: ["vsco-percussion/logdrumhi_medm_v2_rr1_sum.mp3", 0.16, -12, 1],
    off: ["vsco-percussion/logdrumlo_medm_v2_rr1_sum.mp3", 0.16, -12, 1],
    open: ["vsco-percussion/quinto-hitn_v2_rr1_sum.mp3", 0.22, -11, 1],
    close: ["vsco-percussion/tumba-hitn_v2_rr1_sum.mp3", 0.22, -11, 1]
  }],
  ["keys", ["Keys", "Πλήκτρα", "Tasten"], {
    tap: ["vsco-upright-piano/player_dyn2_rr1_032.mp3", 0.1, -14, 1],
    on: ["vsco-upright-piano/player_dyn2_rr1_030.mp3", 0.22, -12, 1],
    off: ["vsco-upright-piano/player_dyn2_rr1_026.mp3", 0.22, -12, 1],
    open: ["vsco-upright-piano/player_dyn2_rr1_028.mp3", 0.35, -11, 1],
    close: ["vsco-upright-piano/player_dyn2_rr1_024.mp3", 0.35, -11, 1]
  }],
  ["crystal", ["Crystal", "Κρύσταλλο", "Kristall"], {
    tap: ["vsco-percussion/triangle6-hitfm_v1_rr1_sum.mp3", 0.08, -14, 1],
    on: ["vsco-percussion/triangle3-hit_v1_rr1_sum.mp3", 0.25, -12, 1],
    off: ["vsco-percussion/triangle6-hit_v1_rr1_sum.mp3", 0.25, -12, 0.84],
    open: ["vsco-percussion/belltree_stroke1_v1_sum.mp3", 0.4, -11, 1],
    close: ["vsco-percussion/belltree_stroke3_v1_sum.mp3", 0.4, -11, 1]
  }]
];
const NAMES = { tap: "Tap", on: "Switch on", off: "Switch off", open: "Open", close: "Close" };

// Two passes: cut and fade, then measure the peak and set it to `peak`
// dB (sources differ by 30 dB), so every pack plays at the same level.
function build(src, dst, len, peak, rate) {
  const fade = Math.min(0.06, len / 2);
  const f = [
    "silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.002",
    rate !== 1 ? "asetrate=44100*" + rate + ",aresample=44100" : null,
    "atrim=0:" + len,
    "afade=t=out:st=" + (len - fade).toFixed(3) + ":d=" + fade.toFixed(3)
  ].filter(Boolean).join(",");
  const tmp = dst + ".wav";
  cp.execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-af", f, "-ac", "1", "-ar", "44100", tmp]);
  const info = cp.spawnSync("ffmpeg", ["-v", "info", "-i", tmp, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const m = /max_volume: (-?[0-9.]+) dB/.exec(info);
  if (!m) throw new Error("no level for " + src);
  const gain = (peak - Number(m[1])).toFixed(1);
  cp.execFileSync("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-af", "volume=" + gain + "dB",
    "-map_metadata", "-1", "-codec:a", "libmp3lame", "-b:a", "96k", "-write_xing", "0", dst]);
  fs.rmSync(tmp);
}

fs.rmSync(OUT, { recursive: true, force: true });
const index = { version: 1, sounds: SOUNDS, packs: [] };
for (const [id, names, map] of PACKS) {
  fs.mkdirSync(path.join(OUT, id), { recursive: true });
  const pack = { id: id, name: names[0], names: { el: names[1], de: names[2] }, files: {}, bytes: 0 };
  for (const s of SOUNDS) {
    const [file, len, peak, rate] = map[s];
    const dst = path.join(OUT, id, s + ".mp3");
    build(path.join(ROOT, "packs", file), dst, len, peak, rate);
    const n = fs.statSync(dst).size;
    pack.files[s] = id + "/" + s + ".mp3";
    pack.bytes += n;
  }
  Object.assign(pack, VSCO);
  index.packs.push(pack);
}
index.names = NAMES;
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1) + "\n");
fs.copyFileSync(path.join(ROOT, "packs", "vsco-percussion", "LICENSE.txt"), path.join(OUT, "LICENSE.txt"));
console.log(index.packs.map((p) => p.id + " " + p.bytes + " B").join("\n"));
