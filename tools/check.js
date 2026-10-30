#!/usr/bin/env node
// Checks packs/: the index matches the folders, every sample named by an
// .sfz is there, sizes are right, and every note and velocity in a pack's
// key range plays exactly one region (first round robin; a drum kit,
// kind "drums", may leave keys empty but never plays two).
//   node tools/check.js
"use strict";
const fs = require("fs");
const path = require("path");
const SFZ = require("./sfz-read.js");

const root = path.join(__dirname, "..", "packs");
const idx = JSON.parse(fs.readFileSync(path.join(root, "index.json"), "utf8"));
const LICS = ["cc0", "pd", "by", "by-sa"];
let bad = 0;
const fail = (m) => { console.log("FAIL " + m); bad++; };
const dirs = fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory()).sort();
const ids = idx.packs.map((p) => p.id).sort();
if (JSON.stringify(dirs) !== JSON.stringify(ids)) fail("folders " + dirs.join(",") + " vs index " + ids.join(","));
idx.packs.forEach((p) => {
  const dir = path.join(root, p.id);
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(p.id)) fail(p.id + ": id");
  if (LICS.indexOf(p.lic) < 0) fail(p.id + ": licence " + p.lic);
  if (!fs.existsSync(path.join(dir, "LICENSE.txt"))) fail(p.id + ": LICENSE.txt");
  if (!/^https:\/\//.test(p.url)) fail(p.id + ": url");
  const text = fs.readFileSync(path.join(dir, p.sfz), "utf8");
  const regions = SFZ.parse(text).regions;
  const files = fs.readdirSync(dir).filter((f) => /\.(mp3|wav|flac|ogg)$/.test(f));
  const used = new Set(regions.map((r) => r.sample));
  used.forEach((f) => { if (files.indexOf(f) < 0) fail(p.id + ": missing " + f); });
  files.forEach((f) => { if (!used.has(f)) fail(p.id + ": unused " + f); });
  const bytes = files.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0) + Buffer.byteLength(text);
  if (bytes !== p.bytes) fail(p.id + ": bytes " + bytes + " vs " + p.bytes);
  if (p.files !== files.length) fail(p.id + ": files");
  let holes = 0;
  for (let n = p.keys[0]; n <= p.keys[1]; n++) for (let v = 1; v < 128; v++) {
    const m = regions.filter((r) => (!r.trigger || r.trigger === "attack") && SFZ.note(r.lokey) <= n && n <= SFZ.note(r.hikey) && +r.lovel <= v && v <= +r.hivel).length;
    if (m > 1 || (m === 0 && p.kind !== "drums")) holes++;   // a kit may leave keys empty
  }
  if (holes) fail(p.id + ": " + holes + " note/velocity pairs without exactly one region");
});
// samples/: single sounds for audio clips
const sroot = path.join(__dirname, "..", "samples");
const sidx = JSON.parse(fs.readFileSync(path.join(sroot, "index.json"), "utf8"));
const seen = new Set();
let nsamples = 0;
sidx.groups.forEach((g) => {
  if (!/^[a-z0-9-]{1,40}$/.test(g.id)) fail("samples: group id " + g.id);
  g.items.forEach((x) => {
    nsamples++;
    const key = g.id + "/" + x.id;
    if (seen.has(key)) fail("samples: twice " + key);
    seen.add(key);
    if (!/^[a-z0-9-]{1,40}$/.test(x.id) || x.file !== g.id + "/" + x.id + ".mp3") fail("samples: " + key + " id or file");
    if (LICS.indexOf(x.lic) < 0 || !/^https:\/\//.test(x.url) || !x.by) fail("samples: " + key + " licence");
    const f = path.join(sroot, x.file);
    if (!fs.existsSync(f)) return fail("samples: missing " + x.file);
    if (fs.statSync(f).size !== x.bytes) fail("samples: bytes " + x.file);
    if (!(x.dur > 0 && x.dur <= 30)) fail("samples: duration " + x.file);
  });
});
if (!fs.existsSync(path.join(sroot, "LICENSE.txt"))) fail("samples: LICENSE.txt");
console.log(nsamples + " single sounds in " + sidx.groups.length + " groups");
console.log(idx.packs.length + " packs, " + (idx.packs.reduce((n, p) => n + p.bytes, 0) / 1e6).toFixed(1) + " MB" + (bad ? ", " + bad + " problems" : ", ok"));
process.exit(bad ? 1 : 0);
