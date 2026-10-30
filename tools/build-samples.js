#!/usr/bin/env node
// Builds samples/: single sounds (one-shots, swells, rolls) that Studio
// offers as audio clips, from VSCO 2 CE (CC0 1.0, Versilian Studios).
//
//   node tools/build-samples.js <VSCO-2-CE checkout>
//
// Each sound: leading silence trimmed (3 ms kept), cut at 12 s with a
// fade, MP3 V2 44.1 kHz. samples/index.json lists them in groups, with
// names in EN/EL/DE, licence, author and source.
"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const VSCO = { lic: "cc0", by: "Versilian Studios (VSCO 2 CE)", url: "https://github.com/sgossner/VSCO-2-CE" };
// group id, names, then [id, file under the checkout, EN, EL, DE]
const GROUPS = [
  ["drums", ["Drums", "Τύμπανα και ταμπούρα", "Trommeln"], [
    ["bass-drum-hit", "Percussion/BDrumNewhit_v7_rr1_Sum.wav", "Bass drum hit", "Μεγάλο τύμπανο, χτύπημα", "Große Trommel, Schlag"],
    ["bass-drum-rub", "Percussion/bassdrum_rub2_v1.wav", "Bass drum rub", "Μεγάλο τύμπανο, τρίψιμο", "Große Trommel, gerieben"],
    ["snare-hit", "Percussion/Snare2-HitSN_v9_rr1_Sum.wav", "Snare hit", "Ταμπούρο, χτύπημα", "Kleine Trommel, Schlag"],
    ["snare-hit-off", "Percussion/Snare2-HitNS_v6_rr1_Sum.wav", "Snare hit, snares off", "Ταμπούρο χωρίς σπιράλ", "Kleine Trommel ohne Teppich"],
    ["snare-taps", "Percussion/Snare2-taps_v4_rr1_Sum.wav", "Snare taps", "Ταμπούρο, ελαφριά χτυπήματα", "Kleine Trommel, Tupfer"],
    ["snare-roll", "Percussion/Snare2-rollSN_v5_rr1_Sum.wav", "Snare roll", "Ταμπούρο, τρέμολο", "Kleine Trommel, Wirbel"],
    ["conga-high", "Percussion/Quinto-HitN_v3_rr1_Sum.wav", "Conga, high", "Κόνγκα, ψηλή", "Conga, hoch"],
    ["conga-mid", "Percussion/Conga-HitN_v3_rr1_Sum.wav", "Conga, middle", "Κόνγκα, μεσαία", "Conga, mittel"],
    ["conga-low", "Percussion/Tumba-HitN_v3_rr1_Sum.wav", "Conga, low", "Κόνγκα, χαμηλή", "Conga, tief"],
    ["log-drum-high", "Percussion/LogDrumHi_MedM_v3_rr1_Sum.wav", "Log drum, high", "Ξύλινο τύμπανο, ψηλό", "Schlitztrommel, hoch"],
    ["log-drum-low", "Percussion/LogDrumLo_MedM_v3_rr1_Sum.wav", "Log drum, low", "Ξύλινο τύμπανο, χαμηλό", "Schlitztrommel, tief"]
  ]],
  ["cymbals", ["Cymbals and gong", "Πιατίνια και γκονγκ", "Becken und Gong"], [
    ["crash", "Percussion/cymbal-crash1_ff_rr1.wav", "Crash cymbals", "Πιατίνια, χτύπημα", "Becken, Schlag"],
    ["suspended-hit", "Percussion/susCymb1-hit_fff_rr1.wav", "Suspended cymbal hit", "Κρεμαστό πιατίνι, χτύπημα", "Hängebecken, Schlag"],
    ["suspended-stick", "Percussion/susCymb1-hitstick_fff_rr1.wav", "Suspended cymbal, stick", "Κρεμαστό πιατίνι, μπαγκέτα", "Hängebecken, Stock"],
    ["swell-short", "Percussion/susCymb1-cresc-Short_v1.wav", "Cymbal swell, short", "Φούσκωμα πιατινιού, σύντομο", "Beckenwirbel, kurz"],
    ["swell-medium", "Percussion/susCymb1-cresc-Median_v1.wav", "Cymbal swell, medium", "Φούσκωμα πιατινιού, μεσαίο", "Beckenwirbel, mittel"],
    ["swell-long", "Percussion/susCymb1-cresc-Long_v1.wav", "Cymbal swell, long", "Φούσκωμα πιατινιού, μακρύ", "Beckenwirbel, lang"],
    ["bowed-cymbal", "Percussion/susCymb1-bow-2.wav", "Bowed cymbal", "Πιατίνι με δοξάρι", "Gestrichenes Becken"],
    ["gong", "Percussion/gongHit_fff.wav", "Gong", "Γκονγκ", "Gong"],
    ["gong-scrape", "Percussion/gongscrape_mf.wav", "Gong scrape", "Γκονγκ, ξύσιμο", "Gong, geschabt"]
  ]],
  ["small", ["Small percussion", "Μικρά κρουστά", "Kleines Schlagwerk"], [
    ["tambourine-hit", "Percussion/Tamb1-Hit_v2_rr1_Sum.wav", "Tambourine hit", "Ντέφι, χτύπημα", "Tamburin, Schlag"],
    ["tambourine-shake", "Percussion/Tamb1-Shake_v1_rr1_Sum.wav", "Tambourine shake", "Ντέφι, κούνημα", "Tamburin, geschüttelt"],
    ["tambourine-roll", "Percussion/Tamb1-Roll_v3_rr1_Sum.wav", "Tambourine roll", "Ντέφι, τρέμολο", "Tamburin, Wirbel"],
    ["cowbell", "Percussion/Cowbell1_Hit_v4_rr1_Sum.wav", "Cowbell", "Κουδούνα", "Kuhglocke"],
    ["claves", "Percussion/Claves1_Hit_v3_rr1_Sum.wav", "Claves", "Κλάβες", "Claves"],
    ["guiro", "Percussion/Guiro-Hit_v1_rr1_Sum.wav", "Guiro", "Γκουίρο", "Guiro"],
    ["triangle", "Percussion/Triangle3-Hit_v2_rr1_Sum.wav", "Triangle", "Τρίγωνο", "Triangel"],
    ["triangle-muted", "Percussion/Triangle3-HitFM_v2_rr1_Sum.wav", "Triangle, muted", "Τρίγωνο, πνιχτό", "Triangel, gedämpft"],
    ["sleigh-bells", "Percussion/Sleighbells_Hit_v1_rr1_Mid.wav", "Sleigh bells", "Κουδουνάκια έλκηθρου", "Schlittenglocken"],
    ["bell-tree", "Percussion/BellTree_Stroke1_v1_Sum.wav", "Bell tree", "Δέντρο καμπανακιών", "Schellenbaum"],
    ["vibraslap", "Percussion/vibraring_v1_rr1.wav", "Vibraslap", "Βιμπρασλάπ", "Vibraslap"],
    ["ratchet", "Percussion/Ratchet1-Fast_v1_rr1_Sum.wav", "Ratchet", "Ροκάνα", "Ratsche"],
    ["anvil", "Percussion/Anvil_Hit1_v3_Sum.wav", "Anvil", "Αμόνι", "Amboss"],
    ["brake-drum", "Percussion/BrakeDrum1_Hammer_v3_Sum.wav", "Brake drum", "Ταμπούρο φρένου", "Bremstrommel"]
  ]]
];
const LEN = 12, FADE = 0.5;

function duration(f) { return +cp.execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim(); }

function main() {
  const src = process.argv[2];
  if (!src) { console.error("usage: build-samples.js <VSCO-2-CE checkout>"); process.exit(2); }
  const root = path.join(__dirname, "..", "samples");
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const groups = GROUPS.map(([gid, gn, items]) => {
    fs.mkdirSync(path.join(root, gid));
    return {
      id: gid, name: gn[0], names: { el: gn[1], de: gn[2] },
      items: items.map(([id, file, en, el, de]) => {
        const out = path.join(root, gid, id + ".mp3"), inp = path.join(src, file);
        const af = ["silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.003", "aresample=44100"];
        if (duration(inp) > LEN) af.push("atrim=0:" + LEN, "afade=t=out:st=" + (LEN - FADE) + ":d=" + FADE);
        cp.execFileSync("ffmpeg", ["-v", "error", "-y", "-i", inp, "-af", af.join(","), "-ar", "44100", "-c:a", "libmp3lame", "-q:a", "2", out]);
        return Object.assign({ id, name: en, names: { el, de }, file: gid + "/" + id + ".mp3", bytes: fs.statSync(out).size, dur: +duration(out).toFixed(2) }, VSCO);
      })
    };
  });
  fs.writeFileSync(path.join(root, "LICENSE.txt"), fs.readFileSync(path.join(src, "LICENSE"), "utf8"));
  fs.writeFileSync(path.join(root, "index.json"), JSON.stringify({ version: 1, groups }, null, 1) + "\n");
  const all = groups.reduce((n, g) => n.concat(g.items), []);
  console.log("samples: " + all.length + ", " + (all.reduce((n, x) => n + x.bytes, 0) / 1e6).toFixed(1) + " MB");
}
main();
