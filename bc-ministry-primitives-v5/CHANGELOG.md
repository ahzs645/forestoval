# v5 — shared typography implementation

## Later additions
- First-party font sources (`BC_FONT_SOURCES`) tried before local and Google
  faces; each loaded face is checked against its recorded probe advance
  (`FACE_PROBE`, `FACES[id].advance`) and reported if it differs.
- Editable SVG exports declare local `@font-face` aliases for their faces.
- `tabBacking`: paper or see-through service holder, defaulting per recipe
  (Forests · Wildfire Service is see-through, as in its reference).
- A fresh studio starts with reference-calibrated fitting, like the site's
  editor and Recreations page; saved configurations keep their own policy.
- `separatorPlacement: 'follow-text'` places the separator marks between the
  upper and lower lettering (at each crest's `separatorGap` fraction of the
  gap, measured from its reference wording), narrowing the lower arc when the
  lines meet; `'reference'` (the default) keeps `separatorY`.
  `recipeState()` carries `autoProfile` and `separatorPlacement`.
- `separatorInset` per crest: the marks sit on the separator band drawn in by
  3.34 (capitals, from `wildfire-source.svg`) or 7.67 units (long, from both
  long-crest rasters). The long crest's marks were about 8 units too far out.
- The long-ministry · Wildfire raster (`wildlife-long-ribbon`) now uses the
  registration the lettering calibration fitted. The previous one was 3.6% too
  large and made overlays show the lettering offset outwards. The site's
  editor and a fresh studio turn both on.
- `retryFonts()` starts every face again from the top of the source order
  (dropping cached faces and their registered `FontFace`s), and a load that was
  in flight before the retry can no longer overwrite the newer result.

## Replaced
- Per-recipe numeric type overrides and repeated late preset mutations.
- Optional per-character calibration output.
- Horizontal `textLength` / `spacingAndGlyphs` letter deformation.
- Nominal-font-size-only fitting and unreported font substitution.
- Hard-coded acronym/descriptor baseline relationships.

## Added
- Frozen shared face, role, slot, crest, tab, colour and composition registries.
- Inheritable content-only recipes and validated shared patch maps.
- Cap-height measurement, bounded tracking, arc expansion and uniform fitting.
- Distinct curved browser-advance vs straight visible-ink width constraints.
- Independent Forest Service upper, ministry, service-tab and wordmark roles.
- Actual-ink row spacing and a reference-derived BCTS block centre.
- Editable SVG, raster PNG, whole-family SVG ZIP and v5 JSON exports.
- Uniform whole-reference overlays, fitted-baseline guides and live diagnostics.
- Pixel-mask clearance checks; corrected Management tab end-letter collisions
  through one shared baseline/usable-span adjustment.
- Original uploaded raster bytes for ten reference records, preserving transparency.
- Readable source modules, TypeScript globals, a standard-library build script,
  artwork checksums and real-browser regression tests.

## Preserved / deliberately excluded
- Original wildlife/tree master geometry; recolour rather than rebuild.
- Existing photographic plate/wing interpretations, identified as approximations.
- Fire Control retained only as an excluded reference; not used for calibration.
- Earlier JSON state is not silently migrated. This source was based on v3 and
  the current reference ZIP, not an unseen later implementation.
