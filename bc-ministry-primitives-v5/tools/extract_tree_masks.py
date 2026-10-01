"""Lettering masks for the tree crest from the supplied Forest Service vector.

The vector (data/references/tree-source.svg) is drawn into the shared 676 x 945
design grid with its recorded registration (data/references.json, tree-source),
rasterized by Chromium, and its dark ink inside the white ring is kept as
fractional coverage. The diamonds are cut out; the rest splits into the upper
and lower lines. No OCR, glyph fitting or warping.

  python tools/extract_tree_masks.py      # writes ref-5-{upper,lower}-mask.png

Needs Playwright with Chromium (CHROMIUM=/path/to/chromium to use your own).
"""
from pathlib import Path
import base64, io, json, os, shutil
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

V5 = Path(__file__).resolve().parents[1]
OUT = V5 / 'tests/fixtures/reference-lettering'
W, H = 676, 945
CX, CY = 338.36631, 420.96480


def main():
    reg = json.loads((V5 / 'data/references.json').read_text())['tree-source']['registration']
    svg = (V5 / 'data/references/tree-source.svg').read_bytes()
    href = 'data:image/svg+xml;base64,' + base64.b64encode(svg).decode()
    page_svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
                f'<rect width="{W}" height="{H}" fill="#fff"/>'
                f'<image href="{href}" x="{reg["x"]}" y="{reg["y"]}" width="{reg["w"]}" height="{reg["h"]}" preserveAspectRatio="none"/></svg>')
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM') or shutil.which('chromium'), args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': W, 'height': H})
        page.set_content(f'<html><body style="margin:0">{page_svg}</body></html>')
        shot = page.screenshot(clip={'x': 0, 'y': 0, 'width': W, 'height': H})
        browser.close()
    rgb = np.asarray(Image.open(io.BytesIO(shot)).convert('RGB')).astype(float)
    # The lettering is the near-black ink (#231f20) on white: coverage from luminance.
    coverage = np.clip((255 - rgb.mean(axis=2)) / (255 - 35), 0, 1)
    Y, X = np.mgrid[:H, :W]
    # Inside the white ring, clear of the black frame bands (the tree scene's
    # inner border runs a little outside the shared ellipse, hence 226.5 x 317).
    outer = ((X - CX) / 309.2) ** 2 + ((Y - CY) / 396.5) ** 2 < 1
    inner = ((X - CX) / 226.5) ** 2 + ((Y - CY) / 317.0) ** 2 < 1
    ring = outer & ~inner
    diamonds = np.zeros_like(ring)
    for dx in (-263.6, 264.7):
        diamonds |= (np.abs(X - (CX + dx)) + np.abs(Y - 397.5)) < 26
    masks = {'upper': ring & ~diamonds & (Y < 400), 'lower': ring & ~diamonds & (Y > 440)}
    for part, region in masks.items():
        m = np.where(region, coverage, 0)
        Image.fromarray((m * 255).round().astype('uint8')).save(OUT / f'ref-5-{part}-mask.png')
        print(part, int((m > .5).sum()), 'ink pixels')


if __name__ == '__main__':
    main()
