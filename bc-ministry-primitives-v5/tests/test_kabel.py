#!/usr/bin/env python3
"""Exercise the actual standalone build and compiled Compose DOM controller.

No network fonts are requested. A supplied OTF is required. The optional baseline
checkout compares the pre-existing policies, not the new Kabel layout. This is
not a full Vite/React deployment test; run npm run build separately.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = """() => BCPrimitives.RECIPES.filter(r=>!r.excluded).flatMap(rec=>
 ['legacy','reference-locked','reference-calibrated','style-preserving'].map(textFit=>{
 const s=BCLogo.recipeState(rec.id,{textFit}),r=BCLogo.makeLogo(s,{prefix:'compat'});
 r.svg.querySelector('metadata').remove();return {recipe:rec.id,textFit,svg:BCLogo.serialise(r),report:r.report,warnings:r.warnings};
 }))"""

def builder(root):
    spec=importlib.util.spec_from_file_location('kabel_build_'+str(id(root)),root/'build.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--font',type=Path,default=ROOT/'fonts/Kabel-Black.otf')
    ap.add_argument('--baseline',type=Path,help='Optional unmodified repository checkout')
    ap.add_argument('--out',type=Path,default=ROOT/'tests/output/kabel')
    args=ap.parse_args();out=args.out.resolve();out.mkdir(parents=True,exist_ok=True)
    font=args.font.read_bytes();manifest=json.loads((ROOT/'data/kabel-black-font.json').read_text())
    if hashlib.sha256(font).hexdigest()!=manifest['sha256']:raise RuntimeError('Use the selected OTF, not a same-name substitute.')
    build=builder(ROOT);html=build.build(out/'studio.html').read_text();results=[]
    def check(name,ok,detail=None):
        results.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM') or shutil.which('chromium'),args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1500,'height':1200});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html);page.wait_for_function('window.BCStudio?.current')
        check('Fresh standalone draft selects Kabel without changing the starting recipe',page.evaluate("BCStudio.state.treeLettering==='kabel-black'&&BCStudio.state.recipe==='long-wildfire'"))
        page.evaluate("BCStudio.startRecipe('forest-service')");page.wait_for_function("BCStudio.current.state.recipe==='forest-service'")
        ready=page.evaluate("(()=>{const f=BCLogo.fontState.get('kabel-black');return {source:f.source,status:f.status,verified:f.verified,advance:f.advance,mime:f.loaded?.[0].mime}})()")
        check('Actual OTF loads as bundled, verified, 900-weight Kabel',ready['source']=='bundled' and ready['verified'] and ready['mime']=='font/otf',ready)
        check('Both inscriptions use the selected face',page.evaluate("BCStudio.current.report.length===2&&BCStudio.current.report.every(r=>r.face==='kabel-black'&&r.weight===900)"))
        check('Two native textPaths; no per-character transforms or glyph stretching',page.evaluate("BCStudio.current.svg.querySelectorAll('textPath').length===2&&!BCStudio.current.svg.querySelector('[textLength],[lengthAdjust],[data-character-index]')"))
        check('Configuration save/normalise/recipe switch retains the selection',page.evaluate("JSON.parse(BCStudio.configText()).treeLettering==='kabel-black'&&BCLogo.recipeState('wildfire-management',BCStudio.state).treeLettering==='kabel-black'&&BCLogo.normalise(JSON.parse(BCStudio.configText())).treeLettering==='kabel-black'"))
        check('Older configurations retain reference-v2 rather than silently migrating',page.evaluate("BCLogo.normalise({recipe:'forest-service',textFit:'reference-calibrated'}).treeLettering==='reference-v2'&&BCLogo.role('crest-service-upper',BCLogo.recipeState('forest-service',{textFit:'reference-calibrated'})).face==='open-bold'"))
        check('Unknown selector values fail explicitly',page.evaluate("(()=>{try{BCLogo.normalise({treeLettering:'typo'});return false}catch{return true}})()"))
        check('Explicit user face overrides still win',page.evaluate("BCLogo.role('crest-service-upper',BCLogo.normalise({...BCStudio.state,roles:{'crest-service-upper':{face:'open-bold'}}})).face==='open-bold'"))
        stable=page.evaluate("""()=>['forests','long-ministry','parks'].map(recipe=>{const a=BCLogo.makeLogo(BCLogo.recipeState(recipe,{textFit:'reference-calibrated'})),b=BCLogo.makeLogo(BCLogo.recipeState(recipe,{textFit:'reference-calibrated',treeLettering:'kabel-black'}));return {recipe,equal:JSON.stringify(a.report)===JSON.stringify(b.report)}})""")
        check('Wildlife and thin Parks presets retain their original typography',all(r['equal'] for r in stable),stable)
        matrix=page.evaluate("""()=>{const rows=[];for(const content of [{upper:'FOREST SERVICE',lower:'BRITISH COLUMBIA'},{upper:'CONSERVATION',lower:'NATURAL RESOURCES'},{upper:'A < B & C',lower:'W'.repeat(320)},{upper:'',lower:''}])for(const width of [100,600,1600,6000]){
          const s={...BCStudio.state,content,outputWidth:width};const r=BCLogo.makeLogo(s);document.body.append(r.svg);
          const texts=[...r.svg.querySelectorAll('text[data-live-text]')];rows.push({width,finite:!/(NaN|Infinity)/.test(BCLogo.serialise(r)),kabel:r.report.every(x=>x.face==='kabel-black'),preserved:texts.every(t=>t.textContent===content[t.dataset.liveText]),fit:r.report.every(x=>x.width<=x.available+.1),advance:texts.every((t,i)=>Math.abs(t.getComputedTextLength()-r.report[i].width)<.1),noStretch:!r.svg.querySelector('[textLength],[lengthAdjust],[data-character-index]')});r.svg.remove();}return rows}""")
        for key in ['finite','kabel','preserved','fit','advance','noStretch']:check('16 custom/output-size cases: '+key,all(r[key] for r in matrix))
        svg=page.evaluate('BCLogo.serialise(BCStudio.current)');(out/'forest-service-kabel.svg').write_text(svg)
        check('Editable export references the correct local font names without font payloads','local("Kabel Black")' in svg and 'local("Kabel-Black")' in svg and 'data:font' not in svg and 'url(data:' not in svg)
        page.screenshot(path=str(out/'studio-kabel.png'))
        page.locator('#livePreview').screenshot(path=str(out/'forest-service-kabel.png'))
        page.locator('[data-mode="overlay"]').click();page.locator('#drawing').screenshot(path=str(out/'studio-reference-overlay.png'))
        check('Source overlay remains available',page.locator('#refPreview image').count()==1)
        page.locator('[data-mode="design"]').click()
        png_script="""async()=>{const blob=await BCLogo.png(BCStudio.current,1200);return new Promise(ok=>{const rd=new FileReader;rd.onload=()=>ok(rd.result.split(',')[1]);rd.readAsDataURL(blob)})}"""
        png=base64.b64decode(page.evaluate(png_script));(out/'forest-service-export.png').write_bytes(png)
        check('PNG export is a valid 1200px image',Image.open(io.BytesIO(png)).size[0]==1200)
        mime=page.evaluate("""async()=>{const fn=URL.createObjectURL;let captured;URL.createObjectURL=function(blob){if(blob.type==='image/svg+xml')captured=blob.text();return fn.call(URL,blob)};try{await BCLogo.png(BCStudio.current,300);const xml=await captured;return {otf:xml.includes('data:font/otf;base64,'),wrongMime:xml.includes('data:font/woff2;base64,')}}finally{URL.createObjectURL=fn}}""")
        check('Transient PNG rasterization declares OTF, not WOFF2',mime['otf'] and not mime['wrongMime'],mime)
        # Upload with the real file input. Changing it must not alter the saved wording.
        page.locator('#kabelFile').set_input_files(str(args.font));page.wait_for_function("BCLogo.fontState.get('kabel-black')?.source==='uploaded'&&!document.getElementById('loadKabel').disabled")
        uploaded=base64.b64decode(page.evaluate(png_script))
        check('Bundled and user-loaded OTF produce identical PNG pixels',np.array_equal(np.asarray(Image.open(io.BytesIO(png))),np.asarray(Image.open(io.BytesIO(uploaded)))))
        page.evaluate("async()=>{BCLogo.retryFonts();await BCStudio.refresh()}")
        check('Retry retains the session-loaded font and remeasures it',page.evaluate("BCLogo.fontState.get('kabel-black').source==='uploaded'&&BCLogo.fontState.get('kabel-black').verified"))
        check('Invalid upload does not replace the working font',page.evaluate("async()=>{try{await BCLogo.supplyFont('kabel-black',new Uint8Array(20).buffer);return false}catch{return BCLogo.fontState.get('kabel-black').verified}}"))
        page.locator('#treeLettering').select_option('reference-v2');page.wait_for_function("BCStudio.current.state.treeLettering==='reference-v2'")
        check('Standalone selector can return to the original v2 substitutes',page.evaluate("BCStudio.current.report.map(r=>r.face).join(',')==='open-bold,raleway-black'"))
        # All legacy policies must remain byte-for-byte identical, apart from the
        # explicitly added configuration field (removed with metadata for this check).
        if args.baseline:
            base_html=builder(args.baseline/'bc-ministry-primitives-v5').build(out/'baseline.html').read_text()
            before=browser.new_page();before.set_content(base_html);before.wait_for_function('window.BCStudio?.current')
            old=before.evaluate(SNAPSHOT);new=page.evaluate(SNAPSHOT)
            check('All 56 pre-existing recipe/policy renderings remain identical',old==new,{'cases':len(old)});before.close()
        # No-source case must warn and must not send Kabel to Google Fonts.
        bare=re.sub(r'<script>globalThis.BC_FONT_SOURCES=.*?</script>','<script>globalThis.BC_FONT_SOURCES={};</script>',html,count=1,flags=re.S)
        missing=browser.new_page();requests=[];missing.on('request',lambda r:requests.append(r.url));missing.set_content(bare);missing.wait_for_function('window.BCStudio?.current')
        missing.evaluate("BCStudio.startRecipe('forest-service')");missing.wait_for_function("BCStudio.current.state.recipe==='forest-service'")
        check('Missing OTF is visibly reported, not silently identified as Kabel',missing.evaluate("BCStudio.current.warnings.some(w=>w.code==='FONT_FALLBACK'&&w.message.includes('Kabel'))"))
        missing.evaluate("BCLogo.ensureFonts(['kabel-black'],true)")
        check('Kabel never triggers a Google Fonts request',not any('googleapis' in u or 'gstatic' in u for u in requests))
        # Compile the actual editor source, not a second implementation. This does
        # not exercise Vite's asset URL generation or React mounting.
        tsc=ROOT.parent/'shared-primitives/site/node_modules/.bin/tsc'
        compiler=str(tsc) if tsc.exists() else shutil.which('tsc')
        if compiler:
            compiled=out/'compiled';cfg=out/'editor-tsconfig.json'
            cfg.write_text(json.dumps({'compilerOptions':{'target':'ES2022','module':'ESNext','moduleResolution':'bundler','lib':['ES2022','DOM','DOM.Iterable'],'strict':True,'types':[],'skipLibCheck':True,'outDir':str(compiled)},'files':[str(ROOT.parent/'shared-primitives/site/src/lettering/editor.ts'),str(ROOT.parent/'shared-primitives/site/src/lettering/types.ts')]}))
            run=subprocess.run([compiler,'-p',str(cfg)],capture_output=True,text=True)
            check('Affected Compose controller and types pass strict TypeScript checking',run.returncode==0,run.stdout+run.stderr)
            if run.returncode==0:
                controller=(compiled/'editor.js').read_text().replace('export ','')
                scripts=re.findall(r'<script\b[^>]*>[\s\S]*?</script>',bare)[:-1]
                fixture='<!doctype html><html><head><style>'+(ROOT.parent/'shared-primitives/site/src/lettering/editor.css').read_text()+'</style></head><body><div id="editor"></div>'+''.join(scripts)+'<script>'+controller+'\nwindow.editor=new LetteringEditor(document.getElementById("editor"),{runtime:()=>Promise.resolve({E:BCLogo,P:BCPrimitives}),storage:null});</script></body></html>'
                ui=browser.new_page(viewport={'width':1400,'height':1100});ui.on('pageerror',lambda e:errors.append(str(e)));ui.set_content(fixture)
                ui.wait_for_function('window.editor?.configuration');ui.get_by_label('Current preset',exact=True).select_option('forest-service')
                ui.wait_for_function("document.querySelector('.fo-editor [data-part=\"canvas\"] text')?.getAttribute('data-face')==='kabel-black'")
                check('Compose blocks unverified-font export before OTF loading',ui.locator('[data-action="svg"]').is_disabled() and ui.locator('[data-part="font-ack"]').is_visible())
                ui.locator('[data-part="kabel-file"]').set_input_files(str(args.font));ui.wait_for_function('!document.querySelector("[data-action=svg]").disabled')
                check('Compose file picker loads the OTF and enables verified export',ui.evaluate("BCLogo.fontState.get('kabel-black').source==='uploaded'&&BCLogo.fontState.get('kabel-black').verified"))
                ui.get_by_label('Upper oval text',exact=True).fill('FOREST RESEARCH');ui.wait_for_function("document.querySelector('[data-part=canvas] [data-live-text=upper]').textContent==='FOREST RESEARCH'")
                check('Compose custom wording remains an editable Kabel textPath',ui.locator('[data-part="canvas"] [data-live-text="upper"] textPath').count()==1)
                ui.get_by_role('button',name='Reset this preset',exact=True).click();ui.wait_for_function("document.querySelector('[data-part=canvas] [data-live-text=upper]').textContent==='FOREST SERVICE'")
                check('Compose reset selects Kabel with the standard Forest Service words',ui.get_by_label('Tree oval lettering',exact=True).input_value()=='kabel-black')
                ui.screenshot(path=str(out/'compose-kabel.png'))
                ui.set_viewport_size({'width':390,'height':844})
                check('Compose has no horizontal overflow at 390px',ui.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                ui.close()
        else:
            results.append({'name':'Compose TypeScript/controller tests','passed':None,'detail':'tsc unavailable; not run'})
        check('No uncaught browser errors',not errors,errors)
        browser_version=browser.version;browser.close()
    result={'browser':browser_version,'scope':'Actual standalone builder; actual compiled Compose DOM controller. Not a full Vite/React build.','fontSha256':manifest['sha256'],'checks':results,'passed':sum(r['passed'] is True for r in results),'failed':sum(r['passed'] is False for r in results),'notRun':sum(r['passed'] is None for r in results)}
    (out/'kabel-test-report.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['passed','failed','notRun']}))
    return int(result['failed']>0)

if __name__=='__main__':raise SystemExit(main())
