#!/usr/bin/env python3
"""Render PNG proofs and build a self-contained offline catalogue. No embedded fonts."""
from pathlib import Path
import json,base64
import cairosvg
ROOT=Path(__file__).resolve().parents[1]
def uri(p,mime=None):
 if mime is None:mime='image/jpeg' if p.suffix.lower() in ['.jpg','.jpeg'] else 'image/png'
 return f'data:{mime};base64,'+base64.b64encode(p.read_bytes()).decode()
def build():
 ps=json.loads((ROOT/'data/presets.json').read_text());src=json.loads((ROOT/'data/source-inventory.json').read_text())
 for p in ps:
  cairosvg.svg2png(url=str(ROOT/'svg/outlined'/f'{p["id"]}.svg'),write_to=str(ROOT/'previews'/f'{p["id"]}.png'),output_width=1000)
  p['photo']=uri(ROOT/p['sourceCrop']);p['preview']=uri(ROOT/'previews'/f'{p["id"]}.png')
  p['outlinedSVG']=(ROOT/'svg/outlined'/f'{p["id"]}.svg').read_text()
  p['editableSVG']=(ROOT/'svg/editable'/f'{p["id"]}.svg').read_text()
 for s in src:s['thumbData']=uri(ROOT/s['thumbnail'])
 template=(ROOT/'tools/catalogue-template.html').read_text()
 payload=json.dumps({'presets':ps,'sources':src},ensure_ascii=False).replace('</','<\\/')
 (ROOT/'index.html').write_text(template.replace('/*DATA_PLACEHOLDER*/',payload))
 print('Created offline index.html and 10 PNG proofs.')
if __name__=='__main__':build()
