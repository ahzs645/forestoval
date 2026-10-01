# v5 — shared typography implementation

## Later additions
- First-party font sources (`BC_FONT_SOURCES`) tried before local and Google
  faces; each loaded face is checked against its recorded probe advance
  (`FACE_PROBE`, `FACES[id].advance`) and reported if it differs.
- Editable SVG exports declare local `@font-face` aliases for their faces.
- `tabBacking`: paper or see-through service holder, defaulting per recipe
  (Forests · Wildfire Service is see-through, as in its reference).

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
