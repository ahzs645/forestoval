# @forestoval/live-lettering

The live lettering editor for the BC crest family as a self-contained package:
the bridge to the v5 engine (`bc-ministry-primitives-v5/src/engine.js`), the
lettering faces it bundles, the DOM editor, and badge presets built from the
shared primitives. The viewer site (`../site`) mounts it as its main tab; it also
runs and deploys on its own page.

Reference-based reconstructions, not authenticated government identity masters.

## Run

It is one npm workspace with the site (`shared-primitives/package.json`):

```sh
cd shared-primitives
npm ci
npm run lettering                                   # this package's own page
npm run build -w @forestoval/live-lettering         # typecheck + build to dist/
```

The site's build also emits this page at `lettering/` beside the viewer.

## Use

```ts
import { mountLiveLettering } from '@forestoval/live-lettering';
import '@forestoval/live-lettering/editor.css';

const editor = mountLiveLettering(document.getElementById('editor')!);
editor.setPalette({ text: '#000000' }); // optional: themes.json-style colours
// --fo-canvas-background on an ancestor sets the preview's backdrop
editor.destroy();
```

`mountLiveLettering(host, options)` is `new LetteringEditor(host, { runtime:
loadLetteringRuntime, compositions: BADGES, ...options })`. Pass `compositions:
[]` for the engine recipes alone, `storage: null` to keep drafts in memory, or
another `runtime` (the tests do).

| Module | What it is |
| --- | --- |
| `src/index.ts` | The public API. |
| `src/editor.ts`, `editor.css` | `LetteringEditor`: presets, fields, click-to-edit lettering, drafts, exports. |
| `src/runtime.ts` | Loads the engine scripts, artwork and tab profile once (`loadLetteringRuntime`). |
| `src/fonts.ts` | The bundled faces handed to the engine (`FONT_SOURCES`), and Kabel Black if committed. |
| `src/badges/` | Badge presets: `badge.ts` builds one from a definition; one file per badge. |
| `src/pieces.ts` | Loads generated primitives (`manifest.json`) on demand. |
| `src/svg.ts` | SVG plumbing shared with the site: matrices, theming, stacking pieces. |
| `src/app.ts` | The standalone page. |

The `./svg` export is what the viewer uses for its Library, Recreations and Layer
assembly, so both draw primitives the same way.

## Badges are data

A badge is an engine recipe's lettering drawn in other artwork. The engine still
fits every crest line with the recipe's configuration (Kabel, the crest picked
from the wording, the dots, ring centring), so a badge only describes where
things go. `src/badges/airtanker.ts` in full:

```ts
export const AIRTANKER = defineBadge({
  id: 'airtanker-package',
  name: 'Airtanker Operations · package',
  recipe: 'airtanker',                       // configuration, drafts, crest lettering
  theme: 'airtanker',                        // themes.json palette unless the host passes one
  artwork: [{ file: 'airtanker-operations/lower-band.svg' }, { file: 'airtanker-operations/wings-pair.svg' }],
  crest: {
    transform: layout['airtanker-operations'].crestTransform,   // places crest and lettering
    pieces: ['bc-ministry-v5/crest/frame.svg', 'bc-ministry-v5/scenes/tree.svg',
             'bc-ministry-v5/scenes/tree-parts/mountain-ridge.svg', 'bc-ministry-v5/scenes/tree-parts/mountain-base.svg'],
  },
  marks: { file: 'airtanker-operations/diamond.svg', drawnFor: 'tree-heavy' },  // at the engine's marks
  bands: [{ content: 'service', slot: 'airtanker-band', label: 'Airtanker band',
            master, text: 'airtanker-operations', face: 'condensed-bold' }],
  replaces: { slots: ['wings-label'], warnings: ['APPROXIMATION'] },
});
```

- **artwork / crest.pieces**: generated primitives by their `manifest.json` path,
  stacked back to front. Crest pieces go through `crest.transform`; artwork can
  take `instances` (one matrix per copy). Themable pieces take the palette.
- **marks**: a piece placed at each separator mark the engine drew, scaled by
  the crest profile's mark size relative to `drawnFor`.
- **bands**: curved lettering taken from a master SVG's `<text>` on a
  half-ellipse `textPath`: its words, curve, size, spacing and colours. It edits
  one content field (clicking it edits that field) in an engine face, which is
  loaded, verified and exported like the crest's. Longer words close the word gaps
  (to half), then shrink evenly (to 60%) centred on the band; `fit` changes those
  limits. Each band is reported under *Resolved lettering measurements*.
- **replaces**: the engine's own drawing the badge supersedes; those slots'
  measurements and warnings are dropped.

To add a badge: generate its pieces with `extract_primitives.py` (they appear in
`manifest.json`), add its crest transform to `layout.json` there, write a
definition next to `airtanker.ts`, and add it to `BADGES` in `src/badges/index.ts`.
It is listed after its recipe and keeps its own draft.

## Tests

```sh
python3 live-lettering/tests/test_standalone.py --url http://localhost:5174/
python3 site/tests/test_live_lettering.py --url http://localhost:5173/
```

The standalone test checks the package on its own page; the site test covers the
editor in full inside the viewer. The design notes are in
[`docs/live-lettering.md`](docs/live-lettering.md).
