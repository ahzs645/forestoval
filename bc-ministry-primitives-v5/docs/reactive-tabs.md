# Reactive service tabs in the v5 studio

This adds an opt-in layout mode for the curved upper and lower service tabs.
The existing reference mode remains the default. It does not alter the React
viewer's Compose panel or the saved reference fits.

## Use

Build the studio from the repository root:

```sh
python3 bc-ministry-primitives-v5/build.py
```

Open `bc-ministry-primitives-v5/bc-ministry-primitives-v5.html`. Select the
Long ministry / Wildfire or Wildfire Management example, then choose **Tab layout
→ Follow lettering (grow, then fit)**. For the lower tab, select the
`service-bottom` baseline slot or `service-heavy` typography role. For the upper
tab, select `management-top` or `service-condensed`.

Changing preferred cap height, the role multiplier, tracking, or service wording
updates the preview. The radii controls are disabled for service slots in this
mode: the baseline is derived from the same geometry as the holder. Reference
mode retains its original manual baseline controls and traced holder.

Use **Reset slot** / **Reset role** to clear shared overrides. Changing or
resetting a recipe intentionally keeps shared overrides and the selected tab
mode, consistent with the existing family editor. To return fully to the original
reference, clear the relevant overrides and choose **Reference holder (fixed)**.

## Layout rules

`shared-primitives/tab-layout.js` accepts measured browser text metrics and the
existing `tab` profile from `shared-primitives/layout.json`. `build.py` inlines
both into the standalone studio. The module is dependency-free, available as
`BCTabLayout` in the browser or through CommonJS in Node, and is suitable for
subsequent integration into the TypeScript viewer.

- Measured cap height, actual ascent/descent, and proportional clearance determine
  the holder's depth. The border weight stays tied to the reference profile.
- The inner edge remains attached to the profile's oval. Growth is an outward
  normal offset, not nonuniform scaling of the original artwork.
- The solver preserves the requested tracking, then expands the tab's half-span
  from the reference minimum to at most 80 degrees. At the span limit it reduces
  text uniformly and reports `TAB_TEXT_REDUCED`. Text below the slot's existing
  minimum also receives the existing `SMALL_TEXT` warning. This is not an
  unlimited-size or never-shrink mode.
- The upper and lower sides use different baseline offsets so upright lettering
  remains within the band. Each phrase stays one editable SVG `textPath`.
- Preview, guides, SVG, PNG, and family export consume the resolved layout.
  Configurations and exported family rules preserve `tabSizing`.

Numeric controls update on `input`; temporary blank cap/tracking fields are
ignored rather than interpreted as zero. Scheduling an edit invalidates any
older pending render immediately. The preview's result keeps a separate state
snapshot, and exporting flushes pending edits through the same refresh path.

The mode applies only to `shape: 'ribbon'` service tabs. Parks plates, Airtanker
wings, crest lettering, and wordmark-only layouts retain their existing paths.
The viewer, extractor, reference images, generated layout data, and saved fitting
parameters are not changed by this patch.

## Browser regression tests

Install the repository's Python requirements and a Playwright Chromium browser:

```sh
python3 -m pip install -r requirements.txt
python3 -m playwright install chromium
python3 bc-ministry-primitives-v5/tests/test_reactive_tabs.py \
  --out /tmp/forestoval-reactive-tabs-qa
```

By default this builds and exercises the real studio with repository artwork.
The test uses `/usr/bin/chromium` when available, or Playwright's Chromium;
`CHROMIUM=/absolute/path/to/browser` overrides the executable.

The two default service substitute faces must be locally available at their
requested weights (Open Sans ExtraBold and Roboto Condensed Bold, as named in
`src/primitives.js`). The test checks font readiness and fails that check rather
than presenting fallback metrics as exact-font verification. Tests do not
request network fonts or distribute font files.

For source-only testing with a labelled minimal DOM/artwork fixture:

```sh
python3 bc-ministry-primitives-v5/tests/test_reactive_tabs.py --isolated \
  --out /tmp/forestoval-reactive-tabs-isolated
```

The isolated mode tests the actual JavaScript modules but **not** the production
HTML/CSS, real crest artwork, reference image alignment, or site deployment.
An optional `--baseline-dir /path/to/original/bc-ministry-primitives-v5`, used
only with `--isolated`, compares all 14 non-excluded recipes against a separately
loaded original engine with identical fixtures.

Tests cover 48 size/wording combinations, 24 independent raster containment
checks, live input, empty input, shared-state reset, delayed-render ordering,
guides, SVG/PNG/family exports, and finite bounds across composition types.
Containment checks cover the tested faces and strings, not all Unicode scripts
or all possible font substitutions.

## Verification

Run on a full checkout in Chromium with all four default role faces installed
locally at their requested weights:

- `test_reactive_tabs.py` against the built studio: 22/22.
- `test_reactive_tabs.py --isolated --baseline-dir` against the pre-change
  source: 24/24, including identical SVG and fit reports for all 14 recipes in
  reference mode.
- `test_browser.py`: 40/40, unchanged.
- `extract_primitives.py` leaves the generated files unchanged, and the site
  build (which builds the studio into `dist/studio/`) succeeds.
