# Live lettering inside Compose

The main viewer's Compose tab now offers two modes:

- **Live lettering** mounts the same v5 engine and reads the same `BCPrimitives.RECIPES`
  catalogue as the standalone studio. Click curved text to open its inline input,
  or edit the labelled sidebar fields. The selected profile fits the wording live.
- **Layer assembly** retains the previous Compose implementation and its presets,
  arbitrary layer combinations, Airtanker package, comparison overlays and exports.
  These arbitrary layer combinations are not converted into editable text recipes.

This is an interface integration on top of reference-lettering v2, not another
font-fitting patch. It does not retune or copy the calibration coefficients.

## Run

```sh
cd shared-primitives/site
npm ci
npm run dev
```

Open the URL printed by Vite, select **Compose**, then **Live lettering**. The
production route is `#/compose` under the site's existing base URL. The existing
build script builds both the React viewer and standalone `dist/studio/` page.
No package.json, lockfile, workflow or extra npm dependency change is required.

The editor needs the reference-lettering v2 engine (`src/engine.js` and
`src/primitives.js` under `bc-ministry-primitives-v5/`). The runtime checks for the
v2 policy and reference catalogue and displays a rebuild message rather than
falling back to an older fitting policy. Only `components/Compose.tsx` changed
among the existing files; the rest of the integration is new files.

## Editing and presets

The preset dropdown comes directly from all active v5 recipes, with four quick
buttons for the supplied wildlife references. In the delivered v2 catalogue there
are 14 active recipes; excluded Fire Control is not offered. Recipe inheritance
still supplies the wording, crest, tab and layout. The UI does not maintain a
second collection of preset coordinates.

New drafts default to `reference-calibrated`. Uncalibrated slots retain the
engine's own warning; having a selectable preset does not mean all its
lettering has received reference calibration.

## The crest follows its wording

A preset is a starting point, not a fixed layout. Two options, both on for new
drafts, let one preset become another by editing its text:

- **Pick the short or long crest from the wording** (`autoProfile`). On the
  wildlife crests the engine measures the lower wording. A short name keeps the
  capitals crest; a ministry-length name moves to the long crest. Typing
  *British Columbia* / *Forests, Lands and Natural Resource Operations* into
  Forests · Wildfire Service gives the long ministry badge, and *FORESTS* in
  Long ministry · Wildfire gives the capitals badge. The wording's case is kept.
  Choosing a crest profile by hand turns this off.
- **Separator dots: follow the lettering** (`separatorPlacement: 'follow-text'`).
  The dots sit in the gap between the end of the upper line and the start of
  the lower line, at the crest's `separatorGap` fraction of that gap. Each
  fraction is measured from the reference wording. The reference wording
  therefore puts the dots back on the crest's `separatorY`, and other wording
  moves them with the gap. When both lines run into each other, the lower
  line's arc narrows until the dots have room. If the dots still don't fit,
  they are centred and `SEPARATOR_CROWDED` is reported. With one line empty,
  the dots keep their reference position. *Keep the reference position*
  restores the fixed heights.

Either way the dots sit on the separator band drawn in by the crest's
`separatorInset`: 3.34 units on the capitals crest, measured from
`wildfire-source.svg`, and 7.67 on the long crest, measured from both
long-crest rasters, which agree. The shared band alone put them 3–8 units too
far out, mostly sideways.

The note under these controls names the crest the wording picked. Drafts saved
before these controls existed (storage payload version 1) adopt both defaults
when loaded.

A mouse click on a text character or keyboard Enter/Space opens the selected
line's HTML input below the preview. The caret remains in a conventional input;
this is not a fabricated curved contentEditable caret. The actual SVG text
updates while typing. Escape/Done returns focus to the sidebar. Multiline stacked
wordmarks use their textarea. Empty inscriptions remain recoverable there.

Each preset keeps its own normalized draft using a separate localStorage key,
`forestoval-compose-lettering-v1` (payload version 2); restricted storage leaves an in-memory draft.
Reset restores only the current preset. Opening a v5 configuration validates the
version and preset before replacing the draft. The engine's own normalization
still validates fitting policies and geometry overrides.

The site's palette controls are applied to the rendered configuration. Backdrop
is passed as a CSS variable to the canvas only. Saved/exported configuration
includes the effective colours of the last completed render.

## Shared engine bridge

`lettering/runtime.ts` imports the checkout's `art.json`, generated `layout.json`
and three script asset URLs. Vite serves/emits those same source files. The
loader sets artwork/tab data and loads primitives, tab layout and engine in
order, once. It does not use eval, an iframe, runtime GitHub fetches, or a duplicate
fitting implementation. React mounts/destroys the DOM controller and passes
palette/backdrop changes; the controller is independently browser-testable.

The native SVG lives in the document, so its loaded FontFace definitions are
available. Preview text gets click/keyboard affordances on a clone only.
Downloads use the untouched engine result. A revision counter prevents delayed
renders from replacing newer edits, and export controls stay disabled while the
latest edit is still rendering. Input nodes are not replaced during typing.

## Fonts and exports

The site ships its own copies of every lettering face (`lettering/fonts.ts`,
pinned Fontsource packages, emitted by Vite) and hands them to the engine before
it measures anything, so a machine without the fonts fits the same lettering.
Each loaded face is checked against the advance recorded for the calibration
face; *Resolved lettering measurements* lists each face's source and result.
**Load reference fonts online** remains as a last resort if the bundled files
cannot load. Loading success and historical authenticity are distinct.

Verified faces are the normal export path. When the latest render used a
fallback face or one whose advances differ (`FONT_FALLBACK`,
`FONT_METRICS_MISMATCH`), SVG and PNG stay disabled until the user ticks
*Export with unverified fonts anyway*; saving the configuration is unaffected.

SVG uses `E.serialise()`: editable text with local `@font-face` aliases, no font
binaries, so the destination still needs the faces installed. PNG uses `E.png()`,
which embeds the bundled face bytes in its transient rasterization.

The **Service backing** control sets the holder's face to paper or see-through.
It defaults per preset (Forests · Wildfire Service is see-through, as in its
reference) and does not change the lettering.

The Recreations tab draws the same engine output: each card renders its recipe
with this editor's default configuration, with no saved corrections.

## Verification

With the app running:

```sh
python3 tests/test_live_lettering.py --url http://localhost:5173/#/compose
```

Use the actual Vite URL/base path when it differs (`npx vite preview` serves the
production build on port 4173). The full-URL mode checks the React wrapper, both
Compose modes and the existing layer presets. It requires the normal Python
Playwright dependency from the repository requirements and Chromium (or
`CHROMIUM=/path/to/browser`). Results and screenshots go to `tests/output/`.

Beyond the editing checks, it confirms that the crest follows its wording in
both directions with the dots on their reference heights, that the dots sit
where the references put them, that the dots move with
the wording and leave room when both lines are full, and that older drafts adopt
the new defaults. It also confirms that every face loads from the bundle and
matches its calibration advance, that the service backing defaults per preset,
that exports with a fallback face need consent (it blocks the bundled Noto file
and all local faces in a second page), and that the Recreations cards show the
engine's lettering with the same advances, and that the font button reloads the
bundled face once it is reachable again. All 45 checks passed against
`npm run dev` and against the production build on a machine with none of the
faces installed. A separate check confirmed that the three engine scripts load
from `assets/` when the build is served under a sub-path like `/forestoval/`, that
native localStorage drafts survive a reload, and that the studio is still emitted
at `studio/`.

`--html /path/to/live-lettering-demo.html` runs the controller and engine in a
portable standalone fixture with an in-memory Storage implementation. It does
not validate React hooks, Vite bundling, native localStorage or the deployment.
