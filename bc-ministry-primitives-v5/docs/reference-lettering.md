# Reference-calibrated lettering (v2)

This adds the opt-in `reference-calibrated` fitting policy to the v5 studio. It
calibrates whole live-text runs against four supplied Forestry/Wildfire rasters.
The existing artwork, default legacy mode and previous fitting policies remain.
It is not an authenticated historical font identification or an official master.

## Use

After applying the appropriate patch, rebuild from the repository root:

```sh
python3 bc-ministry-primitives-v5/build.py
```

A fresh studio starts in **Lettering fit → Match supplied reference style**
(a saved or imported configuration keeps its own policy). Import `examples/reference-calibrated.json` for the long-ministry
Wildfire example. Keep automatic profile switching off when explicitly choosing
one reference family. Change the wording through the usual content fields.

```js
const result = await BCLogo.render({
  version: 5,
  recipe: 'long-wildfire',
  textFit: 'reference-calibrated',
  referenceModelVersion: 1,
  tabSizing: 'reference',
  autoProfile: false,
  content: {
    upper: 'British Columbia',
    lower: 'Environmental Monitoring and Conservation',
    service: 'WILDFIRE SERVICE',
  },
});
document.querySelector('#preview').replaceChildren(result.svg);
```

Configurations without `textFit` retain `legacy`. The new mode stamps
`referenceModelVersion: 1` in configuration and SVG metadata; unsupported
explicit model versions are rejected. Family exports retain the version as
well. This guards against silently claiming a different calibration version.
Older engine versions do not understand the new policy.

## What is calibrated

`BCPrimitives.REFERENCE_LETTERING` contains shared, versioned defaults:

| Run | Face used | Size target | Calibration population |
| --- | --- | --- | --- |
| Upper uppercase crest | Open Sans ExtraBold, 800 | Cap height | References 2 and 4 together |
| Lower uppercase crest | Open Sans ExtraBold, 800 | Cap height | References 2 and 4 together |
| Upper mixed-case crest | Noto Sans Condensed ExtraBold, 800, condensed width | Lowercase x-height | References 1 and 3 together |
| Lower mixed-case crest | Noto Sans Condensed ExtraBold, 800, condensed width | Lowercase x-height | References 1 and 3 together |
| Lower service inscription | Open Sans ExtraBold, 800 | Cap height | Separate caps/ministry variants, references 2/3 |

Three condensed candidates were tested for each mixed-case run: the previous
Roboto Condensed Bold, Open Sans Condensed Bold, and Noto Sans Condensed
ExtraBold. The Noto face had the lowest fitting loss for both runs in those
trials. This is a result for these masks and this objective, not proof that Noto
was used in the source artwork. Uppercase remains an imperfect substitute too.

The Noto entry uses Noto Sans at width 75 / weight 800. Width is selected from
the font itself; the engine does not horizontally scale individual glyphs.

### Font delivery and verification

The engine tries, in order: first-party files the host page supplies in
`window.BC_FONT_SOURCES` (`{faceId: [{url, unicodeRange}]}`), named local faces,
then Google Fonts when the user asks for it. The viewer site supplies all ten
faces from pinned Fontsource packages (`site/src/lettering/fonts.ts`; Noto is the
variable font, so weight and width come from its axes), so its editor and
Recreations page fit with the same binaries on every machine. The standalone
studio has no bundle and keeps the local/Google order.

Each face in `FACES` records `advance`, the width (em) of `FACE_PROBE` in the
calibration environment: the current Google Fonts static instances. Fontsource
5.3 matches them (Open Sans and Roboto Condensed exactly; variable Noto within
0.002%). A loaded face whose probe differs by more than 0.25% stays usable but
emits `FONT_METRICS_MISMATCH`, so a different version, weight or width is
reported rather than silently changing the fit. One reviewer's local Noto build
measured about 0.1% from these, inside the tolerance.

A profile contains cap/x-height, baseline radii, signed tracking, additional word
spacing, preferred/maximum arc extent, and one whole-run arc-length bias. There
are no word-index arrays, special spelling cases, traced replacement alphabets,
per-letter positions, `textLength` attributes or glyph-stretching transforms.
The same numbers are used for different wording in the same family.

## Fitting and controls

For the calibrated mode, the solver establishes the preferred visible height,
then expands the available arc while preserving spacing, then tightens tracking
within the profile's bounds, then reduces size as a last resort. Short text is
not enlarged to fill a long arc. Longer wording does not automatically inherit
reference accuracy: it still needs visual review and can exceed the profile.

The preferred/maximum long-lower path spans are 240/250 degrees. That permitted
path accommodates the reference run without prematurely tightening its spacing;
the invisible path is not a command to stretch all wording to that extent.

Additional shared-slot controls appear only in the calibrated mode:

| Configuration key | Meaning | Normalized range |
| --- | --- | --- |
| `tracking` | Added spacing between characters, in em | -0.06 to 0.20 |
| `wordSpacingEm` | Added to the font's natural space width | -0.20 to 0.30 |
| `anchorBias` | Shift the entire inscription along the path, in nominal design units | -40 to 40 |
| `span` | Preferred available arc, degrees | 20 to 300 |
| `maxSpan` | Maximum available arc, degrees | 20 to 330; never below preferred span |
| `xHeight` | Preferred visible lowercase `x` height | 4 to 80 design units |
| `heightModel` | `cap` or `xHeight` | Enumerated |

These broad configuration limits are not a guarantee of border clearance.
Defaults are substantially more constrained. Added word spacing is clamped so
the natural space plus added spacing and permitted tracking retains at least
0.06 em. `WORD_GAP_CLAMPED` reports that intervention. This is a typographic
space-width floor, not a proof of all neighboring-glyph clearances.

Editing capital height switches that slot to cap matching. Editing x-height
uses lowercase matching and removes an explicit cap override. Reset slot
restores its calibrated defaults. Word-spacing edits no longer unintentionally
freeze unrelated cap/radius values into the configuration. Tracking and spacing
remain separate controls.

One arc-center bias moves the whole text run. The width budget reserves space
for that displacement. Its value is not a per-word correction. Native final-size
SVG textPath advances are measured using the same face, weight, stretch,
letter-spacing, word-spacing and rendering settings written to the output.

Reports expose `referenceProfile`, `heightModel`, actual/preferred x-height,
word spacing, tracking, bias, arc span and fitting adjustments.
`TEXT_STYLE_REDUCED`, `SMALL_TEXT` and `TEXT_FIT_OVERFLOW` remain explicit.
`stylePreserved` means preferred size/tracking were retained; it does not mean
historical visual identity. A separately reported word-gap clamp can still occur.

The reactive holder mode keeps its separate grow-then-fit service solver. Crest
runs can use the new calibration, but reactive service text does not claim to
apply all these fixed-holder adjustments. `REFERENCE_PROFILE_UNAVAILABLE`
identifies that case and other slots with no calibrated profile. Tree/airtanker/
branch/wordmark designs are not newly reference-calibrated by this patch.

## Reference extraction and fitting

The reference masks in `tests/fixtures/reference-lettering/` are derived from
the four supplied rasters. The manifest records original file hashes, resolutions
and a **single fixed uniform scale plus translation per image**, based on the
oval. Those transforms were reused unchanged from the preceding overlay and held
constant for both before/after scores and every typography optimization.

Green chroma selects source lettering; darkness/contrast estimates fractional
coverage before resampling. This avoids treating JPEG ringing inside white
counters as solid ink. Geometry masks retain the lettering band and service
inscription and exclude separator disks. No OCR is used. The two low-resolution
images still limit reliable fine-shape conclusions.

The fitter jointly uses references 1/3 for mixed case and 2/4 for uppercase.
It searches whole-run parameters using the actual SVG renderer and a bounded
Powell optimization over soft-mask overlap. The service variants are fitted
separately. Optimizer status and raw parameters are preserved; a low loss does
not imply global optimality.

Regression scores use soft Dice at a 1.25-design-unit blur on a common 676 × 945
canvas. The calibration objective itself uses two blur scales at a smaller
render size. **The four references are training/calibration images, not held-out
validation.** Scores are overlap measures, not percentages of reconstruction
accuracy or font identity. Alternative wording is tested for layout behavior,
not compared against unseen historical reference images.

## Reproduce

Optional tooling dependencies, in addition to the repository environment:

```sh
python3 -m pip install playwright pillow numpy scipy opencv-python-headless
python3 -m playwright install chromium
```

Install the exact named faces separately. Tests refuse missing reference faces
instead of passing a fallback as a font match. `CHROMIUM=/path/to/chromium` can
select the browser. With a complete checkout:

```sh
python3 bc-ministry-primitives-v5/tests/test_reference_lettering.py \
  --out /tmp/forestoval-reference-tests
python3 bc-ministry-primitives-v5/tests/test_text_fit.py \
  --out /tmp/forestoval-text-tests
python3 bc-ministry-primitives-v5/tests/test_reactive_tabs.py \
  --out /tmp/forestoval-tab-tests
```

To recreate source masks, place the four original files named in the manifest
in a directory and run:

```sh
python3 bc-ministry-primitives-v5/tools/extract_reference_masks.py \
  --source-dir /path/to/originals --out /tmp/reference-masks
```

To rerun the parameter search:

```sh
python3 bc-ministry-primitives-v5/tools/calibrate_reference_lettering.py \
  --groups long-upper long-lower \
  --faces condensed-bold open-condensed noto-condensed \
  --out /tmp/reference-calibration
```

This outputs candidate JSON/PNG files; it does not silently overwrite production
profiles. Review the entire default-wording fit and alternate-wording behavior
before transferring a candidate into `REFERENCE_LETTERING`. Full candidate
searches can take several minutes. A one-iteration smoke test verifies execution
only and can intentionally finish with a nonconverged optimizer status.

## Verification scope and limitations

This delivery was tested on Chromium 144 through Playwright using recovered
source modules, local named faces and an isolated page shell. The correct frame
and ribbon geometry were available, but the recovered demo's interior vector
landscape is empty. The overlays deliberately show **the supplied reference
image underneath newly rendered text**, not a claim that the scene was rebuilt.
No replacement `art.json` or partial `layout.json` is included in the patch.

The full production builder, HTML/CSS, original complete studio suite,
TypeScript Recreations viewer, current upstream HEAD, CI/deployment, Safari,
Firefox, external vector-editor imports and network font loading were not
verified. The viewer's separate per-word calibration is not migrated by this
patch. A complete checkout should run the production commands above before
merging. Source-level legacy equivalence is tested; it is not an assertion
about all arbitrary old configuration values or all browser platforms.

There is still no general runtime glyph-collision solver. Selected default and
alternate crest-band masks pass containment; that does not prove containment
for every font, override, script or service holder. Residual letter-shape and
spacing mismatches remain visible. The implementation improves reference
fidelity without representing an approximate substitute as an exact original.
