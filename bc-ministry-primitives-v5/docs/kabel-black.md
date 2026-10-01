# Kabel Black: live tree-oval lettering

## Scope

This change integrates the user-selected `Kabel-Black.otf` into the existing v5
engine. The heavy tree oval uses Kabel Black for both `FOREST SERVICE` and
`BRITISH COLUMBIA`. Its long-name tree variant also retains Kabel instead of
switching silently to a condensed substitute. The thin Parks oval, wildlife
crests, service tabs and wordmarks keep their existing typography.

The live Compose editor, the standalone studio, and Recreations' **Live engine**
mode use the same shared source. The two **legacy** recreation modes and the
committed example SVGs remain historical comparison outputs; they are not
rewritten to resemble the new live output.

The source reference remains `data/references/tree-source.svg`. The new shared
profile uses one cap height, tracking value, word gap, arc-centre bias and
independent baseline-radius offset per line (v2). It uses ordinary editable text/textPath elements: no letter tracing,
horizontal stretching, synthetic bold, or individual glyph placement. Residual
letter-position differences against the supplied outline artwork remain. This
is a font integration, not authentication of the historical font master.

## The committed OTF

`fonts/Kabel-Black.otf` is committed for now (it is the one `.otf` the
`.gitignore` lets through), so local builds, the Pages build and the standalone
studio all bundle it and new tree-crest drafts use it. Kabel is a commercial
typeface: the repository and the published site distribute this file. To stop
that, delete it (and purge it from history if needed) and go back to one of the
supply routes below; everything keeps working without it.

## Supply your existing OTF

To replace or reinstate the file, from the repository root:

```sh
python3 bc-ministry-primitives-v5/tools/setup_kabel.py "/path/to/Kabel-Black.otf"
python3 bc-ministry-primitives-v5/tools/setup_kabel.py --check
```

The tool verifies the selected OTF's SHA-256 against
`data/kabel-black-font.json` and stages it at:

```text
bc-ministry-primitives-v5/fonts/Kabel-Black.otf
```

An OTF with a matching name but
different bytes is rejected by the setup tool and standalone builder. The
browser additionally checks the loaded face's probe advance against the
selected font's measured advance. A matching advance is a metric check, not a
proof of historical identity.

### Open the application

```sh
cd shared-primitives
npm ci
npm run dev
```

Open **Live lettering → Forest Service** (the site's first tab). In **Tree oval lettering**,
choose **Kabel Black · supplied OTF**. The source image remains available in
Recreations' comparison views; choose **Live engine** rather than a legacy mode.

New drafts select Kabel whenever it is available: bundled at build time, installed
locally, or loaded with **Load Kabel-Black.otf**. Loading it also switches the
current tree crest to Kabel. Without the font, new drafts and the Recreations
live view keep the calibrated v2 substitutes (Open Sans Bold / Raleway Black).
They do not fall back to Arial and lock exports behind the unverified-font
consent, which is what a public build without the font secret would otherwise
show. The standalone studio applies the same rule from its build input. Old
saved drafts/configurations retain
`reference-v2` until the selector is changed, so a browser with an older draft
will not necessarily switch its preview just because the code changed. An
explicit shared-role override also continues to win over the selected profile.

### Standalone studio (no npm build required)

```sh
python3 bc-ministry-primitives-v5/build.py
python3 -m http.server 8000 --directory bc-ministry-primitives-v5
```

Open this path on that local server:

```text
/bc-ministry-primitives-v5.html?recipe=forest-service
```

The builder inlines the supplied OTF into the locally generated studio so it
can also be used as a standalone document. The preview query selects a fresh
Forest Service configuration. As with other edits, later changes are saved by
the existing studio storage mechanism.

## Loading the file only in the browser

Both editors have a **Load Kabel-Black.otf** button. This reads the selected file
inside the current browser tab; it does not upload it or save the font into
localStorage/configuration JSON. It remains available for that page session,
including font retries. A full reload needs the file again unless the build
already supplies it or a matching local font is installed.

A missing OTF is reported as a fallback. Compose retains its existing explicit
consent requirement for unverified-font exports. Selecting online font loading
never sends Kabel to the Google Fonts endpoint. Returning to Recreations from
Compose remeasures its live output, rather than reusing a page-global rendering
made before the font was loaded.

## Export behaviour

**Editable SVG:** retains live text and local aliases for `Kabel Black` and
`Kabel-Black`, at weight 900. It does not embed font bytes. A destination
application must have the matching font available; local-alias support varies
by SVG consumer. Use PNG when the destination cannot supply the font.

**PNG:** uses the actual OTF bytes inside the temporary rasterization image,
then discards that temporary image. The MIME type is identified from the font
signature (`font/otf`), instead of incorrectly labelling every input WOFF2. The
PNG contains pixels, not a font file.

**Configuration and family export:** retain `treeLettering`. Missing fields
normalise to `reference-v2`; new editor drafts explicitly set `kabel-black`.
Other fit-policy controls and manual overrides remain independent.

## Optional GitHub Pages build input

While the OTF is committed, the workflow only checks it. Without it, the workflow
accepts a repository secret named `KABEL_BLACK_OTF_BASE64`. When
present, it decodes the value through the same checksum-validating setup tool
before the build. The font is not printed to workflow logs or committed by the
script. Empty secrets (including unavailable fork-PR secrets) leave a valid
build with the local-file picker and explicit missing-font warnings.

The setup tool can also consume any chosen build environment variable:

```sh
python3 bc-ministry-primitives-v5/tools/setup_kabel.py --from-env KABEL_BLACK_OTF_BASE64
```

Storing the input in a secret does **not** make the deployed font private: the
built site serves it to visitors, and the generated standalone studio contains
it. Only provide the font to a published build when you have the necessary
permission. Otherwise use the session-only file picker.

## Validation and limitations

Run after installing the OTF:

```sh
python3 bc-ministry-primitives-v5/tests/test_kabel.py
```

The test exercises the actual standalone builder and, when `tsc` is available,
the actual compiled Compose DOM controller. It is not a replacement for a full
Vite/React build. `--baseline /path/to/unmodified/repository` also compares all
56 pre-existing recipe/fit-policy combinations. Browser prerequisites are in
`requirements.txt`; `CHROMIUM=/path/to/chromium` can select a browser.

Patch-preparation results:

| Check | Result |
| --- | --- |
| Kabel-specific browser/controller checks | 33 passed, 0 failed |
| Pre-existing recipe/policy renderings | All 56 identical to the uploaded baseline |
| Bundled versus session-loaded OTF PNG | Identical decoded pixels |
| Affected Compose controller/types | Strict TypeScript check passed with available TypeScript 5.8.3 |
| Existing standalone regression suite | 46/47 both before and after; the same missing Raleway Black prerequisite failed |
| Generated shared primitives | Regeneration introduced no generated-file changes |
| Full locked Vite/React build | Not completed: npm registry DNS resolution unavailable in the test environment |

The locked dependencies and package lock were not altered to work around that
network problem. The new OTF asset lookup and production React/Vite mounting
still require the normal `npm ci && npm run build` check in a connected checkout.
The font setup, actual engine, file-loading controls and exports were exercised
without network font downloads.

The four shared profile parameters were fitted in-sample against the existing
SVG-derived ref-5 masks at fixed whole-logo registration. The fitting record is
`data/kabel-lettering-fit.json`. Its blurred image loss is not identification
confidence, and the earlier individual-glyph overlap is not a full-composition
accuracy score. Long-name tree layouts use the generic fit bounds and explicitly
report that no reference calibration is available for those long slots.


## Layout v2: measured cap height and independent line placement

The selected OTF contains a 720-unit H and a 518-unit x in a 1000-unit em.
The tested Chromium 144 large Canvas probe reported an H ascent of 734.375 at
1000 px. A 60.227223 nominal cap was consequently drawn at about 59.05 units.
`FACES` now pins `capEm` and `xHeightEm` for the loaded, non-mismatching selected
face; missing fonts and all other faces retain the existing measurement route.
This is an observed measurement discrepancy, not evidence for a different font.

The two profile baselines now have `radialOffset`, bounded to [-20, 20] design
units in saved slot overrides. Positive expands both baseline ellipse radii;
negative contracts them. It applies after ring-centred or explicit baseline
resolution, so it is independent of cap height. It is NOT a mathematically
constant normal-distance offset of an ellipse. Flat slots ignore it.

The standalone studio exposes **Baseline outward offset** under Shared slot
calibration. Compose and Recreations consume the same fitted defaults and retain
slot overrides in configurations; this change does not add a new Compose panel.
Other wording stays one native editable textPath per phrase. No stretching,
synthetic bold, traced letters, or phrase-specific optical adjustments are used.

Correcting the metric in isolation worsened this already compensating v1
profile. The cap heights, offsets, tracking, word spacing and arc biases were
therefore refitted together. Do not cherry-pick the metric change without the
new profiles. The fitted record is `data/kabel-layout-v2-fit.json`; the older
`data/kabel-lettering-fit.json` is retained as the v1 fit history.

At the fixed 676 x 945 reference-mask registration, binary IoU changed from
0.6619 to 0.7354 (upper) and 0.6849 to 0.7162 (lower). This is still not an exact
match. The new upper and lower ink ratios are about 0.993 and 0.950 respectively;
matching ink area alone is not a substitute for matching letter placement.
The prior 93.6% result fitted every glyph's pose independently and is not a
composition-level benchmark. Residual spacing is consistent with source-specific
optical placement, but the source does not establish the original production
method. Several contours differ too. One global width multiplier cannot fix
letters that disagree in different directions.

Run the fixed-reference regression, preferably against an unmodified checkout:

```sh
python3 bc-ministry-primitives-v5/tests/test_kabel_layout.py --baseline /path/to/unmodified/repository
python3 bc-ministry-primitives-v5/tests/test_kabel.py --baseline /path/to/unmodified/repository
```

The first test explicitly covers ref-5 because the old four-image fixture
manifest did not list the tree lettering. Both tests run offline with the
existing selected OTF. Font binaries and generated font-embedded studio HTML
are not part of this patch. A full production Vite/React build is a separate
check; these tests exercise the source engine, standalone studio and compiled
Compose controller.
