# Style-preserving lettering in the v5 studio

This change makes fitting priorities explicit. It reuses the existing font roles,
cap heights, tracking, baseline slots and arc limits. It does not identify an
original typeface, stretch glyphs to a target width, trace letters, or retune the
reference artwork.

## Use

Rebuild the standalone studio from the repository root:

```sh
python3 bc-ministry-primitives-v5/build.py
```

Open `bc-ministry-primitives-v5/bc-ministry-primitives-v5.html`. Choose **Lettering
fit → Preserve lettering style** and change the wording. Import
`examples/style-preserving.json` for a concrete `NATURAL RESOURCES` example.
The normal standalone builder already inlines the changed engine and UI; no new
build dependency or generated primitive data is required.

| Configuration `textFit` | Policy |
| --- | --- |
| `legacy` | Existing spacing-first fitting, unchanged; default for old v5 configurations. |
| `reference-locked` | Keep the configured angular span; reduce spacing, then size when necessary. |
| `style-preserving` | Keep preferred height and spacing; expand within the slot's existing span limit, then reduce spacing, then size. |

The control is shared across recipes, like the existing role and slot overrides.
Changing or resetting a recipe retains it. Select **Existing fit (compatibility)**
to return to the previous fitting policy. Configuration import/export, saved
state, SVG metadata and family `shared-rules.json` retain the selected policy.

Reference-locked means **angular span**, not frozen absolute endpoints: the
existing `curve()` function still adjusts the baseline radii when cap height
changes. A short phrase remains naturally sized and centred in either new mode;
it is never enlarged or spread to occupy an entire arc.

The policy affects runs routed through `fitRun`: crest inscriptions and labels
on fixed tabs/plates. Straight wordmarks continue using `fitPlain`. A reactive
service tab (`tabSizing: "follow-text"`) retains its separate grow-then-fit solver;
its crest inscriptions still use the selected lettering policy. The UI states
this distinction.

## API

```js
const state = BCLogo.normalise({
  version: 5,
  recipe: 'forests',
  textFit: 'style-preserving',
  autoProfile: false,
  content: { lower: 'NATURAL RESOURCES' },
});
const result = await BCLogo.render(state);
document.querySelector('#preview').replaceChildren(result.svg);
console.table(result.report.map(({ slot, cap, trackingEm, adjustments }) =>
  ({ slot, cap, trackingEm, adjustments })));
```

Call `render()` when fonts might not yet be loaded. Synchronous `makeLogo()` and
`fitRun()` use the current font state, as before. Keep `autoProfile` off to retain
a specific crest family; the pre-existing automatic family selection is a
separate option, not silently enabled by this change.

Unknown policies are rejected. Omitted/null policies default to `legacy`.
Existing v5 configuration versioning is retained; older readers that ignore the
new field will not reproduce the new layout policy.

## Fitting and measurement

For the new modes, the engine measures final-size SVG **textPath** advances with
the actual rounded font size and letter spacing used by the renderer. It does
not estimate a gap count or scale a 1000-pixel advance to predict final width.
The cap-height and ascent/descent metrics still use the existing font metrics;
this is not a new glyph-outline or optical-density analyser.

Both measurement and final adaptive text use `text-rendering="geometricPrecision"`.
In the tested Chromium renderer this prevents preview/export scale from changing
the native advances. A plain SVG `<text>` probe did not reliably reproduce a
`<textPath>` advance, even at the same font size. The measurement therefore uses
one temporary textPath too, with matching kerning, whitespace, spacing, font
synthesis and rendering settings. This rendering hint is **not** added to legacy
or reactive-tab output. Other renderers may interpret it differently.

The solver searches, in order:

1. The smallest sufficient allowed span, keeping the preferred cap and tracking.
2. The greatest allowed tracking that fits at the span limit.
3. The greatest uniform cap height that fits, recalculating baseline geometry at
   each candidate size.

Reference-locked skips the first step. Each numerical search is bounded. A
0.05-unit advance reserve guards rounding at the boundary. Measurement results
are cached with a 2048-entry bound and invalidated when font metrics are
invalidated; temporary SVG probes are removed immediately. There is no glyph
width scaling, `textLength`, `lengthAdjust`, word-specific index adjustment, or
per-character transform.

`minimumTrackingEm` cannot exceed the preferred tracking. This prevents an
explicit zero-tracking preference from being increased to a positive profile
floor under overflow. Existing configuration limits, including the nonnegative
tracking rule, remain unchanged.

## Diagnostics

Adaptive reports include `fitPolicy`, `adjustments`, `preferredTrackingEm`,
`minimumTrackingEm`, `preferredSpan`, `maxSpan`, `stylePreserved`, `overflow`, and
`widthBasis`. The UI exposes the adjustment sequence, tracking and span.
`stylePreserved` means the **preferred cap height and tracking** were retained;
it is not an optical match score or proof of historical fidelity.

`TEXT_STYLE_REDUCED` explains that spacing or height had to change.
`SMALL_TEXT` still warns below the slot's existing readable-height threshold.
`TEXT_FIT_OVERFLOW` reports a residual width violation rather than silently
presenting it as a fit. The minimum cap is a warning threshold, not a clipping
limit: extremely long input can still produce tiny, explicitly flagged text.
Shorten that wording or explicitly select another suitable profile.

## Regression tests

From a complete checkout with the repository requirements and named default
fonts installed:

```sh
python3 -m pip install -r requirements.txt
python3 -m playwright install chromium
python3 bc-ministry-primitives-v5/tests/test_text_fit.py --out /tmp/forestoval-text-fit
python3 bc-ministry-primitives-v5/tests/test_reactive_tabs.py --out /tmp/forestoval-tabs
```

Tests select `/usr/bin/chromium` when present, otherwise Playwright Chromium.
Set `CHROMIUM=/path/to/browser` to override. Default roles require Open Sans
ExtraBold, Roboto Condensed Bold, Roboto Slab Bold and Roboto Regular at the
weights named by `primitives.js`. The tests do not fetch network fonts. Missing
faces fail the prerequisite rather than being counted as exact-font verification.

For isolated source testing, using the existing test fixture:

```sh
python3 bc-ministry-primitives-v5/tests/test_text_fit.py \
  --isolated \
  --art bc-ministry-primitives-v5/data/art.json \
  --baseline-dir /path/to/unmodified/bc-ministry-primitives-v5 \
  --out /tmp/forestoval-text-fit-isolated
```

`--baseline-dir` is optional: it compares all 14 non-excluded recipes under both
tab modes against a separate unmodified engine. SVG metadata is excluded from
that comparison because the new configuration field is intentionally present.
Geometry, text reports and warnings are not excluded. `--art` enables the
wildlife-band raster checks in isolated mode; omitting it uses dummy artwork and
does not run those checks. The isolated shell uses an explicitly labelled
in-memory localStorage fixture for its saved-state test. Default production mode
uses the actual page and native localStorage.

The suite records 448 composition/wording/policy/size combinations, with native
advance checks on their curved/fixed-slot text runs at output widths 100, 500,
1200 and 6000. It also tests short/long/empty/accented wording, a 320-character
stress case, config validation, live editing, policy inheritance, imports,
SVG/family exports and reactive-tab independence. Selected wildlife inscriptions
are checked against raster masks of the actual white band, excluding borders
and separators. Tolerances are fixed in the test, not relaxed to hide failures.

## Scope and remaining work

The supplied validation used recovered source modules, locally installed faces,
a minimal DOM shell and recovered reference artwork. The two edited source
files were recovered exactly against the reactive-tab patch's recorded Git
postimage hashes. This is **not** a complete upstream checkout or a verified
current upstream commit. Production HTML/CSS, the complete studio suite, the
TypeScript viewer build, deployment gates and other browsers must still be run
in the full repository.

This patch deliberately does **not** migrate the Recreations viewer's per-word
`lettering-fit.json` corrections into a shared calibration schema, alter the
TypeScript viewer/types, add a font-width axis, measure lowercase/x-height or
stroke coverage, or support negative tracking. It is the reusable fitting-policy
portion of that larger typography proposal.

It also does not add a general runtime ink-collision solver. An advance fitting
its arc is not proof that all glyphs avoid borders, separators or neighbouring
runs. The supplied raster checks cover the tested wildlife profiles and wording;
large role/slot overrides, other faces, other scripts and other renderers still
need visual/containment review. Reference fonts remain substitutes, not
historically authenticated originals.
