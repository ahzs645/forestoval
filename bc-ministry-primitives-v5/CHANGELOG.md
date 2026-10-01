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
- `separatorPlacement: 'follow-text'` places each separator mark from the
  lettering on its side: at `separatorHomeY` while the lines leave room,
  pushed by a line that comes within 50 units, and exactly halfway between the
  lines once the gap is under 100. The lower arc narrows when the marks would
  touch a line. `'reference'` (the default) keeps `separatorY`.
- Reference lettering model version 2: the tree crest is calibrated to the
  Forest Service vector (`tools/extract_tree_masks.py`, groups `tree-*`):
  Open Sans Bold for FOREST SERVICE and Raleway Black (new face; flat-apex A
  like the vector's) for BRITISH COLUMBIA, on a new `crest-tree-lower` role.
  Letters now overlap the vector 0.61 / 0.67 (was 0.40 / 0.36).
  Version-1 configurations upgrade.
- The Wildfire Management tab (`TABS['management-top']`, `holder: 'oval'`,
  `halfSpan: 60`) is built on the frame's outer oval (tab-layout.js) with the
  reference holder too, so it sits on the oval as in the patch photos. It
  used to be the lower ribbon flipped and scaled x1.1, which floated 39 units
  above the oval. Its run reports the measured final-size advance and renders
  with geometric precision like the other runs.
- `ringOffset` per crest: the tree crests centre their lines 4.5 units inside
  the ring, as the Forest Service vector does (both lines now within 1 unit
  of it).
- Crest pairs: `CRESTS` declare `longer` / `shorter` (and the short profile's
  `switchCap`), and `autoProfile` reads them instead of a wildlife-only check.
  New `tree-long` (long-ministry slots on the tree scene, smaller diamonds,
  the long crest's spreading profile) pairs with `tree-heavy`, so the tree
  crest follows its wording with the same rules.
- `centreInRing`: crest lines follow the white ring (`SHAPES.rings`, the
  frame's own ellipses) and centre their type body on its centre line: cap
  height for capitals, and x-height plus 30% toward the cap height for
  lowercase. Slot ellipses were only calibrated where the reference wording
  sits, so longer wording drifted toward one black ring.
- `fanOut`: the long crest's upper line spreads toward the capitals look
  (height, spacing, word spacing) when the lower line leaves room.
  `recipeState()` carries `autoProfile`, `separatorPlacement`, `fanOut` and
  `centreInRing`; the site's editor and a fresh studio turn all four on.
- `separatorInset` per crest: the marks sit on the separator band drawn in by
  3.34 (capitals, from `wildfire-source.svg`) or 7.67 units (long, from both
  long-crest rasters). The long crest's marks were about 8 units too far out.
- The long-ministry · Wildfire raster (`wildlife-long-ribbon`) now uses the
  registration the lettering calibration fitted. The previous one was 3.6% too
  large and made overlays show the lettering offset outwards.
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
