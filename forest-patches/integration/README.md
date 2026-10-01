# How this extends forestoval and PofBC

This is a **standalone review and reconstruction kit**, not a patch that has been applied to either repository. No remote files, branches or Drive documents were changed.

## Responsibilities

- **forestoval:** shared oval, tree/wildlife scenery, lettering roles and service-tab concept. `assets/forestoval-art.json` contains the original 11 ART strings recovered from the user's saved v5 studio. Every string was verified against the current repository's hash manifest at commit `244276dcf0b55e14b694b5cee569c78a978cc734`.
- **PofBC:** the historical provincial crest inside the non-oval Forest Service / Fire Control shield. Its documented `PROVINCIAL_MARK` interface is the correct seam. Do not substitute a current BC sun logo, the full modern achievement of arms, or a Forest Service oval.
- **This kit:** the source register, evidence categories, reconstruction recipes, outlined exports, newly drawn shoulder/shield/map silhouettes and comparison catalogue.

## Import exact assets from local checkouts

```sh
node tools/import_sources.mjs --forestoval /path/to/forestoval --pofbc /path/to/PofBC
# Review the dry-run results, then explicitly replace kit assets:
node tools/import_sources.mjs --forestoval /path/to/forestoval --pofbc /path/to/PofBC --write
python tools/build_vectors.py --condensed /path/to/RobotoCondensed-Bold.ttf \
  --heavy /path/to/OpenSans-ExtraBold.ttf --regular /path/to/Roboto-Bold.ttf \
  --thin /path/to/Roboto-Regular.ttf
python tools/build_catalogue.py
```

The importer only reads the two repository checkouts. It never commits, pushes, or modifies them. It executes the generated PofBC module to read its export; only use a checkout you trust. The repository interfaces were inspected, and the adapter was exercised with local fixtures. A live PofBC checkout import has **not** been run in this environment.

The delivered shield uses supplementary original provincial artwork from the user's Drive, normalized to the same 497.02 × 497.19 interface. It is **not claimed to be byte-identical** to PofBC's committed mark. An exact local import replaces that asset and records the checkout commit and source hash. See `reports/provincial-crest-provenance.json`.

## Recommended application changes

1. Add a **Patch catalogue** entry, separate from the generic logo generator. Initially the self-contained `index.html` can be hosted under a new static route without altering either renderer.
2. Use `source-inventory.json` as the evidence register and `presets.json` as the design register. Keep source IDs, physical PDF page numbers, category and review status visible. One photo can contain many objects; several photos can show the same design.
3. Add the genuinely new shape families to forestoval: shoulder rocker, tapered shield + separate top rocker, rectangular map/animal, square map/tree. Do not force these through the oval or Airtanker preset.
4. Add separate **archival/reference** and **custom composition** modes. Archival presets preserve specimen wording and geometry; custom mode may auto-fit different wording and must not imply that invented combinations were issued.
5. Separate upper oval, lower oval, upper tab, lower tab and side-arm text settings. Fit into the measured usable arc by reducing tracking and then uniformly reducing font size, with a warning at the configured readability floor. Do not squeeze glyphs horizontally.
6. Introduce specimen-specific historic tree scenes. The older embroidered and decal mountain/forest/water treatments are visibly different from the current shared tree source. Changing their colours alone is insufficient.
7. Require manual fidelity review before promoting any draft. Validate ids, references, raster-free outlines, clipping, source crop geometry and text containment. Keep uncertain dates and identities null.

`presets.json` is a kit schema, **not an undocumented drop-in replacement** for forestoval's `gallery.json` or the v5 studio state file. A future application integration should map the fields explicitly and add tests against the actual application interfaces.

## Suggested automated checks in the repositories

- Known text does not move when custom auto-fit behaviour changes.
- Blank tabs disappear; long tabs grow only within their configured geometry limit.
- Unsupported glyphs produce a visible warning instead of silently disappearing.
- Export contains no external images, broken ids or font binaries.
- The Parks category and unconfirmed map-tree badge cannot appear as verified Ministry of Forests issues.
- Photo dates, upload dates, organizational rename dates and patch adoption dates are distinct fields.
