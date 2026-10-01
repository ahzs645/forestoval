# Reopening editable SVGs with local font aliases

The live engine registers exact local PostScript/full-name faces under its own
CSS family names. A fresh SVG document does not inherit that registration.
In the uploaded branch reviewed at archive commit `0bdfc69e38f2a1667e1030dec216415cab3c7179`,
Chromium reopened the long-ministry SVG with NotoSans-CondensedBold instead of
NotoSans-CondensedExtraBold, even though the intended font was installed.

`BCLogo.serialise(result)` now clones the SVG and adds local-only `@font-face`
declarations for its required faces. It retains the engine's family/weight/width
mapping in a fresh document. The live result and `serialise(svgElement)` path are
unchanged; the latter is used by the PNG exporter, which already prepares fonts.
No font files, font bytes or network font URLs are included.

This is not a portable-font or font-bundling solution. The receiving computer
still needs the named font installed, and vector editors may interpret SVG CSS
differently. A machine without the face still falls back. The web app still
needs deterministic first-party loading of its calibrated Noto condensed face.
Do not change the calibrated font family name to try to repair this: the
required width/weight selection must also be preserved.

Run `python3 bc-ministry-primitives-v5/tests/test_export_font_aliases.py` with
the locally installed calibration faces. It builds the real standalone page,
exports all four reference presets and reopens them in fresh browser contexts.
It checks matching advances, preserved text, lack of embedded font data and
non-mutation of the preview. It does not claim cross-browser/editor fidelity.
