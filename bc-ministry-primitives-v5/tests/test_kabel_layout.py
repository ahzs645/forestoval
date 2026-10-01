#!/usr/bin/env python3
"""Offline regression for the selected Kabel OTF, live layout, and fixed masks.

python3 tests/test_kabel_layout.py --baseline /path/to/unpatched/repository
Requires the existing Playwright, NumPy and Pillow test dependencies.
Neither this test nor its reports redistribute font data.
"""
from pathlib import Path
import argparse,base64,io,json,os,shutil
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
V5=Path(__file__).resolve().parents[1]
STATE={'recipe':'forest-service','treeLettering':'kabel-black','textFit':'reference-calibrated','centreInRing':True,'autoProfile':True,'separatorPlacement':'follow-text','fanOut':True}
RASTER='''async q=>{const r=BCLogo.makeLogo({...window.auditState,...q.state});r.svg.setAttribute('viewBox','0 0 676 945');r.viewBox={x:0,y:0,w:676,h:945};for(const el of r.svg.querySelectorAll('use,[data-layer="separators"],[data-layer="tab-shape"]'))el.remove();for(const el of r.svg.querySelectorAll('text[data-slot]'))if(!el.dataset.slot.endsWith(q.part))el.remove();const blob=await BCLogo.png(r,676);return new Promise(ok=>{const f=new FileReader;f.onload=()=>ok(f.result.split(',')[1]);f.readAsDataURL(blob)})}'''
SNAPSHOT="""()=>BCPrimitives.RECIPES.filter(r=>!r.excluded).flatMap(rec=>['legacy','reference-locked','reference-calibrated','style-preserving'].map(textFit=>{const r=BCLogo.makeLogo(BCLogo.recipeState(rec.id,{textFit}),{prefix:'audit'});r.svg.querySelector('metadata').remove();return {svg:BCLogo.serialise(r),report:r.report,warnings:r.warnings}}))"""
def load(page,root,font):
    source=''.join('<script>'+s+'</script>' for s in [(root/'src/primitives.js').read_text(),'window.BC_ART='+(root/'data/art.json').read_text()+';window.auditState='+json.dumps(STATE)+';window.BCTabProfile='+json.dumps(json.loads((root.parent/'shared-primitives/layout.json').read_text())['tab'])+';',(root.parent/'shared-primitives/tab-layout.js').read_text(),(root/'src/engine.js').read_text()])
    page.set_content('<html><body>'+source+'</body></html>')
    return page.evaluate("async b64=>{await BCLogo.supplyFont('kabel-black',Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer);const s=BCLogo.fontState.get('kabel-black');return {status:s.status,verified:s.verified,cap:BCLogo.metrics('H','kabel-black').cap,xHeight:BCLogo.metrics('x','kabel-black').xHeight}}",base64.b64encode(font.read_bytes()).decode())
def mask(page,part):
    raw=base64.b64decode(page.evaluate(RASTER,{'part':part}))
    return np.asarray(Image.open(io.BytesIO(raw)).convert('RGBA'))[:,:,3]/255.
def score(a,t):
    aa=a>.5;tt=t>.5
    return {'binary_iou':float((aa&tt).sum()/(aa|tt).sum()),'coverage_iou':float(np.minimum(a,t).sum()/np.maximum(a,t).sum()),'ink_ratio':float(a.sum()/t.sum())}
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--baseline',type=Path);ap.add_argument('--font',type=Path,default=V5/'fonts/Kabel-Black.otf');ap.add_argument('--out',type=Path,default=V5/'tests/output/kabel-layout');args=ap.parse_args();args.out.mkdir(parents=True,exist_ok=True)
    checks=[]
    def check(name,ok,details=None):checks.append({'name':name,'passed':bool(ok),'details':details});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
    with sync_playwright() as pw:
        b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM') or shutil.which('chromium'),args=['--no-sandbox']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        ready=load(page,V5,args.font);check('Selected font verifies and uses exact H/x outline metrics',ready['verified'] and ready['cap']==.72 and ready['xHeight']==.518,ready)
        normal=page.evaluate("()=>{const s=BCLogo.normalise({...auditState,slots:{'tree-upper':{radialOffset:5},'tree-lower':{radialOffset:-2}}});const large=BCLogo.normalise({...auditState,slots:{'tree-upper':{radialOffset:100}}});const bad=BCLogo.normalise({...auditState,slots:{'tree-upper':{radialOffset:NaN}}});return {roundtrip:JSON.stringify(s)===JSON.stringify(BCLogo.normalise(JSON.parse(JSON.stringify(s)))),upper:s.slots['tree-upper'].radialOffset,lower:s.slots['tree-lower'].radialOffset,clamped:large.slots['tree-upper'].radialOffset,invalid:Object.hasOwn(bad.slots['tree-upper'],'radialOffset')}}")
        check('Offsets round-trip; excessive values clamp and NaN is ignored',normal['roundtrip'] and normal['upper']==5 and normal['lower']==-2 and normal['clamped']==20 and not normal['invalid'],normal)
        geometry=page.evaluate("""()=>{const fit=(id,off)=>BCLogo.fitRun(id==='tree-upper'?'FOREST SERVICE':'BRITISH COLUMBIA',id,BCLogo.normalise({...auditState,slots:{'tree-upper':{radialOffset:off}}}));const a=fit('tree-upper',0),c=fit('tree-upper',5),x=fit('tree-lower',0),y=fit('tree-lower',5);return {dx:c.curve.rx-a.curve.rx,dy:c.curve.ry-a.curve.ry,cap:a.cap===c.cap,tracking:a.trackingEm===c.trackingEm,width:a.width===c.width,lower:JSON.stringify(x)===JSON.stringify(y)}}""")
        check('Independent offset changes radii, not size/advance or the other line',geometry['dx']==5 and geometry['dy']==5 and all(geometry[k] for k in ['cap','tracking','width','lower']),geometry)
        override=page.evaluate("()=>{const s=BCLogo.normalise({...auditState,slots:{'tree-upper':{rx:240,ry:330,radialOffset:4}}});const f=BCLogo.fitRun('FOREST SERVICE','tree-upper',s);return [f.curve.rx,f.curve.ry]}")
        check('Explicit radii and offset have predictable additive semantics',override==[244,334],override)
        shape=page.evaluate("""()=>['FOREST SERVICE','CONSERVATION','ÉCOLOGIE & PARKS','W'.repeat(320)].map(upper=>{const r=BCLogo.makeLogo({...auditState,content:{upper,lower:'BRITISH COLUMBIA'}});return {finite:!/(NaN|Infinity)/.test(BCLogo.serialise(r)),live:r.svg.querySelectorAll('textPath').length===2,stretch:!!r.svg.querySelector('[textLength],[lengthAdjust],[data-character-index]'),fit:r.report.every(f=>f.width<=f.available+.1)}})""")
        check('Default and custom wording stay live, finite, and unstretched',all(x['finite'] and x['live'] and not x['stretch'] and x['fit'] for x in shape),shape)
        meta=page.evaluate("()=>{const r=BCLogo.makeLogo({...auditState,slots:{'tree-upper':{radialOffset:5}}});const xml=BCLogo.serialise(r);const m=JSON.parse(r.svg.querySelector('metadata').textContent);return {config:m.configuration.slots['tree-upper'].radialOffset,resolved:m.resolved.find(x=>x.slot==='tree-upper').radialOffset,noFont:!xml.includes('data:font')}}")
        check('SVG metadata retains offset and editable SVG contains no font bytes',meta['config']==meta['resolved']==5 and meta['noFont'],meta)
        rows={};before=None
        if args.baseline:
            before=b.new_page();load(before,args.baseline/'bc-ministry-primitives-v5',args.font)
            a=before.evaluate(SNAPSHOT);c=page.evaluate(SNAPSHOT);check('All non-Kabel legacy recipe/policy renderings remain identical',a==c,{'combinations':len(a)})
        for part in ['upper','lower']:
            t=np.asarray(Image.open(V5/f'tests/fixtures/reference-lettering/ref-5-{part}-mask.png').convert('L'),dtype=float)/255
            a=mask(page,part);Image.fromarray(np.round(a*255).astype('uint8')).save(args.out/f'{part}-after-mask.png');rows[part]={'after':score(a,t)}
            check(part+' fixed-reference overlap stays above regression floor',rows[part]['after']['coverage_iou']>({'upper':.72,'lower':.70}[part]),rows[part]['after'])
            if before:
                old=mask(before,part);Image.fromarray(np.round(old*255).astype('uint8')).save(args.out/f'{part}-before-mask.png');rows[part]['before']=score(old,t)
                check(part+' registered, unblurred overlap improves',rows[part]['after']['coverage_iou']>rows[part]['before']['coverage_iou']+.015,rows[part])
        check('No uncaught browser errors',not errors,errors)
        result={'browser':b.version,'state':STATE,'score':'Fixed 676x945 canvas. Binary IoU uses alpha>0.5; coverage IoU sums min(alpha,reference)/max(alpha,reference). No image re-registration or blur. Ink ratio is not an overlap score.','passed':sum(x['passed'] for x in checks),'total':len(checks),'checks':checks,'scores':rows}
        (args.out/'summary.json').write_text(json.dumps(result,indent=2));b.close()
    return 0 if all(x['passed'] for x in checks) else 1
if __name__=='__main__':raise SystemExit(main())
