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

New drafts default to `reference-calibrated`, with automatic profile switching
off. Uncalibrated slots retain the engine's own warning; having a selectable
preset does not mean all its lettering has received reference calibration.

A mouse click on a text character or keyboard Enter/Space opens the selected
line's HTML input below the preview. The caret remains in a conventional input;
this is not a fabricated curved contentEditable caret. The actual SVG text
updates while typing. Escape/Done returns focus to the sidebar. Multiline stacked
wordmarks use their textarea. Empty inscriptions remain recoverable there.

Each preset keeps its own normalized draft using a separate localStorage key,
`forestoval-compose-lettering-v1`; restricted storage leaves an in-memory draft.
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

Font files are not included in this integration. Existing v5 local-face loading
is used first. **Load reference fonts online** explicitly enables the engine's
Google Fonts loader. A fallback warning stays visible when the requested face
is not verified. Loading success and historical authenticity are distinct.

SVG uses `E.serialise()` and retains editable text, not embedded font binaries.
PNG uses `E.png()`, which captures the current result. Font delivery, local font
availability and other SVG consumers can change appearance. Test the live build
with the intended fonts before accepting visual fidelity.

## Verification

With the app running and the named reference fonts installed:

```sh
python3 tests/test_live_lettering.py --url http://localhost:5173/#/compose
```

Use the actual Vite URL/base path when it differs (`npx vite preview` serves the
production build on port 4173). The full-URL mode checks the React wrapper, both
Compose modes and the existing layer presets. It requires the normal Python
Playwright dependency from the repository requirements and Chromium (or
`CHROMIUM=/path/to/browser`). Results and screenshots go to `tests/output/`.

All 31 checks passed against both `npm run dev` (React StrictMode) and the
production build. A separate check confirmed that the three engine scripts load
from `assets/` when the build is served under a sub-path like `/forestoval/`, that
native localStorage drafts survive a reload, and that the studio is still emitted
at `studio/`. Without the named faces installed locally, the "no fallback" check
fails by design.

`--html /path/to/live-lettering-demo.html` runs the controller and engine in a
portable standalone fixture with an in-memory Storage implementation. It does
not validate React hooks, Vite bundling, native localStorage or the deployment.
