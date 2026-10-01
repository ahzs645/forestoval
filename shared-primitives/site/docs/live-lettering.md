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

A preset is a starting point, not a fixed layout. Four options, all on for new
drafts, let one preset become another by editing its text:

- **Pick the short or long crest from the wording** (`autoProfile`). On the
  wildlife crests the engine measures the lower wording. A short name keeps the
  capitals crest; a ministry-length name moves to the long crest. Typing
  *British Columbia* / *Forests, Lands and Natural Resource Operations* into
  Forests · Wildfire Service gives the long ministry badge, and *FORESTS* in
  Long ministry · Wildfire gives the capitals badge. The wording's case is kept.
  Choosing a crest profile by hand turns this off.

  The tree crest uses the same switch. Crests come in pairs, declared in
  `CRESTS` (`longer` / `shorter`, and the short profile's `switchCap`):
  `wildlife-caps` / `wildlife-long` and `tree-heavy` / `tree-long`. No tree
  reference has long wording, so `tree-long` reuses the long-ministry slots on
  the tree scene. Its diamonds are scaled like the wildlife pair's marks
  (16.76 → 11.92), and it has the same spreading profile. Every rule below
  applies to the tree crest unchanged, with its diamonds as the marks. They
  sit within 1.5 units of the Forest Service reference's diamonds. The tree
  crests centre their lines 4.5 units inside the ring (`ringOffset`), as the
  Forest Service vector does. That puts both lines within 1 unit of it in
  radius and within 1° at their ends. The tree crest's lettering is calibrated
  to that vector too (reference model version 2): Open Sans Bold above, and
  Raleway Black below. The vector's lower line is a geometric gothic whose A
  has a flat apex, which rules out Futura-style faces. The letters overlap it
  0.61 / 0.67, up from 0.40 / 0.36.

  The Wildfire Management tab sits on the oval. Its holder is built on the
  frame's outer oval at ±60° (what its wording needs at its cap height),
  matching the patch photos. It used to be the lower ribbon flipped and scaled
  up, which floated 39 units above the oval.
- **Separator dots: follow the lettering** (`separatorPlacement: 'follow-text'`).
  Each dot is placed from the visible ends of the two lines on its side:
  - *at home*: at the sides while both lines stay at least 50 units away
    (Forests keeps BRITISH COLUMBIA 129 units from its dots);
  - *pushed*: a line that comes closer pushes the dot along the band;
  - *halfway*: once the gap is under 100 units, the dot sits exactly halfway
    between the two lines (the long ministry badge: about 39 units each side).

  Each side is placed on its own, since the end letters differ. The references'
  pairs aren't mirror images either. When the dots would touch a line, the
  lower line's arc narrows until they fit; otherwise `SEPARATOR_CROWDED` is
  reported. With one line empty the dots keep their reference position.
  *Keep the reference position* restores the fixed heights.
- **Spread the upper line when there is room** (`fanOut`). On the long crest,
  a short lower line leaves the top of the band mostly empty. The upper line
  then grows toward the capitals look (letter height up to ×1.166, plus letter
  and word spacing) until its ends come within 129 units of dots at home, or
  as close to pushed dots as the lower line is. The dots then end up halfway.
- **Centre each line in the white ring** (`centreInRing`). Each slot's baseline
  ellipse was calibrated where its reference wording sits, so wording that runs
  further round could drift toward one black ring. The capitals ministry slot
  was 10 units too wide at the sides. With this option every crest line follows
  the ring's own centre line at every angle, and centres its type body there:
  the cap height for capitals, and for lowercase the x-height plus 30% of the
  way to the cap height. That is the usual practice of centring mixed case on
  the x-height, then adjusting by eye; the long ministry reference sits 30% up.
  The two are blended by the share of lowercase letters, so typing never makes
  a line jump. The ring is the frame's own white ellipse, which is the same in
  the tree frame to within half a unit. A slot whose radii were set by hand
  keeps them.

  Measured against the white ring, *Forests, Lands and Mines* on the capitals
  crest goes from 13 units nearer the outer ring to centred. All-caps lines now
  stay within about 3 units of centre all the way round (the long crest used to
  drift by 20). The cost is 1–3 units against individual references, which were
  not all centred the same way. Unticking the option gives the calibrated slot
  geometry back exactly.

Either way the dots sit on the separator band drawn in by the crest's
`separatorInset`: 3.34 units on the capitals crest, measured from
`wildfire-source.svg`, and 7.67 on the long crest, measured from both
long-crest rasters, which agree. The shared band alone put them 3–8 units too
far out, mostly sideways.

The note under these controls names the crest the wording picked and what the
dots and upper line are doing. Drafts saved before these controls existed
(storage payload versions 1–3) adopt the new defaults when loaded.

A mouse click on a text character or keyboard Enter/Space opens the selected
line's HTML input below the preview. The caret remains in a conventional input;
this is not a fabricated curved contentEditable caret. The actual SVG text
updates while typing. Escape/Done returns focus to the sidebar. Multiline stacked
wordmarks use their textarea. Empty inscriptions remain recoverable there.

Each preset keeps its own normalized draft using a separate localStorage key,
`forestoval-compose-lettering-v1` (payload version 4); restricted storage leaves an in-memory draft.
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
both directions, that the dots sit where the references put them and halfway
between squeezed lines, that the long crest spreads its upper line when there is
room, that lines are centred in the ring (and that unticking restores the slots), that the tree crest follows the same rules with its diamonds, that the
Wildfire Management tab sits on the oval, that the dots move with
the wording and leave room when both lines are full, and that older drafts adopt
the new defaults. It also confirms that every face loads from the bundle and
matches its calibration advance, that the service backing defaults per preset,
that exports with a fallback face need consent (it blocks the bundled Noto file
and all local faces in a second page), and that the Recreations cards show the
engine's lettering with the same advances, and that the font button reloads the
bundled face once it is reachable again. All 53 checks passed against
`npm run dev` and against the production build on a machine with none of the
faces installed. A separate check confirmed that the three engine scripts load
from `assets/` when the build is served under a sub-path like `/forestoval/`, that
native localStorage drafts survive a reload, and that the studio is still emitted
at `studio/`.

`--html /path/to/live-lettering-demo.html` runs the controller and engine in a
portable standalone fixture with an in-memory Storage implementation. It does
not validate React hooks, Vite bundling, native localStorage or the deployment.
