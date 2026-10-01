# Shared primitives — isolated building blocks

Every reusable vector piece from the current work, one standalone SVG per piece.
Open **index.html** for a contact sheet. `manifest.json` lists each file with its
source and viewBox.

This folder is generated from `../bc-ministry-primitives-v5` and `../airtanker-operations`
(read only). Each value lives in one place:

| What | Its one home | Used by |
|---|---|---|
| Scene, frame and ribbon artwork | v5 `data/art.json` | v5 engine, `extract_primitives.py` |
| Shapes the engine draws (crest centre, separator band, plate, wings), source colour → theme token map | v5 `src/primitives.js` `SHAPES`, `RECOLOUR` | v5 engine, `extract_primitives.py` (reads the tables) |
| Separator sizes and heights, themes | v5 `src/primitives.js` `CRESTS`, `THEMES` | same |
| Airtanker palette | `../airtanker-operations/generate.py` `Palette` | the package, the `airtanker` theme here |
| Reference images | `references/` here | the site, and the v5 studio (its `data/references.json` points here) |
| Placements, crest centres, the tab's parameters | `layout.json` (generated) | the site |
| Tab shape (span, depth, border, end lean) | `extract_primitives.py` `TAB` | the tab file, and `site/src/tab.ts` for grown tabs |
| Crest lettering | v5 `examples/*.svg` → `lettering.json` (generated, text only) | the site |

CI reruns `extract_primitives.py` and fails if the committed output differs.

## One crest

Every logo is built on **one crest frame** (`bc-ministry-v5/crest/frame.svg`) with a
scene placed in its window. There are two scenes:

| Scene | Used by |
|---|---|
| `scenes/tree.svg` (shared tree scene) | Forest Service, Wildfire Management, Parks, Airtanker (v5 and package), BCTS tree, BC / Timber / Sales, branch strip |
| `scenes/wildlife.svg` | Forests, Long ministry, BCTS wildlife |

The old wildlife and tree frames were already the same oval. The script checks this
on every run and stops if they differ by more than 0.5 units; they agree within 0.38.
The tree scene used to draw its own sky oval and inner ring about 1.3 / 1.6 units off
centre. Now the ring comes from the shared frame, the sky fills the shared window,
and the tree artwork is shifted by that offset so it sits centred.

## Coordinates

Each file keeps the piece's original coordinates and only crops the `viewBox`.
So a piece displays on its own, and its inner `<g>` can be pasted back into its
family's design space and still line up:

| Folder | Design space |
|---|---|
| `bc-ministry-v5/` | 676-unit crest space, centre (338.37, 420.96) |
| `airtanker-operations/` | 1448 × 1086 space of `airtanker-operations-editable.svg` |

`layout.json` holds every placement: separator positions, the upper-tab transform,
and the transform that fits the shared crest into the airtanker layout (`crestTransformAttr`).
Masters placed at the origin (`marks/*`, `airtanker-operations/diamond.svg`) are placed
from there.

Scene parts keep the crest window clip they have in place (for example, the elk's
neck ends at the oval edge). Colours are the source colours.

## Contents

**bc-ministry-v5/** — from `data/art.json`, plus shapes that exist only as code in `src/engine.js`

- `crest/` — `frame` (shared), and the two finished blank crests: `tree-crest`, `wildlife-crest` (frame + scene, no lettering)
- `scenes/` — `tree` (shared), `wildlife`
  - `tree-parts/` — sky, distant-forest, mountains, conifer. The source paints the conifer's branch notches in the sky colour; here they are cut out as transparent holes. The source canopy path also contains the small forest cluster at lower left.
    Plus `mountain-ridge`: just the top edge of the mountains, drawn as a 7-unit line in the lettering ink. The full-colour scene doesn't use it. The single-colour Forest Service crest and the Airtanker crest draw their mountains with it, because their themes turn the mountains' fill into the background colour.
  - `wildlife-parts/` — sky, mountains, distant-woodland, river, river-bank, large-tree, small-tree, eagle, elk, fish
- `marks/` — separator circle (wildlife crests) and diamond (tree crest)
- `tabs/`
  - `service-ribbon` — the Wildfire Service tab. It is drawn from parameters, not traced: a paper face 85.5 units deep on the crest's outer oval, a 15-unit ink border that tucks 8 under the crest's ring, ends leaning 14° toward the middle, and a half-span of 49.7° of the oval's angle. Those numbers were fitted to the v5 traced ribbon (they differ only by slivers along its traced edges). Because it is a band around the oval, a tab can **grow**: a larger half-span wraps it further round (`TAB` in `extract_primitives.py`, copied to `layout.json` `tab`; `site/src/tab.ts` draws any span, and Checks confirms it draws exactly this file at the default). In Layer assembly, *Tabs* sliders grow the lower and upper tab by hand. The Wildfire Management upper tab is this same shape turned upside down (rotated 180° about the crest centre, same size), so it hugs the oval the way the lower tab does. The v5 engine also scaled it by 1.10 and moved it up 7, which left a gap of about 38 units at the top. Scaling by 1.10 about the top of the oval instead still lifts the tab's ends about 14 units off the oval.
  - `parks-plate` — in Parks theme colours.
  - `airtanker-wings`, `airtanker-band` — the v5 engine's photo-based approximation. Its colours are fixed in the engine.

**airtanker-operations/** — only the package's own parts: `lower-band`, `wing`
(single master), `wings-pair`, `diamond`. Its hand-drawn oval and landscape were
replaced by the shared crest frame and tree scene. The crest is scaled ×1.025 to the
old oval's width and midpoint, so the wings still meet it. It is shown in the
`airtanker` theme, which uses the package palette: navy `#002950`, gold `#FFCA05`.
The oval is now symmetric; the old one had different upper and lower radii. The
diamonds sit on the shared band. The originals remain in `../airtanker-operations/`.

Retired: the separate tree frame, the tree scene's own sky oval and ring, and the unused
single-colour tree (`treeMono`; the `mono` theme recolours the shared tree scene instead).

Lettering is not included. Text is live and font-dependent, and it is fitted per logo by the engine.

## Viewer and test site

`site/` is a React app for browsing and testing the pieces. It reads the SVGs,
`manifest.json`, `themes.json`, `layout.json` and `lettering.json` from this folder directly, so it always shows
the current output.

```sh
cd site
npm install      # first time only
npm run dev      # then open the printed URL
npm run regen    # rerun extract_primitives.py; the page reloads
```

- **Live lettering** (the first tab; the site opens on it): runs the v5 studio engine on any active recipe: click the curved text (or use the sidebar fields) to retype it and the reference-calibrated fit updates live; each preset keeps its own draft, and SVG, PNG and configuration exports come from the engine. *Airtanker Operations · package* letters the Recreations airtanker badge (package band and wings, shared crest) live. See [`site/docs/live-lettering.md`](site/docs/live-lettering.md).
- **Library:** the 15 building blocks, grouped as Crest, Scenes, Separators, Service tabs and Airtanker package. Scene parts are hidden by default. They appear in their scene's detail panel, with the *Show scene parts* toggle, or in search results. Click a piece to see its details and download it as SVG or PNG. The colour and backdrop menus apply here, in Live lettering and in Layer assembly; Recreations uses each logo's own theme and only takes the backdrop.
- **Recreations:** each supplied reference next to the same logo rebuilt from the primitives. The lettering is drawn by the live v5 engine with the same recipe and configuration as the Live lettering editor (including the service holder's backing); the saved reference fits and the saved v5 examples remain as two legacy lettering modes. There are four views: side by side, a draggable wipe, an overlay and a difference blend. Each card lists the primitives used, where its lettering comes from, the reference file, how it was lined up, and any alternate copies in the folder.
- **Layer assembly** (`#/compose`): stacks pieces in their shared coordinates, with presets for each logo. You can overlay the finished logo (loaded when picked); with *Difference blend* on, matching artwork turns black. There are also guides for the crest centre and each piece's viewBox. With a tab in the stack, *Tabs* sliders grow it around the oval; downloads include the grown tab.
- **Checks:** runs in the browser. For every file it checks the XML, viewBox, that the file is self-contained, internal references, unique ids and theme coverage. It also checks nothing falls outside the viewBox (rendered with a margin) and measures the padding. It stacks each set of parts and compares them pixel by pixel with the composite they came from.

`npm run build` writes a static copy to `site/dist/`, with the v5 studio built into `dist/studio/` (it runs `../bc-ministry-primitives-v5/build.py`, so it needs `python3`). Serve it with `npm run preview`; browsers block the module script if you open `index.html` directly from disk. The deployed site links the studio from its header.

## Reference images (Recreations)

`build_gallery.py` copies the supplied reference folder into `references/` and
writes `gallery.json`, which records the logo each image belongs to and the
rectangle, in that logo's coordinates, where the image lines up with the rebuild.
Images are recognised by content (SHA-256), so the folder can be the original
one or `references/` itself, to re-register the current copies. The new
`references/` is built beside the old one and swapped in only when the run
succeeds. It needs Pillow (`pip install -r ../requirements.txt`).

```sh
python build_gallery.py "path/to/supplied images"
python build_gallery.py references     # re-register what is already here
```

The v5 studio uses these files too (its `data/references.json` points at them),
so keep the file names: the script checks that every studio reference still exists.

- **v5 studio rectangles** (12 images): the image's SHA-256 matches `data/reference-provenance.json`, or it's one of the two supplied SVGs with an exact size match. The Airtanker rectangle is moved into the package layout using the shared-crest transform.
- **Outline fit** (6 images): the transparent or white-background crests, and the greyscale photo of the Wildfire Management patch (on a flat grey backdrop, fitted to the crest plus its upper tab). The visible outline is scaled by height to fit the crest's outline. The five drawn crests match the crest's proportions to within 7% (width ratio 0.99–1.07); the patch is 13% wider (1.13), as embroidered patches are.
- **No overlay** (3 images): other screenshots and exports of the same logos, and a banner showing BCTS in use. These show side by side only.

### Fitting the lettering to each reference

The v5 studio fitted its lettering to its own settings, not to these images, so on
several references (Long ministry especially) the words sat in visibly different
places. `fit_lettering.py` fits each recreation's lettering to its primary
reference and writes `lettering-fit.json`, which the site applies in the
*Saved reference fit · legacy* mode of the Recreations tab; *Saved v5 examples ·
legacy* shows the unfitted placement. The default *Live engine* mode uses
neither: it draws the engine's current reference-calibrated lettering.

```sh
python fit_lettering.py                 # all recreations, about 4 minutes
python fit_lettering.py long-ministry   # one
python fit_lettering.py forests-wildfire wildfire-management fire-control   # several
```

It runs in headless Chromium through `site/fit.html` (`site/src/fit.ts`), so the text
is laid out with the same fonts and SVG text engine as the site:

- **Finding the reference's letters.** The lettering areas are the paper band, ribbon and plate, the branch strip's bar, the airtanker band's cream face, and the open page around lockup lines. They come from our artwork drawn in flat test colours on the reference's pixel grid. In each area, the reference's pixels are split into two colour groups; the letters are the group farther from that area's background. Only parts of an area where the reference really shows that background nearby are kept, so a longer bar or a misaligned edge isn't read as letters.
- **What is adjusted, per line of text:**
  - size;
  - letter spacing;
  - each word's own spacing, and the gap before it;
  - for curved lines, how far each side of the baseline ellipse moves and the rotation along it;
  - for straight lines, the position.

  Curved lines are re-anchored at their first letter, so widening one gap only moves the words after it. Glyphs are never stretched, and the text stays live (words become `<tspan>`s).
- **Scoring.** Our glyphs, as laid out by the browser, are compared with the reference's letters by overlap. A rough first pass (rotation, size and spacing searched together) is followed by a pattern search.
- **What stays at the v5 placement.** A fit is only used if it improves the overlap. A line whose letters fall mostly outside any lettering area stays at its v5 placement: the branch strip's tiny crest lines are the only case.
- **Lettering around the oval: one fit per crest variant.** The crest lines come in four variants, each with the same text, face and baseline on every logo that uses it:

  | Variant | Lettering | Logos |
  |---|---|---|
  | Wildlife crest, capitals | BRITISH COLUMBIA / FORESTS (Open Sans 800) | Forests, Forests · Wildfire Service |
  | Wildlife crest, long ministry | British Columbia / Forests, Lands and Natural Resource Operations (Roboto Condensed 700) | Long ministry, Long ministry · Wildfire Service, BCTS · wildlife crest |
  | Tree crest | FOREST SERVICE (Roboto Condensed 700) / BRITISH COLUMBIA (Open Sans 800) | Forest Service · single colour, Wildfire Management, Fire Control, Airtanker, BCTS · Forest Service, BCTS · district, BC / Timber / Sales, Forest Analysis & Inventory |
  | Parks | FOREST SERVICE / BRITISH COLUMBIA (Roboto 400) | Parks only, fitted alone |

  Each of the first three is fitted once, against all its logos' references at the same time (`fitVariant` in `site/src/fit.ts`; saved under `crest-wildlife-caps`, `crest-wildlife-long` and `crest-tree`). Each reference is judged only on the crest's lettering band and counts equally. The logos then use that fit unchanged (`crest()` in `recreations.ts`), and their own fits cover only their other lines (tab, wordmark, strip). The Recreations page lists the variants with each logo's overlap on the crest band. Clean references match the shared fit better than their starting (v5) placement; the photographed patches and the decal stay about the same, since they disagree with the drawn logos. Overall, the logos fitted to photos lose some overlap compared with fitting each on its own (Fire Control 0.60 → 0.48, Airtanker 0.62 → 0.54, Long ministry 0.86 → 0.81); the rest change by less than 0.02.

  `python fit_lettering.py crest-tree` refits one variant; then refit its logos too.
- **Shared lettering.** The upper-tab lettering is not fitted per logo. It is the Forests · Wildfire Service lower tab as fitted, flipped onto the top tab, so it is the same on each logo that has one (Wildfire Management, Fire Control):
  - The fitted "WILDFIRE SERVICE" run goes through the upper-tab transform (`layout.json` `upperTabTransform`): baseline, size, letter-spacing, word gap and tracking carry over unchanged, and only the words change. Rotated, the letters would hang upside down, so the baseline runs the other way and moves to the inner edge of the same band of letters. The line is centred where the fitted line's middle lands; the fit records that angle as `centre`.
  - *Too long for the tab.* Upright letters stand on the inner edge of the band and fan outward, so a line covers more of the tab than it does hanging from the outer edge. The words may only cover the stretch of tab that the fitted lower line covers, carried through the same transform. Anything longer **grows the tab** around the oval, keeping the same clearance to its ends, up to a half-span of 80°; only past that are the words shrunk evenly (size, spacing and gaps together, letters never squeezed). The grown half-span (`span`) and any shrink are recorded under `shared` in the fit, and the recreation draws its tab at that span. "FIRE CONTROL" fits the default tab at full size.
  - *Wildfire Management* follows its patch, which letters the top tab end to end in a condensed bold face. Same placement, but in Roboto Condensed 700, with capitals the same height as the shared lettering and the letter-spacing set so the words cover exactly that stretch of tab (`face` and `fillTab` in `recreations.ts`). Even with no letter-spacing, "WILDFIRE MANAGEMENT" is too long for the default tab, so the tab grows from ±49.7° to ±57.8° and the words stay full size (they used to be shrunk to 84.0%). The patch's own top tab is longer still.

  When Forests · Wildfire Service is refitted, refit the logos that share its tab too (`python fit_lettering.py forests-wildfire wildfire-management fire-control`). Given several ids, the fitter fits the source first.

Overlap with each reference's letters, before and after fitting: Long ministry 0.66 → 0.86, Long ministry · Wildfire 0.53 → 0.75, BCTS district 0.47 → 0.95, BC / Timber / Sales 0.58 → 0.92. The photographed patches (Parks 0.32 → 0.48, Airtanker 0.52 → 0.62) stay rougher: their embroidered or painted letters are heavier than the substitute fonts.

The two upper-tab logos score lower because their tab lettering is shared rather than fitted to their own photos: Wildfire Management 0.67 → 0.71 (0.77 when its tab was fitted separately), Fire Control 0.46 → 0.60 (was 0.61). The patches use a narrower face on their top tabs, which fits more letters on the tab.

The lettering in the recreations is the v5 studio's live text for the same crest,
taken from the v5 `examples/*.svg` (only their text, baselines and the branch strip's bar are kept, in `lettering.json`;
their artwork is the primitives). For the airtanker, the band text comes from the package
master. The fonts (Open Sans 800, Roboto Condensed 700, Roboto Slab 700, Roboto 400)
are bundled through `@fontsource`, so the page renders offline. Fire Control, which
the v5 studio excluded, uses the Wildfire Management crest lettering; its tab uses the shared lettering above.
The *v5 studio lettering* switch shows what the studio drew, including its own tab lettering.

Build order: `extract_primitives.py`, then `build_gallery.py`, then `fit_lettering.py`.
`fit_lettering.py` needs Playwright and Chromium (`pip install -r ../requirements.txt`, then
`python -m playwright install chromium`, or set `CHROMIUM=/path/to/chromium`) and `npm install` in `site/`.
Scores depend on the browser and its font rendering, so a refit on another machine can land slightly differently.

## Regenerate

`extract_primitives.py` needs Python 3.9 or later, standard library only:

```sh
python extract_primitives.py
```

It writes the SVGs, `manifest.json`, `layout.json`, `themes.json`, `lettering.json`
and `index.html`, and deletes pieces the previous manifest listed that it no longer
writes.

To also write the v5 pieces recoloured into `themes/<name>/` (not tracked; listed in
`themes/manifest.json`, which the site does not read), use the themes in
`src/primitives.js` (`wildlife`, `forest`, `mono`, `parks`, `gold`) or `airtanker`:

```sh
python extract_primitives.py --theme gold --theme mono
```

The recolouring uses the same source-colour → theme-token map as `engine.js`
`recolour()` (`RECOLOUR` in `primitives.js`). The airtanker package has its own palette flags in its `generate.py`.

These are reference-based reconstructions, not authenticated government identity masters.
