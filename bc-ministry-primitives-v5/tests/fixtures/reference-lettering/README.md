# Supplied reference lettering masks

These ten grayscale PNGs are source-derived fractional text-coverage masks,
not generated target glyphs. They come from the four user-provided rasters
listed in `manifest.json`, including the exact source SHA-256 values.

The common coordinate system is 676 × 945. Registration uses one fixed uniform
scale and translation for each source oval. Image coordinates are
`source = model * scale + [tx, ty]`; the extractor uses the inverse transform.
The registration was fixed before this lettering calibration and is the same
for v1 and v2. There is no letter-by-letter alignment, OCR or distortion.

`tools/extract_reference_masks.py` estimates ink from green chroma plus
brightness/contrast at the source resolution before linear resampling. It then
selects crest/service regions and excludes separator disks. The low-resolution
JPEG is not an accurate master of fine glyph contours. These images are
calibration fixtures, not authenticated official artwork or an independent
test set. Ownership/licensing of source imagery is not newly established here.

`ref-5-upper-mask.png` and `ref-5-lower-mask.png` come from the Forest Service
vector instead (`tools/extract_tree_masks.py`: its dark ink inside the white
ring, diamonds removed). It is not in `manifest.json`, whose extractor reads
green-ink rasters.

The extraction smoke test regenerated all ten raster mask PNGs byte-for-byte. Original
full images are not needed for routine regression tests; they are needed to
rerun extraction. The patch carries masks and provenance, not any font files.
