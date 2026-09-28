# Forest Service / British Columbia / Airtanker Operations

An authored vector reconstruction of the image supplied in the conversation.
This is not an authenticated historical master or an exact facsimile.

## Files

- `airtanker-operations.svg` — ready-to-use SVG. The lettering is converted to paths; no installed font is needed. Other reusable shapes remain instanced.
- `airtanker-operations-editable.svg` — layered master with all three phrases retained as live text on paths.
- `generate.py` — standard-library Python generator for the editable master. It does not load or trace a raster image.
- `preview.png` — transparent PNG rendered from the ready-to-use SVG.
- `comparison.png` — supplied reference and rebuilt SVG, shown side by side on white.

## Construction

The oval is not a circle: its upper and lower elliptical halves have independent vertical radii. The frame, rings, and scene window are generated from an oval primitive.

Both wings reference one wing definition; the right wing is a mirrored instance. The wing definition contains the feather outline and separators. The lower service band is constructed separately from geometric elliptical shapes.

The large conifer is a hand-authored path, including a small negative-space branch notch. The distant conifers reuse one small-tree definition at different sizes. Mountain ridges, foreground ground, oval frame, diamonds, and the three lettering groups are separate objects. Both diamonds reference one definition.

The two SVGs contain no raster image elements and no embedded font files. The background is transparent.

## Lettering

The editable SVG uses **Roboto Condensed Bold**, with a small same-colour stroke to approximate the weight in the reference. It is a substitute, not an identification of the original lettering. Font files are not included. Without the font installed, the editable version may render differently; use the path-lettering SVG for consistent display.

The three phrases have independent curve, type-size, tracking, and word-space settings. These settings are tuned to the supplied labels. Arbitrarily longer replacement labels are not guaranteed to auto-fit: adjust their profile in `build_svg()` as needed.

## Regenerate

Python 3.9 or later:

```sh
python generate.py
```

Change the palette without re-drawing the artwork:

```sh
python generate.py --navy '#002950' --gold '#FFCA05' --cream '#FFECC0' --red '#EB001B'
```

Change a label:

```sh
python generate.py --service-text 'AIRTANKER OPERATIONS' --output custom.svg
```

The geometric parameters are in `oval()`, `half_ellipse()`, and the `build_svg()` calls. The central tree, small conifer, and wing contour have named definitions near the beginning of the script.

To create the path-lettering export with Inkscape and the font installed:

```sh
inkscape airtanker-operations-editable.svg --export-text-to-path --export-plain-svg --export-filename=airtanker-operations.svg
```

## Scope of the reconstruction

Flat colours intentionally replace the raster shading and surface texture. The typeface, individual tree branches, small forest, and feather curvature are approximations. The structure was rebuilt from geometric and authored vector components rather than converted into pixel-following contours.

Both final SVGs were rendered and visually inspected. Their rendered lettering and artwork were checked against each other, and the reconstruction was compared with the supplied reference. This does not establish that they match an original official design file.
