# orOS sounds

Free instrument and loop packs for [orOS Studio](https://useoros.online). Studio
downloads a pack the first time a track uses it and keeps it on the device;
nothing here is built into orOS.

Served from GitHub Pages: `https://koulaxizis.github.io/oros-sounds/packs/`.

## Packs

`packs/index.json` lists every pack: id, name, category, licence (`lic`),
author (`by`), the source (`url`), size and the built-in Studio sound of the
same kind (`kind`, played by an older Studio or while the pack downloads).
A pack is a folder with `instrument.sfz` (the subset Studio plays, see
`studio/sfz.js` in koulaxizis/oros), its samples and `LICENSE.txt`.

| Source | Licence | Packs |
|---|---|---|
| [VS Chamber Orchestra: Community Edition](https://github.com/sgossner/VSCO-2-CE) (Versilian Studios; Sam Gossner, Simon Dalzell; sample cutting Elan Hickler/Soundemote) | CC0 1.0 | `vsco-*` (21) |

Only sources without grey areas go here: CC0, public domain, or CC BY with
the credit carried in the pack. Studio lists the pack in the song's credits
on Export.

## Building

Packs are built, never edited by hand:

```
node tools/build-vsco.js <VSCO-2-CE checkout> <folder with its .sfz files>
node tools/check.js
```

The builder keeps at most two velocity layers (the louder ones) and the first
round robin, trims leading silence, cuts long tails with a fade and encodes
MP3 (LAME V2, 44.1 kHz), so a whole instrument is a few MB. `tools/check.js`
checks the index, the files, and that every note and velocity in a pack's
range plays exactly one region.

## Licence

The tools are MIT (see `LICENSE`). Each pack carries its own licence in
`LICENSE.txt`; the VSCO 2 CE samples are CC0 1.0.
