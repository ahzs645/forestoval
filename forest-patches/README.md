# British Columbia forestry patch survey and vector reconstruction kit

**Reference-based drafts · 29 September 2026**

Open `index.html` in a browser. It is self-contained and works offline. The first tab compares ten vector drafts with their source crops; the second searches the complete source inventory. The Edit lettering button opens live SVG text controls. Its exports need locally installed typefaces; the supplied outlined masters have no font dependency.

## Scope and result

The supplied **Forest service** Drive folder contained **59 direct files: 57 images and two PDFs, with 109 PDF pages**. All were visually screened. The 107-page FOI PDF was screened page-by-page through contact sheets, with its clean crest on physical page 75 examined at full source resolution. The two-page research-history article was also read visually. This was not an OCR-only or filename-only search.

Ten reconstruction entries are included, **not ten verified Ministry-issued cloth patches**:

| ID | What it is | Classification | Main limitation |
|---|---|---|---|
| F01 | Light-band Forest Service tree oval | Forestry cloth | Historical embroidered scene differs from shared tree master |
| F02 | Green/gold Forest Service tree oval | Forestry cloth | Blurred screenshot; estimated colours and scene |
| F03 | Green Forest Service decal | Non-patch emblem | Historic decal linework differs; not cloth evidence |
| F04 | FOREST / SERVICE shoulder rocker, small central oval | Forestry cloth | Newly drawn side geometry; not an Airtanker badge |
| F05 | Forest Service provincial-crest shield + FIRE CONTROL | Forestry cloth | Crest adapter supplied; exact local PofBC import still to run |
| F06 | B.C. / FOREST SERVICE map-and-animal rectangle | Forestry cloth | Map and ungulate are schematic because source is blurred |
| F07 | Unlabelled map-and-tree square | Affiliation unconfirmed | No identifying wording; not evidence of ministry ownership |
| F08 | Long ministry wildlife oval + WILDFIRE SERVICE | Forestry cloth | Shared scene retained, embroidered proportions approximate |
| F09 | Forest Service oval + PARKS plate | Related Parks cloth | Separate category; thin lettering and historic scenery approximate |
| F10 | British Columbia / Ministry of Forests wildlife crest | Non-patch document emblem | Physical FOI page 75; not evidence of a cloth issue |

**Six clearly labelled Forestry cloth design entries**, one related Parks cloth design, one unconfirmed cloth design, and two non-patch emblems. The source register includes other Parks designs, metal badges, posters, decals, vehicles and archival material; these were reviewed but not relabelled as Ministry cloth patches.

The uncertain gold/navy oval and partial neighbouring objects in **S50** remain unresolved. Small collector-board fragments are recorded as uncertain rather than treated as new designs. The inventory is complete at the **file** level, not a guarantee that every tiny object in every photograph can be uniquely identified. Individual manufacture dates and thread specifications remain unknown.

## Deliverables

- `index.html`: offline source/recreation catalogue, complete source register and live lettering editor.
- `svg/outlined/`: ten self-contained, scalable SVGs with lettering as paths, no raster images or external fonts.
- `svg/editable/`: ten SVGs with live text and named component groups.
- `previews/`: transparent PNGs and comparison sheets.
- `data/presets.json`: wording, geometry, palettes, provenance and per-design limitations.
- `data/source-inventory.csv` and `.json`: all 59 files with source IDs, Drive links, SHA-256, category, observations and design associations.
- `reports/`: source verification, fitting diagnostics and machine-readable validation.
- `tools/`: vector builder, catalogue builder, local source importer and tests.
- `integration/README.md`: concrete division of responsibilities for forestoval and PofBC.

## Source reuse and fidelity

The 11 original forestoval ART values match its current manifest at commit `244276dcf0b55e14b694b5cee569c78a978cc734`. The common frame and scene geometry are reused, not re-created by an image generator. Colours and lettering are composed per preset. The shoulder, shield and map designs are fresh editable geometry, **not authenticated original vector masters**.

The shield's provincial crest comes from supplementary original editable artwork in the user's Drive. It is normalized to the PofBC `PROVINCIAL_MARK` coordinate interface. It is not claimed to be byte-identical to that repository's current component. The supplied local-checkout importer replaces it with the exact PofBC export; no live checkout import or app deployment is claimed here.

Live lettering uses **Roboto Condensed Bold**, **Open Sans ExtraBold**, **Roboto Bold**, and **Roboto Regular**. These are reconstruction choices, not verified identifications of the historic embroidery typefaces. No font files are distributed. Supply locally installed/licensed fonts to regenerate outlines. A different font may change the fit.

The duplicate detector found one exact duplicate image pair, **S15/S16**. S30/S57 appear to be recompressed copies of the same four-patch photograph; S52/S53 are different views of a framed decal collection. These distinctions are preserved rather than counting files as unique patch designs.

## Rebuild

```sh
python -m pip install -r requirements.txt
python tools/build_vectors.py --condensed /path/to/RobotoCondensed-Bold.ttf \
  --heavy /path/to/OpenSans-ExtraBold.ttf --regular /path/to/Roboto-Bold.ttf \
  --thin /path/to/Roboto-Regular.ttf
python tools/build_catalogue.py
python tools/test_vectors.py
```

For precise upstream replacement, see `integration/README.md`. The default Linux font paths are conveniences, not required fonts bundled with the kit. The builder reduces tracking and then uniformly reduces text size when a run exceeds its usable path; it does not distort glyph width independently of height. Browser editing applies uniform font-size fitting and displays the resulting size.

## Evidence and use

The source folder is `https://drive.google.com/drive/folders/1Wl1B2GEi-8GW2pdPZx8xEd61MZCvSvdQ`.
Every inventory item retains its original filename, Drive ID and source hash. PDF page references are **physical, 1-based pages**. Source crops have only been cropped/resized, not AI-restored. The original high-resolution photographs and full PDFs are not duplicated in the kit; the folder remains the source of record.

An identification-card photograph, S32, is inventoried but its preview is intentionally omitted. The kit contains no redrawn credentials or copied personal identification details.

Source photographs, original emblems and trademarks remain subject to their owners' rights. Access to a public document or possession of an SVG does not establish permission for official use or merchandise. These files are **research/design reconstructions**, not official government identity masters, authenticated uniform insignia or embroidery stitch files. No issue dates are inferred from upload timestamps or the FOI filename.

No Drive files or GitHub repositories were modified.
