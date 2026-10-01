from pathlib import Path
import json, cv2, numpy as np
from PIL import Image
import argparse
ROOT=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser(description='Extract reference text mattes using fixed oval registration; no OCR or glyph warping.')
ap.add_argument('--source-dir',type=Path,required=True);ap.add_argument('--out',type=Path,default=ROOT/'tests/fixtures/reference-lettering');ap.add_argument('--manifest',type=Path,default=ROOT/'tests/fixtures/reference-lettering/manifest.json');args=ap.parse_args()
out=args.out;out.mkdir(parents=True,exist_ok=True)
manifest=json.loads(args.manifest.read_text())
W,H=676,945
Y,X=np.mgrid[:H,:W]
cx,cy=338.34,420.96
outer=((X-cx)/311)**2+((Y-cy)/399)**2<1
inner=((X-cx)/222.5)**2+((Y-cy)/313.1)**2<1
ring=outer&~inner
# Keep separators out of lettering measurements. Crops retain all visible glyphs.
for ref in manifest['references']:
 p=args.source_dir/ref['file'];rgba=np.array(Image.open(p).convert('RGBA'))
 rgb=rgba[:,:,:3].astype(float);r,g,b=rgb.transpose(2,0,1)
 # A soft foreground estimate based on green chroma (white/black excluded).
 # Estimate fractional ink coverage at native resolution BEFORE registration.
 green=(g-r>7)&(g-b>4)&(rgba[:,:,3]>127)
 # Chroma alone selects JPEG ringing in white counters; retain fractional ink
 # coverage instead. Composite transparency on white before deriving a matte.
 core=rgb[green & (np.max(rgb,axis=2)<190)]
 fg=np.median(core,axis=0)
 rgbw=rgb*(rgba[:,:,3:4]/255)+255*(1-rgba[:,:,3:4]/255)
 contrast=255-fg
 coverage=np.clip(np.sum((255-rgbw)*contrast,axis=2)/np.sum(contrast**2),0,1)
 selected=coverage*((g-r>4)&(g-b>2))
 # normalized-aligned original and text pixels use the same one-similarity transform.
 s,tx,ty=ref['scale'],ref['tx'],ref['ty'];M=np.array([[1/s,0,-tx/s],[0,1/s,-ty/s]])
 aligned=cv2.warpAffine((selected*255).astype('uint8'),M,(W,H),flags=cv2.INTER_LINEAR)
 islong=ref['recipe'].startswith('long')
 masks={'upper':ring&(Y<(225 if islong else 420)),
        'lower':ring&(Y>(236 if islong else 660))}
 if ref['id'] in (2,3): masks['service']=(Y>715)&~(((X-cx)/327)**2+((Y-cy)/415)**2<1)
 rgbwhite=rgb*(rgba[:,:,3:4]/255)+255*(1-rgba[:,:,3:4]/255)
 norm=cv2.warpAffine(rgbwhite.astype('uint8'),M,(W,H),borderValue=(255,255,255))
 Image.fromarray(norm).save(out/f'ref-{ref["id"]}-aligned.png')
 for slot,region in masks.items():
  m=aligned.copy();m[~region]=0
  if islong:
   for dx in [-221,221]:
    m[((X-(cx+dx))**2+(Y-215)**2)<18**2]=0
  Image.fromarray(m).save(out/f'ref-{ref["id"]}-{slot}-mask.png')
  print(ref['id'],slot,np.count_nonzero(m>127))
manifest['maskSize']=[W,H]
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
# Contact sheet shows isolated source lettering, never generated samples.
canvas=Image.new('RGB',(4*W,H),'white')
for j,ref in enumerate(manifest['references']):
 masks=list(out.glob(f'ref-{ref["id"]}-*-mask.png'))
 m=np.maximum.reduce([np.array(Image.open(x)) for x in masks]);im=Image.fromarray(255-m).convert('RGB');canvas.paste(im,(W*j,0))
canvas.resize((1352,473)).save(out/'mask-contact.png')
