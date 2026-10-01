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
profile uses one cap height, tracking value, word gap and arc-centre bias per
line. It uses ordinary editable text/textPath elements: no letter tracing,
horizontal stretching, synthetic bold, or individual glyph placement. Residual
letter-position differences against the supplied outline artwork remain. This
is a font integration, not authentication of the historical font master.

## Supply your existing OTF

No font binary is included with this patch. From the repository root:

```sh
python3 bc-ministry-primitives-v5/tools/setup_kabel.py "/path/to/Kabel-Black.otf"
python3 bc-ministry-primitives-v5/tools/setup_kabel.py --check
```

The tool verifies the selected OTF's SHA-256 against
`data/kabel-black-font.json` and stages it at:

```text
bc-ministry-primitives-v5/fonts/Kabel-Black.otf
```

That file is an ignored, local build input. An OTF with a matching name but
different bytes is rejected by the setup tool and standalone builder. The
browser additionally checks the loaded face's probe advance against the
selected font's measured advance. A matching advance is a metric check, not a
proof of historical identity.

### Open the application

```sh
cd shared-primitives/site
npm ci
npm run dev
```

Open **Compose → Live lettering → Forest Service**. In **Tree oval lettering**,
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

The workflow accepts a repository secret named `KABEL_BLACK_OTF_BASE64`. When
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
