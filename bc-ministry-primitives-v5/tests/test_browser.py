#!/usr/bin/env python3
"""Real-browser regressions for the standalone studio. No server is required.

By default the page, screenshots, PNG export and results go to tests/output/
(not tracked). --update also refreshes the committed copies in review/ and
tests/results.json. The default faces must be installed locally, or pass
--network-fonts to load them from Google Fonts."""
from pathlib import Path
import argparse,os,json,base64,sys,hashlib,shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from build import build
ap=argparse.ArgumentParser(description=__doc__.split('\n')[0])
ap.add_argument('--update',action='store_true',help='also overwrite review/*.png and tests/results.json')
ap.add_argument('--network-fonts',action='store_true',help='load the default faces from Google Fonts when they are not installed')
ARGS=ap.parse_args()
OUT=ROOT/'tests/output'
OUT.mkdir(parents=True,exist_ok=True)
PAGE=build(OUT/'studio.html')
RESULTS=[]
def record(name,passed,details=None):
    RESULTS.append({'name':name,'passed':bool(passed),'details':details})
    print(('PASS' if passed else 'FAIL')+' '+name,flush=True)
with sync_playwright() as pw:
    exe=os.environ.get('CHROMIUM') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
    browser=pw.chromium.launch(**({'executable_path':exe} if exe else {}),args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1450,'height':1120},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(PAGE.read_text(encoding='utf-8'))
    page.wait_for_function('window.BCStudio && BCStudio.current!==null')
    start=page.evaluate("({state:BCStudio.current.state.textFit,control:document.getElementById('textFit').value})")
    record('A fresh studio starts with reference-calibrated fitting, like Compose and Recreations',start=={'state':'reference-calibrated','control':'reference-calibrated'},start)
    page.evaluate('n=>BCLogo.ensureFonts(Object.keys(BCPrimitives.ROLES).map(k=>BCPrimitives.ROLES[k].face),n)',ARGS.network_fonts)
    font_status=page.evaluate('[...BCLogo.fontState].map(([id,v])=>({id,status:v.status,source:v.source}))')
    record('All default role faces load at their requested weight',all(f['status']=='ready' for f in font_status),font_status)
    data=page.evaluate('''()=>{
      const results=[];
      function audit(s){const r=BCLogo.makeLogo(s),v=r.svg;document.body.append(v);const ids=[...v.querySelectorAll('[id]')].map(e=>e.id),dup=ids.length!==new Set(ids).size;
        const missing=[...v.querySelectorAll('use,textPath')].filter(e=>{const id=(e.getAttribute('href')||'').slice(1);return !ids.includes(id);}).length;
        const runs=[...v.querySelectorAll('text')];let overflow=[];
        for(let i=0;i<runs.length;i++){const row=r.report[i],actual=runs[i].getComputedTextLength();if(row.slot&&actual>row.available+.5)overflow.push({text:row.text,actual,available:row.available});}
        const result={recipe:s.recipe,duplicateIds:dup,missingReferences:missing,runCount:runs.length,reportCount:r.report.length,overflow,finite:r.report.every(x=>Number.isFinite(x.size)&&Number.isFinite(x.cap)&&x.width<=x.available+.5),invalid:/(NaN|Infinity)/.test(BCLogo.serialise(r)),perCharacterTransforms:v.querySelectorAll('[data-character-index]').length,stretch:v.querySelectorAll('[textLength],[lengthAdjust]').length};v.remove();return result;}
      for(const rec of BCPrimitives.RECIPES.filter(x=>!x.excluded))results.push(audit(BCLogo.recipeState(rec.id)));
      return results;}''')
    for r in data:
        record('Recipe: '+r['recipe'],not r['duplicateIds'] and not r['missingReferences'] and not r['overflow'] and r['finite'] and not r['invalid'] and r['runCount']==r['reportCount'] and not r['perCharacterTransforms'] and not r['stretch'],r)
    shared=page.evaluate('''()=>{const pairs=[['forests','forests-wildfire'],['long-ministry','long-wildfire'],['forest-service','wildfire-management'],['bcts-tree','bcts-district']];return pairs.map(([a,b])=>{const pick=id=>BCLogo.makeLogo(BCLogo.recipeState(id)).report.filter(x=>['upper','lower'].some(y=>x.slot?.endsWith(y)));return{pair:[a,b],equal:JSON.stringify(pick(a))===JSON.stringify(pick(b))};});}''')
    for r in shared:record('Shared lettering identity: '+' / '.join(r['pair']),r['equal'])
    role=page.evaluate('''()=>{const base=BCLogo.recipeState('long-wildfire'),a=BCLogo.makeLogo(base),s=BCLogo.clone(base);s.roles['crest-condensed']={capScale:.93};const b=BCLogo.makeLogo(s);return{upperChanged:a.report[0].cap!==b.report[0].cap,lowerChanged:a.report[1].cap!==b.report[1].cap,serviceUnchanged:JSON.stringify(a.report[2])===JSON.stringify(b.report[2])};}''')
    record('Crest-role changes do not alter the independent service role',all(role.values()),role)
    geom=page.evaluate('''()=>{function shape(theme){const s=BCLogo.recipeState('forests');s.theme=theme;const v=BCLogo.makeLogo(s).svg;return [...v.querySelectorAll('defs [data-primitive="scene-wildlife"] *')].map(e=>[e.tagName,...['d','points','x','y','width','height','rx','ry','transform'].map(k=>e.getAttribute(k))]);}return JSON.stringify(shape('wildlife'))===JSON.stringify(shape('mono'));}''')
    record('Recolouring leaves the source scene geometry identical',geom)
    originals=json.loads((ROOT/'data/art.json').read_text(encoding='utf-8'))
    hashes={k:hashlib.sha256(v.encode()).hexdigest() for k,v in originals.items()}
    expected=json.loads((ROOT/'data/art-sha256.json').read_text(encoding='utf-8'))
    record('Original artwork strings match the imported master hashes',hashes==expected)
    stress=page.evaluate('''()=>{let rows=[];const names=['A','FORESTS','ENVIRONMENT AND CLIMATE CHANGE','Forests, Lands and Natural Resource Operations','W'.repeat(160),'A'.repeat(320),'ÉCOLOGIE & PÊCHES','A < B & "C"',''];for(const recipe of ['forests','long-ministry','forest-service'])for(const lower of names){const s=BCLogo.recipeState(recipe);s.content.lower=lower;const r=BCLogo.makeLogo(s);document.body.append(r.svg);const t=r.svg.querySelector('text[data-live-text="lower"]'),run=r.report.find(x=>x.slot?.endsWith('lower'));rows.push({recipe,n:lower.length,preserved:lower?(t?.textContent===lower):!t,fit:!t||t.getComputedTextLength()<=run.available+.5,smallWarning:lower.length<160||r.warnings.some(w=>w.code==='SMALL_TEXT')});r.svg.remove();}return rows;}''')
    record('27 short, long, empty, accented and escaped-name cases preserve text and fit',all(all(r[k] for k in ['preserved','fit','smallWarning'])for r in stress),stress)
    auto=page.evaluate('''()=>{const s=BCLogo.recipeState('forests');s.autoProfile=true;s.content.lower='Forests';const a=BCLogo.makeLogo(s).crest;s.content.lower='Forests, Lands and Natural Resource Operations';const b=BCLogo.makeLogo(s).crest;return[a,b];}''')
    record('Automatic profile selection is based on measured width',auto==['wildlife-caps','wildlife-long'],auto)
    roundtrip=page.evaluate('''()=>{const s=BCLogo.recipeState('bcts-district');s.roles['wordmark-heavy']={capScale:.94};s.content.district='Prince George';const a=BCLogo.makeLogo(s),b=BCLogo.makeLogo(JSON.parse(JSON.stringify(a.state)));return JSON.stringify(a.report)===JSON.stringify(b.report);}''')
    record('Configuration round trip preserves resolved typography',roundtrip)
    all_layouts=page.evaluate('''()=>Object.keys(BCPrimitives.LOCKUPS).map(layout=>{const s=BCLogo.recipeState('bcts-tree');s.layout=layout;s.content.lines='BC\\nTimber\\nSales';s.content.branch='EXAMPLE BRANCH';const r=BCLogo.makeLogo(s);return {layout,ok:r.viewBox.w>0&&r.viewBox.h>0&&r.report.every(x=>Number.isFinite(x.size))};})''')
    record('All seven composition types render with finite bounds',all(r['ok'] for r in all_layouts),all_layouts)
    containment=page.evaluate("""async()=>{
      const read=async(blob)=>{const url=URL.createObjectURL(blob);try{const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url;});const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,c.width,c.height).data;}finally{URL.revokeObjectURL(url);}};
      const rows=[];
      // The band is found from paper pixels; a see-through holder has the same geometry.
      for(const recipe of ['forests','forests-wildfire','long-wildfire','forest-service','wildfire-management','parks']){
        const s={...BCLogo.recipeState(recipe),tabBacking:'paper'},r=BCLogo.makeLogo(s),bg=r.svg.cloneNode(true),ink=r.svg.cloneNode(true);
        bg.querySelectorAll('text').forEach(t=>t.remove());ink.querySelector('[data-layer="composition"]').querySelectorAll('path,ellipse,rect,use,circle').forEach(x=>x.remove());
        ink.querySelectorAll('text').forEach(t=>{t.setAttribute('fill','#ff0000');if(!t.dataset.slot)t.remove();});
        const a=await read(await BCLogo.png({...r,svg:bg},900)),b=await read(await BCLogo.png({...r,svg:ink},900));
        const hex=BCPrimitives.THEMES[s.theme].paper,paper=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));let total=0,outside=0;
        for(let i=0;i<b.length;i+=4)if(b[i+3]>128){total++;if(a[i+3]<=128||Math.max(...paper.map((v,j)=>Math.abs(a[i+j]-v)))>=30)outside++;}
        rows.push({recipe,solidTextPixels:total,outsidePaperPixels:outside});
      }return rows;
    }""")
    for row in containment:
        record('Glyph ink stays inside the lettering band: '+row['recipe'],row['outsidePaperPixels']==0,row)
    backing=page.evaluate('''()=>{
      const parts=(recipe,extra={})=>{const r=BCLogo.makeLogo({...BCLogo.recipeState(recipe),...extra});const ribbon=r.svg.querySelector('[data-tab-backing]');
        return {backing:r.state.tabBacking,marked:ribbon?.getAttribute('data-tab-backing'),faces:ribbon?.querySelectorAll('[data-tab-part="face"]').length,
          ring:[...r.svg.querySelectorAll('[data-primitive="reactive-service-ribbon"] [data-tab-part="border"]')].map(x=>x.getAttribute('fill-rule'))};};
      return {fw:parts('forests-wildfire'),lw:parts('long-wildfire'),fwPaper:parts('forests-wildfire',{tabBacking:'paper'}),
        fwReactive:parts('forests-wildfire',{tabSizing:'follow-text'}),bogus:BCLogo.normalise({recipe:'long-wildfire',tabBacking:'glass'}).tabBacking};}''')
    record('Service holder backing follows the preset: Forests · Wildfire Service see-through, long ministry paper',
           backing['fw']['backing']=='transparent' and backing['fw']['faces']==0 and backing['lw']['backing']=='paper' and backing['lw']['faces']==1 and backing['fwPaper']['faces']==1 and backing['bogus']=='paper',backing)
    record('A see-through reactive holder is one even-odd ring',backing['fwReactive']['ring']==['evenodd'] and backing['fwReactive']['faces']==0,backing['fwReactive'])
    faces=page.evaluate("async()=>{const ids=Object.keys(BCPrimitives.FACES);await BCLogo.ensureFonts(ids,false);return ids.map(id=>({id,...BCLogo.fontState.get(id),font:undefined}))}")
    record('Ready faces are verified against the calibration advances',all(f.get('verified') for f in faces if f['status']=='ready'),[{k:f.get(k) for k in ('id','status','source','verified','advance')} for f in faces])
    mismatch=page.evaluate('''()=>{const st=BCLogo.fontState.get('open-heavy'),saved={...st};Object.assign(st,{verified:false,advance:st.advance*1.01});
      try{return BCLogo.makeLogo(BCLogo.recipeState('forests')).warnings.map(w=>w.code)}finally{BCLogo.fontState.set('open-heavy',saved)}}''')
    record('A face whose advances differ is reported, not silently used',('FONT_METRICS_MISMATCH' in mismatch) or not any(f['id']=='open-heavy' and f['status']=='ready' for f in faces),mismatch)
    # Retry: a face that settled on a local copy because the supplied file failed
    # must be loaded again from the supplied file once it is available.
    noto=ROOT.parent/'shared-primitives/site/node_modules/@fontsource-variable/noto-sans/files/noto-sans-latin-wdth-normal.woff2'
    supply={'ok':False,'requests':0}
    def serve(route):
        supply['requests']+=1
        cors={'access-control-allow-origin':'*'}
        if supply['ok'] and noto.exists():route.fulfill(status=200,body=noto.read_bytes(),headers={**cors,'content-type':'font/woff2'})
        else:route.fulfill(status=404,headers=cors)
    page.route('https://fonts.test/**',serve)
    load="async()=>{BCLogo.retryFonts();await BCLogo.ensureFonts(['noto-condensed'],false);const s=BCLogo.fontState.get('noto-condensed');return {status:s.status,source:s.source,verified:s.verified}}"
    page.evaluate("window.BC_FONT_SOURCES={'noto-condensed':[{url:'https://fonts.test/noto.woff2'}]}")
    first=page.evaluate(load);before=supply['requests'];supply['ok']=True
    second=page.evaluate(load)
    retried=supply['requests']>before and first['source']=='local' and (second['source']=='bundled' and second['verified'] if noto.exists() else second['source']=='local')
    record('Retry reloads a face from its supplied source after settling on a local copy',retried,{'first':first,'second':second,'requests':supply['requests'],'suppliedFile':noto.exists()})
    # A load that started before a retry must not overwrite the newer result.
    stale=page.evaluate("""async()=>{const real=window.fetch;window.fetch=async(u,...r)=>{if(String(u).includes('slow')){await new Promise(ok=>setTimeout(ok,400));return new Response('',{status:404})}return real(u,...r)};
      try{window.BC_FONT_SOURCES={'noto-condensed':[{url:'https://fonts.test/slow.woff2'}]};BCLogo.retryFonts();const old=BCLogo.ensureFonts(['noto-condensed'],false);
        await new Promise(ok=>setTimeout(ok,50));window.BC_FONT_SOURCES={'noto-condensed':[{url:'https://fonts.test/noto.woff2'}]};BCLogo.retryFonts();
        const now=(await BCLogo.ensureFonts(['noto-condensed'],false))[0].source;await old;return {now,after:BCLogo.fontState.get('noto-condensed').source}}
      finally{window.fetch=real}}""")
    record('A font load started before a retry cannot overwrite the newer result',stale['after']==stale['now'] and (stale['now']=='bundled' if noto.exists() else True),stale)
    page.unroute('https://fonts.test/**')
    page.evaluate("async()=>{delete window.BC_FONT_SOURCES;BCLogo.retryFonts();await BCLogo.ensureFonts(Object.keys(BCPrimitives.FACES),false)}")
    page.evaluate("BCStudio.startRecipe('bcts-tree')")
    page.wait_for_function("BCStudio.current.state.recipe==='bcts-tree'")
    png=page.evaluate('''async()=>{const b=await BCLogo.png(BCStudio.current,1000);return await new Promise(ok=>{const rd=new FileReader();rd.onload=()=>ok(rd.result);rd.readAsDataURL(b);});}''')
    png_bytes=base64.b64decode(png.split(',')[1]);(OUT/'png-export.png').write_bytes(png_bytes)
    record('PNG export returns a real PNG image',png_bytes[:8]==b'\x89PNG\r\n\x1a\n' and len(png_bytes)>1000,{'bytes':len(png_bytes)})
    svg=page.evaluate('BCLogo.serialise(BCStudio.current)')
    record('Export has coherent live text and contains no font payload',all(x not in svg for x in ['data:font','data:application/font','spacingAndGlyphs','data-character-index']) and '<textPath' in svg)
    z=page.evaluate('''async()=>{const b=BCStudio.zip([['éxample.txt','one'],['two.json','{}']]);return await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(b);});}''')
    import io,zipfile
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(z.split(',')[1]))) as f:
        record('ZIP export round-trips UTF-8 names and file content',f.read('éxample.txt')==b'one' and f.read('two.json')==b'{}')
    page.locator('[data-mode="guides"]').click()
    record('Rule overlay exposes fitted baselines',page.locator('#guidesPreview path').count()>0)
    page.locator('[data-mode="overlay"]').click()
    record('Source overlay uses a uniform scale only',page.locator('#refPreview image').count()==1 and page.locator('#refPreview g').get_attribute('transform').count('scale(')==1)
    page.locator('[data-mode="design"]').click()
    page.evaluate("BCStudio.startRecipe('long-wildfire')")
    page.wait_for_function("BCStudio.current.state.recipe==='long-wildfire'")
    page.screenshot(path=str(OUT/'studio-desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/'studio-mobile.png'),full_page=True)
    record('390 px mobile viewport has no horizontal document overflow',page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
    record('Excluded Fire Control is not in the selectable family',page.locator('#recipe option[value="fire-control"]').count()==0 and page.locator('#gallery [data-recipe="fire-control"]').count()==0)
    record('No uncaught browser errors',not errors,errors)
    browser.close()
summary={'tests':len(RESULTS),'passed':sum(x['passed']for x in RESULTS),'failed':sum(not x['passed']for x in RESULTS),'environment':'Chromium via Playwright; default faces from '+(', '.join(sorted({f['source'] for f in font_status})) or 'nowhere')+(' (network fonts allowed)' if ARGS.network_fonts else ' (local fonts only)'),'results':RESULTS}
(OUT/'results.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
if ARGS.update:
    for name in ['png-export.png','studio-desktop.png','studio-mobile.png']:shutil.copyfile(OUT/name,ROOT/'review'/name)
    shutil.copyfile(OUT/'results.json',ROOT/'tests/results.json')
    print('Updated review/ and tests/results.json')
print(json.dumps({k:v for k,v in summary.items() if k!='results'},indent=2))
sys.exit(1 if summary['failed'] else 0)
