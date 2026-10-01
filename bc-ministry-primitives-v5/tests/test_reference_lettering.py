#!/usr/bin/env python3
"""Reference-style regression tests using actual browser-rendered live SVG text.

References are registered by their oval only. The fixture masks are extracted
from four user-supplied rasters; these are in-sample regression checks, not
independent validation of a historical font. No font files are bundled.
"""
from __future__ import annotations
import argparse, base64, hashlib, importlib.util, io, json, os, shutil
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
FIXTURES=ROOT/'tests/fixtures/reference-lettering'

def module_at(name,path):
 spec=importlib.util.spec_from_file_location(name,path)
 if not spec or not spec.loader:raise RuntimeError(f'Cannot import {path}')
 m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def overlap(target,ink):
 """Soft Dice, 1.25 design-unit blur, common 676-unit frame; NOT % accuracy."""
 t=target.astype(np.float32)/255;t[t<.1]=0
 a=ink.astype(np.float32)/255
 t=cv2.GaussianBlur(t,(0,0),1.25);a=cv2.GaussianBlur(a,(0,0),1.25)
 return 2*float(np.sum(a*t))/max(1e-9,float(np.sum(a*a)+np.sum(t*t)))

RASTER=r"""async({recipe,policy})=>{
 const r=await BCLogo.render({recipe,textFit:policy,autoProfile:false}),svg=r.svg;
 const letters=svg.querySelector('[data-layer="live-lettering"]').cloneNode(true);
 svg.querySelector('[data-layer="composition"]').replaceChildren(letters);
 svg.setAttribute('viewBox','0 0 676 945');r.viewBox={x:0,y:0,w:676,h:945};
 const png=await BCLogo.png(r,676);
 return new Promise(ok=>{const f=new FileReader;f.onload=()=>ok(f.result.split(',')[1]);f.readAsDataURL(png)});
}"""

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--isolated',action='store_true');ap.add_argument('--art',type=Path);ap.add_argument('--out',type=Path,default=ROOT/'tests/output/reference-lettering');a=ap.parse_args()
 out=a.out.resolve();out.mkdir(parents=True,exist_ok=True)
 fixture=module_at('text_fit_fixture',ROOT/'tests/test_text_fit.py')
 if a.isolated:html=fixture.isolated_html(ROOT,a.art)
 else:html=module_at('production_build',ROOT/'build.py').build(out/'studio.html').read_text()
 (out/'studio.html').write_text(html)
 results=[]
 def record(name,passed,detail=None):
  results.append({'name':name,'passed':bool(passed),'detail':detail});print(('PASS ' if passed else 'FAIL ')+name,flush=True)
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM') or shutil.which('chromium'),args=['--no-sandbox']);page=b.new_page(viewport={'width':1400,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(html);page.wait_for_function('window.BCStudio?.current')
  fonts=page.evaluate("async()=>{await BCLogo.ensureFonts(['open-heavy','noto-condensed']);return ['open-heavy','noto-condensed'].map(id=>({id,status:BCLogo.fontState.get(id)?.status,source:BCLogo.fontState.get(id)?.source,metrics:BCLogo.metrics('Hx',id)}))}")
  ready=all(f['status']=='ready' for f in fonts);record('Calibrated faces load at their named weight and width',ready,fonts)
  if not ready:raise RuntimeError('Install the exact named local faces before running the reference regression.')
  versioned=page.evaluate("()=>{let rejected=false;try{BCLogo.normalise({textFit:'reference-calibrated',referenceModelVersion:999})}catch{rejected=true}const s=BCLogo.normalise({textFit:'reference-calibrated'});return {rejected,version:s.referenceModelVersion,inherited:BCLogo.recipeState('long-wildfire',s).referenceModelVersion,legacy:'referenceModelVersion' in BCLogo.normalise({})}}")
  record('Reference model is versioned; unsupported versions are rejected',versioned['rejected'] and versioned['version']==1 and versioned['inherited']==1 and not versioned['legacy'],versioned)
  families=page.evaluate("()=>['forests','forests-wildfire','long-ministry','long-wildfire'].map(recipe=>{const r=BCLogo.makeLogo({recipe,textFit:'reference-calibrated'});return {recipe,profiles:r.report.map(f=>f.referenceProfile),preserved:r.report.every(f=>f.stylePreserved),warnings:r.warnings}})")
  record('All four default reference recipes retain their calibrated size and spacing',all(x['preserved'] and all(x['profiles']) for x in families),families)
  signed=page.evaluate("()=>{const s=BCLogo.normalise({recipe:'long-ministry',textFit:'reference-calibrated',slots:{'long-upper':{tracking:-.018,wordSpacingEm:-.08,anchorBias:3.5}}});const r=BCLogo.fitRun('British Columbia','long-upper',s);return {tracking:r.trackingEm,word:r.wordSpacingEm,bias:r.anchorBias,restored:JSON.stringify(s)===JSON.stringify(BCLogo.normalise(JSON.parse(JSON.stringify(s))))}}")
  record('Negative tracking, independent word spacing and anchor bias survive normalization',signed['tracking']==-.018 and signed['word']==-.08 and signed['bias']==3.5 and signed['restored'],signed)
  height=page.evaluate("()=>['noto-condensed','condensed-bold'].map(face=>{const s=BCLogo.normalise({recipe:'long-ministry',textFit:'reference-calibrated',roles:{'crest-condensed':{face}}});const f=BCLogo.fitRun('Parks','long-upper',s);return {face,x:f.xHeight,target:f.preferredXHeight,cap:f.cap,model:f.heightModel}})")
  record('Lowercase-height target survives a font-face change',all(abs(x['x']-x['target'])<1e-5 for x in height) and abs(height[0]['cap']-height[1]['cap'])>1,height)
  gap=page.evaluate("()=>{const s=BCLogo.normalise({recipe:'long-ministry',textFit:'reference-calibrated',slots:{'long-upper':{wordSpacingEm:-.2,tracking:-.06}}});const f=BCLogo.fitRun('A B','long-upper',s),m=BCLogo.metrics('A B',f.face);return {space:m.spaceAdvance+f.wordSpacingEm+f.trackingEm,requested:f.requestedWordSpacingEm,actual:f.wordSpacingEm}}")
  record('Extreme negative spacing cannot erase the native word interval',gap['space']>=.06-1e-7 and gap['actual']>gap['requested'],gap)
  stretched=page.evaluate("()=>['legacy','style-preserving','reference-calibrated'].map(textFit=>{const r=BCLogo.makeLogo({recipe:'forests',textFit,roles:{'crest-heavy':{face:'noto-condensed'}}});return {textFit,stretch:[...r.svg.querySelectorAll('text[data-slot]')].map(e=>e.getAttribute('font-stretch'))}})")
  record('Condensed face width reaches final SVG in every fitting policy',all(all(x=='condensed' for x in r['stretch']) for r in stretched),stretched)
  spacing=page.evaluate("()=>{const run=(gap,bias)=>{const s=BCLogo.normalise({recipe:'long-ministry',textFit:'reference-calibrated',slots:{'long-upper':{wordSpacingEm:gap,anchorBias:bias}}});return BCLogo.fitRun('A B','long-upper',s)};const a=run(0,0),b=run(.1,0),c=run(.1,5);return {w0:a.width,w1:b.width,w2:c.width,cap0:a.cap,cap1:b.cap,anchor:c.anchorBias}}")
  record('Word spacing changes advance; anchor bias changes placement, not glyph width',spacing['w1']>spacing['w0'] and spacing['w1']==spacing['w2'] and spacing['cap0']==spacing['cap1'],spacing)
  matrix=page.evaluate("""()=>{
   const rows=[];
   for(const recipe of ['forests','forests-wildfire','long-ministry','long-wildfire'])for(const text of [null,'PARKS','NATURAL RESOURCES','Watersheds, Lands and Ecological Stewardship','Environmental Monitoring and Conservation','Écologie, pêches & office – Ågyp','W'.repeat(320)])for(const outputWidth of [100,500,1200,6000]){
    const s=BCLogo.normalise({recipe,textFit:'reference-calibrated',outputWidth});if(text!==null){s.content.lower=text;s.content.service=text}
    const r=BCLogo.makeLogo(s);document.body.append(r.svg);
    const runs=[...r.svg.querySelectorAll('text[data-slot]')].map(el=>{const f=r.report.find(x=>x.slot===el.dataset.slot);return {slot:f.slot,cap:f.cap,preferred:f.preferredCap,width:f.width,actual:el.getComputedTextLength(),available:f.available,word:f.wordSpacingEm,adjustments:f.adjustments,text:el.textContent,editable:el.children.length===1&&el.firstElementChild.tagName==='textPath'}});
    rows.push({recipe,text,outputWidth,runs,finite:!/(NaN|Infinity)/.test(BCLogo.serialise(r)),stretched:!!r.svg.querySelector('[textLength],[lengthAdjust],[data-character-index]'),warnings:r.warnings.map(x=>x.code)});r.svg.remove();
   }return rows;
  }""")
  (out/'matrix.json').write_text(json.dumps(matrix,indent=2))
  runs=[f for row in matrix for f in row['runs']]
  record('Native text advances agree at four output sizes',all(abs(f['actual']-f['width'])<.1 for f in runs),{'compositions':len(matrix),'runs':len(runs),'max_error':max(abs(f['actual']-f['width']) for f in runs)})
  record('Alternate wording stays finite, fitted and editable without glyph stretching',all(row['finite'] and not row['stretched'] for row in matrix) and all(f['editable'] and f['width']<=f['available']+.1 for f in runs))
  long=[row for row in matrix if row['text']=='W'*320]
  record('Capacity limits remain explicit for extreme wording',all('TEXT_STYLE_REDUCED' in row['warnings'] and 'SMALL_TEXT' in row['warnings'] for row in long))
  # Retain the same source masks and one fixed similarity transform for both modes.
  manifest=json.loads((FIXTURES/'manifest.json').read_text());scores=[]
  for ref in manifest['references']:
   paths=list(FIXTURES.glob(f'ref-{ref["id"]}-*-mask.png'))
   target=np.maximum.reduce([np.array(Image.open(p).convert('L')) for p in paths])
   row={'reference':ref['id'],'recipe':ref['recipe']}
   for policy,key in [('style-preserving','before'),('reference-calibrated','after')]:
    png=base64.b64decode(page.evaluate(RASTER,{'recipe':ref['recipe'],'policy':policy}));(out/f'reference-{ref["id"]}-{key}.png').write_bytes(png)
    ink=np.array(Image.open(io.BytesIO(png)).convert('RGBA'))[:,:,3];row[key]=overlap(target,ink)
   scores.append(row)
  (out/'reference-scores.json').write_text(json.dumps(scores,indent=2))
  record('Registered reference overlap improves for each of the four supplied images',all(r['after']>r['before']+.015 for r in scores),scores)
  # The same independently rasterized white-band check as v1, now including the new policy.
  containment=page.evaluate(fixture.MASK_CASES.replace("['legacy','reference-locked','style-preserving']","['reference-calibrated']"))
  (out/'band-containment.json').write_text(json.dumps(containment,indent=2))
  record('Selected reference and alternate wording stay inside the crest band',all(r['total']>0 and r['outside']==0 for r in containment),containment)
  page.select_option('#recipe','long-ministry');page.select_option('#textFit','reference-calibrated');page.wait_for_function("BCStudio.current.state.textFit==='reference-calibrated'&&BCStudio.current.state.recipe==='long-ministry'")
  page.select_option('#typeSlot','long-upper');page.locator('#slotWordSpacing').fill('0.055');page.wait_for_function("BCStudio.current.state.slots['long-upper']?.wordSpacingEm===.055")
  record('Studio word-spacing control updates before blur',page.evaluate("BCStudio.current.report.find(x=>x.slot==='long-upper').wordSpacingEm===.055"))
  page.locator('#slotAnchorBias').fill('4.2');page.wait_for_function("BCStudio.current.state.slots['long-upper']?.anchorBias===4.2")
  exported=page.evaluate("()=>{const s=JSON.parse(BCStudio.configText()),r=BCLogo.makeLogo(s);return {s,meta:JSON.parse(r.svg.querySelector('metadata').textContent).configuration,run:r.report.find(x=>x.slot==='long-upper')}}")
  record('Config and SVG metadata retain the reference calibration controls',exported['s']==exported['meta'] and exported['run']['anchorBias']==4.2 and exported['run']['wordSpacingEm']==.055)
  page.click('#resetSlot');page.wait_for_function("!BCStudio.current.state.slots['long-upper']")
  record('Reset slot restores x-height matching and calibrated defaults',page.evaluate("BCStudio.current.report.find(x=>x.slot==='long-upper').heightModel==='xHeight'"))
  record('No uncaught browser errors',not errors,errors)
  version=b.version;b.close()
 result={'scope':'isolated source modules' if a.isolated else 'production studio','browser':version,'network_fonts_requested':False,'score_description':'In-sample soft Dice at fixed oval registration, not historical font identification or independent accuracy','passed':sum(x['passed'] for x in results),'total':len(results),'results':results}
 (out/'report.json').write_text(json.dumps(result,indent=2));print(f"{result['passed']}/{result['total']} checks passed")
 return 0 if result['passed']==result['total'] else 1
if __name__=='__main__':raise SystemExit(main())
