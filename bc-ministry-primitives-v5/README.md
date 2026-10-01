# BC Ministry — shared primitives studio v5

Use the live copy at https://projects.ahmadjalil.com/forestoval/studio/, or build the standalone page and open **bc-ministry-primitives-v5.html** in a desktop browser:

```sh
python build.py
```

The built page is not tracked; `build.py` writes it from the readable sources (standard library only). The application itself has no build-time or runtime package dependency. The scene and references are inside the built file; the named fonts are not.

Start with **Long ministry · Wildfire**. Change its ministry wording, then choose a different recipe. In **Shared typography roles**, change `crest-condensed`: the two long-name crests and the BCTS wildlife crest update together. The heavy Wildfire Service tab does not change. Use **Source**, **Overlay** and **Rules** to inspect the result. The overlay allows only a uniform whole-reference scale and translation.

If the font status is amber, use **Load reference faces online** or install the exact face/weight locally before comparing. This button contacts Google Fonts. It does not upload the wording. No font files are included in this package or the exported SVG. Offline use is supported with installed fonts; otherwise the visible fallback warning remains.

## What was actually changed

This is a consolidated new build from the earlier **bc-ministry-logo-studio-v3.html** and the current ZIP's references. The current ZIP contained images and SVG references, not a newer application's implementation. It is not a patch claimed against an unseen v4.

The prior mixed model of per-preset font/width/curve overrides and optional character-level calibration has been replaced by one live-text engine. Each curved phrase is one SVG `text`/`textPath`; each straight phrase is one `text`. There are no individual glyph transforms, traced output alphabets, `textLength`, or `spacingAndGlyphs` adjustments. Native SVG text-path placement still rotates the characters along the baseline, as normal.

The wildlife and single-tree master artwork strings are unchanged. `data/art-sha256.json` records the imported master hashes. Recolouring is a fill/stroke mapping, not another copy or redraw of the scene. The source ribbon is one shared geometry instance, transformed for its upper-tab use. Parks and Airtanker retain their separate plate/wing component types.

Ten raster references were refreshed from the current archive's original bytes. In particular, the long Wildfire PNG now retains its transparency instead of the earlier JPEG conversion's black background. `data/reference-provenance.json` records those mappings and checksums.

Each reference image is stored once, as a file. `data/references.json` holds each one's name, size and registration, and its `file`: most are in `../shared-primitives/references/` (shared with the site); the three corrected source SVGs are in `data/references/`. `build.py` inlines them into the built page as data URLs.

## The component model

```
original scene + crest profile + text roles + tab + composition + content
```

| Layer | Owns | Change it here |
|---|---|---|
| Artwork master | Wildlife scene, tree scene, borders, source ribbon | `data/art.json` |
| Face catalogue | Family, real weight, exact local names, optional web source | `FACES` |
| Typography role | Face, shared cap multiplier, shared tracking adjustment | `ROLES` |
| Baseline slot | Cap-height target, radii, span limits, padding, minimum size | `SLOTS` |
| Crest profile | Scene + upper/lower slots + separator treatment | `CRESTS` |
| Service component | Reusable ribbon, upper ribbon, plate or wings + text slot | `TABS` |
| Colour recipe | Paint tokens only | `THEMES` |
| Composition | Crest/wordmark arrangement, row gaps and width budgets | `LOCKUPS` |
| Example recipe | Inheritance, component references and wording | `RECIPES` |

All tables are in `src/primitives.js`, except the artwork. `SHAPES` (crest centre, separator band, Parks plate, airtanker wings) and `RECOLOUR` (source colour → theme token) hold the few shapes and colours the engine draws itself; `../shared-primitives/extract_primitives.py` reads the same tables, so the shared primitives cannot drift from the engine. The tables are frozen. The UI owns validated patch maps and passes the same maps to all recipes. There are **14 active recipes, 11 shared typography roles, 12 baseline slots, 5 crest profiles and 7 composition types**. Fire Control remains an excluded catalogue entry, not a selectable family member or calibration target.

The basic inheritance is intentional:

- **Forests · Wildfire Service** inherits the plain Forests crest and adds only a tab and service wording.
- **Long ministry · Wildfire** inherits the plain long-ministry crest and adds the same heavy lower tab. It does not inherit its tab font from the condensed ministry role.
- **Wildfire Management** inherits the Forest Service crest and adds the wider upper-tab component. Its tab role can change independently from the crest.
- **BCTS** compositions reuse those exact crests. The acronym, descriptor and district use independent shared roles, with block placement based on measured visible ink.

## Typography decisions

These are working substitutes, not authenticated historical font identifications.

| Role | Current face | Reason for separating it |
|---|---|---|
| Wildlife capitals / heavy lower crest | Open Sans ExtraBold 800 | Shared heavy alphabet, different reference-derived baseline slots |
| Forest Service upper arc | Roboto Condensed Bold 700 | The supplied upper lettering is narrower than the heavy lower lettering; forcing the same broad face into both increased the discrepancy |
| Long ministry | Roboto Condensed Bold 700 | Mixed-case long wording needs its own shared oval profile |
| Lower Wildfire Service tab | Open Sans ExtraBold 800 | Must stay heavy when the ministry is condensed |
| Upper Management tab | Roboto Condensed Bold 700 | Separate cap/arc and independently swappable face; photo reference is not an exact master |
| BCTS acronym | Open Sans ExtraBold 800 | Shared acronym role with wider tracking calibrated against the supplied vector |
| Descriptor / district | Roboto Slab Bold 700 | Separate scale and role from the acronym; a serif substitute, not an exact Clarendon identification |
| Thin crest / plain labels | Roboto Regular 400 | Parks and plain BC/Timber/Sales treatment |

The face catalogue also offers alternatives; they are not silently chosen as a substitute for an unavailable weight. The default role weights were loaded locally during testing. Online loading and weights not used by the defaults were not externally verified in this environment.

The saved vector-reference character measurements were used only as calibration observations. The fitted quantities are whole-run cap height, radius and tracking, stored once per shared slot. No per-character measurements or shapes are used to render an export. The BCTS wordmark and descriptor spacing, gap and optical block centre were also adjusted against the supplied vector using whole-block measurements. Remaining letter-shape differences are visible in the overlay rather than hidden by glyph deformation.

## Dynamic fitting rules

1. Wait for the requested face/weight, or show an explicit fallback status.
2. Measure the face's actual capital-H height. A target cap height is converted to its font size; “70 px” in two unrelated fonts is not assumed to mean the same visible letter height.
3. Measure the whole phrase. On a curved run, include the browser's final tracking interval in the reserved advance. On a straight run, constrain the visible ink width and align its actual left edge.
4. Keep the preferred size for a short name. Reduce tracking only within the allowed range when needed.
5. Expand a crest arc only as far as its profile permits. Long-name and tab arcs have explicit limits.
6. Reduce font size uniformly if the run still does not fit. Move a curved baseline with the cap-height change so its ink midline stays near the intended band centre. Do not stretch glyph width independently of height.
7. Warn when the resulting lettering is below its minimum cap height. Fitting 320 characters proves the engine retains the wording; it does not make that wording a usable logo.

8. Separator marks sit on the separator band drawn in by the crest's `separatorInset`. With `separatorPlacement: 'follow-text'`, place each mark from the visible ends of the lines on its side. It stays at `separatorHomeY` (the sides) while both lines keep at least 50 units away along the band, is pushed by a line that comes closer, and once the gap is under 100 units sits exactly halfway between the two lines. The Forests reference keeps its marks 129 units from BRITISH COLUMBIA; the long ministry's sit about 40 units from each line. When the marks would touch a line, narrow the lower arc until they fit; otherwise warn (`SEPARATOR_CROWDED`).
9. With `fanOut`, a crest with a `fan` profile (the long crest) spreads its upper line toward the capitals look when the lower line leaves room. Letter height (up to ×1.166), letter spacing and word spacing grow together until the line comes within 129 units of marks at home, or as close to pushed marks as the lower line is.
10. With `centreInRing`, a crest line's baseline follows the frame's white ring (`SHAPES.rings`) rather than its slot ellipse, with its type body centred on the ring's centre line at every angle. The body is the cap height for capitals, and for lowercase the x-height plus 30% of the way to the cap height, blended by the share of lowercase letters. Slots with hand-set radii keep them.

Changing output width scales the complete SVG. The family is designed in a shared 676-unit crest coordinate space. The optional measured-name switch (`autoProfile`) chooses the short or long profile of a crest pair (wildlife capitals / long ministry, tree / long tree); it does not force uppercase or replace the user's wording.

Manual shared-slot calibration is intentionally exposed, but extreme radius or cap changes can move text out of its intended band. The automatic defaults and stress cases were tested; arbitrary manual combinations are not a guarantee of an acceptable design.

## Exports and integration

**Editable SVG:** coherent text plus shared vector artwork; fonts referenced by name, not embedded. The exported SVG contains metadata with its normalized configuration and resolved typography. Font installation and rendering in the destination editor still matter.

**PNG:** a fixed raster rendering. When a font was loaded online, its bytes are used transiently inside the rasterization image, not retained in the downloadable SVG. The rasterization code releases its temporary object URL. Use PNG when fixed appearance matters more than text editing.

**Configuration:** a version-5 JSON state, including the shared role/slot patch maps. Earlier per-logo configurations are explicitly rejected instead of silently importing obsolete glyph-stretch settings.

**Family SVGs:** all 14 active recipes generated through the same engine and shared patches; the selected example retains its current wording, while the others use their default wording. Fire Control is not exported.

Browser integration after loading the artwork data, `primitives.js` and `engine.js`:

```js
const shared = {
  roles: {
    'crest-condensed': { face: 'condensed-bold', capScale: 0.98 }
  },
  slots: {}
};
const config = BCLogo.recipeState('long-wildfire', shared);
config.content.lower = 'Forests, Lands and Natural Resource Operations';
config.outputWidth = 1800;
const result = await BCLogo.render(config, { allowNetwork: false });
document.getElementById('preview').replaceChildren(result.svg);
const editableSVG = BCLogo.serialise(result);
console.table(result.report);
```

`window.BC_ART` can supply the master JSON before `engine.js` is evaluated. Otherwise it reads the `art-data` JSON script element. TypeScript declarations are in `src/engine.d.ts`. Choose unique SVG `prefix` options when supplying your own prefixes; the default engine-generated prefixes are unique within a document.

## Build and validation

To rebuild the standalone file from the readable source modules:

```sh
python build.py                 # or: python build.py --out somewhere/studio.html
```

To rerun the browser regressions:

```sh
python -m pip install -r ../requirements.txt
python -m playwright install chromium
python tests/test_browser.py
```

The test runner also supports an existing browser through `CHROMIUM=/path/to/chromium`. It builds the page into `tests/output/` and loads it directly into a browser document, so no HTTP server is needed. The screenshots, PNG export and `results.json` also go to `tests/output/` (not tracked); `--update` also refreshes the committed copies in `review/` and `tests/results.json`.

The default faces (Open Sans ExtraBold, Roboto Condensed Bold, Roboto Slab Bold, Roboto Regular) must be installed locally, or pass `--network-fonts` to load them from Google Fonts. Without them the font check fails and three lettering-band checks measure fallback fonts, so 36/40 is the expected result on a machine without the faces. The results record where the faces came from.

The recorded run passed **40/40 checks**, including all active recipes, exact inherited crest-typography equality, no stretched text, finite bounds, reference integrity, PNG/ZIP export, configuration round trip, 27 wording stress cases, all composition types, six pixel-mask checks that lettering remains inside its band, and a 390-pixel mobile viewport. The full results are in `tests/results.json`.

Those are implementation tests, **not a pixel-perfect historical fidelity certification**. Chromium with installed local fonts was tested. Safari, Firefox, Illustrator and Inkscape were not tested. The original typeface identities remain unresolved. Wildfire Management, Parks and Airtanker remain photographic interpretations; Fire Control is excluded. Other writing systems can require fallback glyphs even when the Latin reference face is loaded.

## Technical references

- SVG 2 text and text-path layout: https://www.w3.org/TR/SVG2/text.html
- Font loading: https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/load
- Visible font ascent metrics: https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics/actualBoundingBoxAscent
- Explicit Google Fonts weights: https://developers.google.com/fonts/docs/css2

This is a reference-based reconstruction utility, not an authenticated government identity master or an authorization to use a protected mark.
