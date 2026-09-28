#!/usr/bin/env python3
"""Reactive-tab regressions in real Chromium.

Default: build and test the actual standalone studio with repository artwork.
--isolated: use a deliberately minimal DOM/artwork fixture with the real source
modules. This is not a historical-fidelity or full-repository test.
No network-font downloads are performed. No fonts are included in artifacts.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import os
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHARED = ROOT.parent / 'shared-primitives'


def fixture(root: Path) -> str:
    """Fixtures replace only the DOM shell, images, and crest artwork, not JS."""
    profile = json.loads((root.parent / 'shared-primitives/layout.json').read_text())['tab']
    helper = (SHARED / 'tab-layout.js').read_text()
    sources = {name: (root / f'src/{name}.js').read_text() for name in ['primitives', 'engine', 'studio']}
    selects = ['recipe','crest','tab','layout','theme','typeRole','typeSlot','typeFace']
    inputs = {'roleCap':1,'roleTracking':0,'slotCap':48,'slotTracking':0,'slotRX':400,'slotRY':484,
              'outputWidth':900,'opacity':0.5,'refScale':1,'refX':0,'refY':0}
    buttons = ['resetRecipe','resetRole','resetSlot','resetCompare','loadFonts','exportSVG','exportPNG',
               'exportFamily','exportConfig','importConfig']
    others = ['toast','roleUses','referenceNote','liveCount','warnings','fontStatus','galleryStatus',
              'currentTitle','compositionPath','recipeNote','canvasLabel']
    labels = {'slotCap':'Preferred cap height','roleCap':'Cap-height multiplier','recipe':'Reference example',
              'typeSlot':'Baseline slot','typeRole':'Typography role','tab':'Service tab'}
    controls = ''.join(f'<label>{labels.get(i,i)}<select id="{i}"></select></label>' for i in selects)
    controls += ''.join(f'<label>{labels.get(i,i)}<input type="number" step="any" id="{i}" value="{v}"></label>' for i,v in inputs.items())
    controls += '<label>Automatic profile<input type="checkbox" id="autoProfile"></label>'
    controls += '<div id="contentFields"></div><input id="configFile" type="file">'
    controls += ''.join(f'<button id="{i}">{i}</button>' for i in buttons)
    status = ''.join(f'<div id="{i}"></div>' for i in others)
    # A neutral ellipse fixture. This is deliberately not the ministry landscape.
    art = '''const fp=BCTabProfile,fr=BCTabLayout.tabBands(fp,'lower');
const fixtureFrame=`<ellipse cx="${fp.oval[0]}" cy="${fp.oval[1]}" rx="${fp.oval[2]}" ry="${fp.oval[3]}" fill="#ffffff" stroke="#000000" stroke-width="8"/>`;
window.BC_ART={wildlifeFrame:fixtureFrame,treeFrame:fixtureFrame,wildlifeScene:'<g/>',treeInner:'<g/>',wildlifeClip:'<g/>',sourceRibbon:`<path d="${fr.border}" fill="#000000"/><path d="${fr.face}" fill="#ffffff"/>`};'''
    css = '''body{font:14px system-ui;margin:24px;max-width:1400px}header{margin-bottom:20px}
main{display:grid;grid-template-columns:290px minmax(0,1fr);gap:24px}label{display:block;margin:8px 0}select,input{display:block;max-width:100%;box-sizing:border-box;width:100%;padding:6px}input[type=checkbox]{width:auto}button{margin:3px;padding:5px}small{display:block}#livePreview svg,#guidesPreview svg{width:100%;height:auto;max-height:740px}#refPreview{display:none}#gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.tile{min-width:0}.thumb svg{width:100%;height:120px}.sub{display:block}table{width:100%;font-size:12px}#guidesPreview{position:absolute;inset:0;pointer-events:none}#drawing{position:relative}#compare{display:none}@media(max-width:600px){main{grid-template-columns:1fr}#gallery{grid-template-columns:repeat(2,minmax(0,1fr))}}'''
    def script(text: str) -> str:
        return '<script>' + text.replace('</script', '<\\/script') + '</script>'
    return (f'<!doctype html><html lang="en"><meta charset="utf-8"><title>Forestoval isolated reactive-tab test</title>'
            f'<meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style>'
            '<header><h1>Forestoval · reactive-tab test fixture</h1><p>Recovered source modules; simplified test artwork and page shell. Not the deployed site or an approved reference reproduction.</p></header>'
            f'<main><aside>{controls}</aside><section>{status}<div id="compare"></div>'
            '<nav><button data-mode="design">Design</button><button data-mode="guides">Rules</button><button data-mode="overlay">Overlay</button><button data-mode="source">Source</button></nav>'
            '<div id="drawing"><div id="livePreview"></div><div id="refPreview"></div><div id="guidesPreview"></div></div>'
            '<table><tbody id="metricsBody"></tbody></table></section></main><div id="gallery"></div>'
            '<script type="application/json" id="reference-data">{}</script>'
            + script('globalThis.BCTabProfile='+json.dumps(profile)+';')+script(helper)+script(art)
            + ''.join(script(sources[n]) for n in ['primitives','engine','studio'])+'</html>')


def main() -> int:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--isolated',action='store_true')
    ap.add_argument('--out',type=Path,default=ROOT/'tests/output/reactive-tabs')
    ap.add_argument('--baseline-dir',type=Path,help='Optional source-recovered baseline studio directory for a behavioural comparison')
    args=ap.parse_args()
    if args.baseline_dir and not args.isolated:
        ap.error('--baseline-dir compares recovered source modules and requires --isolated')
    out=args.out.resolve();out.mkdir(parents=True,exist_ok=True)
    if args.isolated:
        html=fixture(ROOT)
    else:
        spec=importlib.util.spec_from_file_location('studio_build',ROOT/'build.py')
        mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
        html=mod.build(out/'studio.html').read_text()
    (out/'studio.html').write_text(html)
    results=[]
    def record(name, passed, details=None):
        result={'name':name,'passed':bool(passed),'details':details};results.append(result)
        print(('PASS ' if passed else 'FAIL ')+name,flush=True)
    with sync_playwright() as pw:
        executable=os.environ.get('CHROMIUM') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        browser=pw.chromium.launch(**({'executable_path':executable} if executable else {}),args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1350,'height':1050},accept_downloads=True)
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html);page.wait_for_function('window.BCStudio?.current',timeout=20000)
        fonts=page.evaluate("async()=>{await BCLogo.ensureFonts(['open-heavy','condensed-bold']);return ['open-heavy','condensed-bold'].map(id=>({id,status:BCLogo.fontState.get(id)?.status,source:BCLogo.fontState.get(id)?.source}));}")
        record('Both service-tab faces load locally at their requested weight',all(f['status']=='ready' for f in fonts),fonts)
        if args.baseline_dir:
            old=browser.new_page();old.set_content(fixture(args.baseline_dir))
            old.wait_for_function('window.BCStudio?.current',timeout=20000)
            baseline=old.evaluate('''()=>{const s=BCLogo.recipeState('long-wildfire');const a=BCLogo.makeLogo(s);s.roles['service-heavy']={capScale:1.5};const b=BCLogo.makeLogo(s);const get=r=>r.svg.querySelector('defs [data-primitive="service-ribbon"]').innerHTML;return{holderUnchanged:get(a)===get(b),beforeCap:a.report.find(x=>x.slot==='service-bottom').cap,afterCap:b.report.find(x=>x.slot==='service-bottom').cap};}''')
            old.select_option('#typeRole','service-heavy');old.locator('#roleCap').fill('1.3');old.wait_for_timeout(250)
            baseline['inputEventLeavesOldState']=old.evaluate("BCStudio.state.roles['service-heavy']?.capScale!==1.3")
            record('Baseline reproduces fixed holder and change-only input defects',baseline['holderUnchanged'] and baseline['inputEventLeavesOldState'],baseline)
            old.close()
        # Preservation across every recipe: pixel/geometry comparison uses a separately loaded original engine.
        if args.baseline_dir:
            old=browser.new_page();old.set_content(fixture(args.baseline_dir));old.wait_for_function('window.BCStudio?.current')
            get="""()=>BCPrimitives.RECIPES.filter(x=>!x.excluded).map(x=>{const r=BCLogo.makeLogo(BCLogo.recipeState(x.id),{prefix:'compare'});r.svg.querySelector('metadata').remove();return{id:x.id,svg:BCLogo.serialise(r),report:r.report};})"""
            a=old.evaluate(get);b=page.evaluate(get)
            record('All 14 legacy recipes retain identical SVG geometry and text reports',a==b,{'recipes':len(a)})
            old.close()
        data=page.evaluate('''()=>{
          const rows=[];
          for(const recipe of ['long-wildfire','wildfire-management'])for(const cap of [24,36,48,64,80,100])for(const text of ['WILDFIRE SERVICE','WILDFIRE MANAGEMENT','Écologie & pêches','Agj ÅÉ']){
            const s=BCLogo.recipeState(recipe);s.tabSizing='follow-text';s.content.service=text;
            s.slots[BCPrimitives.TABS[s.tab].slot]={cap};const r=BCLogo.makeLogo(s);document.body.append(r.svg);
            const run=r.report.find(x=>x.tab),t=r.svg.querySelector('text[data-live-text="service"]');
            rows.push({recipe,cap,text,requested:run.preferredCap,resolved:run.cap,depth:run.tab.depth,halfSpan:run.tab.halfSpan,status:run.tab.status,
              actualWidth:t.getComputedTextLength(),available:run.available,preserved:t.textContent===text,
              finite:!/(NaN|Infinity)/.test(BCLogo.serialise(r)),noStretch:!r.svg.querySelector('[textLength],[lengthAdjust],[data-character-index]')});r.svg.remove();
          }return rows;
        }''')
        record('48 upper/lower cap-height and wording cases fit measured browser advance',all(r['actualWidth']<=r['available']+.5 and r['preserved'] and r['finite'] and r['noStretch'] for r in data),data)
        growth=page.evaluate('''()=>['long-wildfire','wildfire-management'].map(recipe=>{
          const get=cap=>{const s=BCLogo.recipeState(recipe);s.tabSizing='follow-text';s.content.service='SERVICE';s.slots[BCPrimitives.TABS[s.tab].slot]={cap};return BCLogo.makeLogo(s).report.find(x=>x.tab);};
          const a=get(30),b=get(60),c=get(30);return{recipe,a:a.tab.depth,b:b.tab.depth,fullSize:b.cap===60,reset:JSON.stringify(a)===JSON.stringify(c)};
        })''')
        record('Both holders grow in depth and return deterministically after shrinking',all(r['b']>r['a'] and r['fullSize'] and r['reset'] for r in growth),growth)
        length=page.evaluate('''()=>['long-wildfire','wildfire-management'].map(recipe=>{
          const run=text=>{const s=BCLogo.recipeState(recipe);s.tabSizing='follow-text';s.content.service=text;return BCLogo.makeLogo(s).report.find(x=>x.tab);};
          const a=run('SERVICE'),b=run('WILDFIRE MANAGEMENT'),c=run('W'.repeat(320));return{recipe,short:a.tab,long:b.tab,stress:c.tab,stressCap:c.cap,stressPreferred:c.preferredCap,stressFit:c.width<=c.available,stressWarning:c.tooSmall};})''')
        record('Long wording grows span; extreme wording reports reduction without glyph stretching',all(r['long']['halfSpan']>r['short']['halfSpan'] and r['stress']['halfSpan']<=80 and r['stress']['status']=='text-reduced' and r['stressFit'] and r['stressWarning'] for r in length),length)
        empty=page.evaluate('''()=>['','   '].map(text=>{const s=BCLogo.recipeState('long-wildfire');s.tabSizing='follow-text';s.content.service=text;const r=BCLogo.makeLogo(s);return !r.svg.querySelector('text[data-live-text="service"]')&&!/(NaN|Infinity)/.test(BCLogo.serialise(r));})''')
        record('Empty and whitespace labels have a finite holder and no phantom text',all(empty))
        independence=page.evaluate('''()=>{const s=BCLogo.recipeState('long-wildfire');s.tabSizing='follow-text';const a=BCLogo.makeLogo(s,{prefix:'fixed'});s.roles['service-heavy']={capScale:1.4};const b=BCLogo.makeLogo(s,{prefix:'fixed'});const rest=r=>r.report.filter(x=>!x.tab);const scene=r=>r.svg.querySelector('defs [data-primitive="scene-wildlife"]').innerHTML;return {reports:JSON.stringify(rest(a))===JSON.stringify(rest(b)),scene:scene(a)===scene(b)};}''')
        record('Changing service typography leaves crest lettering and source scene unchanged',all(independence.values()),independence)
        roundtrip=page.evaluate('''()=>{const s=BCLogo.recipeState('wildfire-management');s.tabSizing='follow-text';s.roles['service-condensed']={capScale:1.2,trackingEm:.03};const a=BCLogo.makeLogo(s),b=BCLogo.makeLogo(JSON.parse(JSON.stringify(a.state)));return JSON.stringify(a.report)===JSON.stringify(b.report)&&BCLogo.recipeState('long-wildfire',a.state).tabSizing==='follow-text';}''')
        record('Configuration round trip and recipe inheritance preserve reactive mode',roundtrip)
        # Independent rendered-ink containment: remove other layers and compare two raster masks.
        mask=page.evaluate('''async()=>{
          const read=async blob=>{const url=URL.createObjectURL(blob);try{const image=new Image();await new Promise((ok,no)=>{image.onload=ok;image.onerror=no;image.src=url});const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data;}finally{URL.revokeObjectURL(url)}};
          const rows=[];
          for(const recipe of ['long-wildfire','wildfire-management'])for(const cap of [24,48,80,100])for(const text of ['WILDFIRE SERVICE','Écologie & pêches','Agj ÅÉ']){
            const s=BCLogo.recipeState(recipe);s.tabSizing='follow-text';s.content.service=text;s.slots[BCPrimitives.TABS[s.tab].slot]={cap};const r=BCLogo.makeLogo(s),face=r.svg.cloneNode(true),ink=r.svg.cloneNode(true);
            const p=face.querySelector('[data-tab-part="face"]').cloneNode(true);p.setAttribute('fill','#ffffff');face.querySelector('[data-layer="composition"]').replaceChildren(p);
            const t=ink.querySelector('text[data-live-text="service"]').cloneNode(true);t.setAttribute('fill','#000000');ink.querySelector('[data-layer="composition"]').replaceChildren(t);
            const a=await read(await BCLogo.png({...r,svg:face},1000)),b=await read(await BCLogo.png({...r,svg:ink},1000));
            let total=0,outside=0;for(let i=0;i<b.length;i+=4)if(b[i+3]>128){total++;if(a[i+3]<128)outside++;}
            rows.push({recipe,cap,text,solidPixels:total,outsidePixels:outside});
          }return rows;
        }''')
        record('24 independent pixel-mask checks keep actual glyph ink inside the holder face',all(r['solidPixels']>0 and r['outsidePixels']==0 for r in mask),mask)
        # Actual source event handlers run against fixture DOM or the real studio DOM.
        # The real studio collapses some control panels; open them as a user would.
        page.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
        page.select_option('#tabSizing','follow-text');page.wait_for_function("BCStudio.current.state.tabSizing==='follow-text'")
        page.select_option('#typeSlot','service-bottom');page.locator('#slotCap').fill('64');page.wait_for_function("BCStudio.current.state.slots['service-bottom']?.cap===64")
        record('Cap height updates before blur via an input event',page.evaluate("document.activeElement.id==='slotCap'&&BCStudio.current.report.find(r=>r.tab).preferredCap===64"))
        record('Derived ribbon baseline radii are disabled in reactive mode',page.locator('#slotRX').is_disabled() and page.locator('#slotRY').is_disabled())
        page.locator('#slotCap').fill('');page.wait_for_timeout(200)
        record('Temporary empty number input does not overwrite the last valid size',page.evaluate("BCStudio.state.slots['service-bottom'].cap===64"))
        page.locator('#resetSlot').click();page.wait_for_function("!BCStudio.current.state.slots['service-bottom']")
        record('Slot reset removes the override and restores default cap height',page.evaluate("BCStudio.current.report.find(r=>r.tab).preferredCap===BCPrimitives.SLOTS['service-bottom'].cap"))
        page.select_option('#typeRole','service-heavy');page.locator('#roleCap').fill('1.15');page.wait_for_function("BCStudio.current.state.roles['service-heavy']?.capScale===1.15")
        record('Role multiplier updates reactively without a change event',page.evaluate("document.activeElement.id==='roleCap'"))
        page.evaluate('''()=>{window.originalRender=BCLogo.render;BCLogo.render=async(s,o)=>{const r=await originalRender(s,o);if(s.roles['service-heavy']?.capScale===1.05)await new Promise(ok=>window.releaseOld=ok);return r;};}''')
        page.locator('#roleCap').fill('1.05');page.wait_for_function("typeof window.releaseOld==='function'")
        page.locator('#roleCap').fill('1.25');page.evaluate('window.releaseOld()');page.wait_for_function("BCStudio.current.state.roles['service-heavy']?.capScale===1.25")
        record('A delayed old render cannot overwrite a newer input during debounce',page.evaluate("BCStudio.state.roles['service-heavy'].capScale===1.25"))
        page.evaluate('()=>{BCLogo.render=window.originalRender;}')
        page.locator('[data-mode="guides"]').click()
        record('Rules overlay uses the exact resolved tab baseline',page.evaluate('''()=>{const d=BCStudio.current.svg.querySelector('path[data-baseline="service-bottom"]').getAttribute('d');return [...document.querySelectorAll('#guidesPreview path')].some(p=>p.getAttribute('d')===d);}'''))
        page.locator('[data-mode="design"]').click()
        # Export flushes a still-debounced input and uses the same layout as the preview.
        page.locator('#roleCap').fill('1.35')
        with page.expect_download() as d:
            page.locator('#exportSVG').click()
        svg_path=out/'reactive-export.svg';d.value.save_as(svg_path)
        export=svg_path.read_text()
        import xml.etree.ElementTree as ET
        doc=ET.fromstring(export);ns={'s':'http://www.w3.org/2000/svg'}
        meta=json.loads(doc.find('s:metadata',ns).text)
        record('SVG export flushes pending edits and matches the visible resolved result',meta['configuration']['roles']['service-heavy']['capScale']==1.35 and meta['resolved']==page.evaluate('BCStudio.current.report'))
        record('SVG retains editable text and contains no embedded font files',bool(doc.findall('.//s:textPath',ns)) and all(x not in export for x in ['data:font','data:application/font','textLength=','lengthAdjust=']))
        with page.expect_download() as d:
            page.locator('#exportPNG').click()
        png_path=out/'reactive-export.png';d.value.save_as(png_path)
        record('PNG export produces a real image',png_path.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n',{'bytes':png_path.stat().st_size})
        with page.expect_download() as d:
            page.locator('#exportFamily').click()
        zip_path=out/'family.zip';d.value.save_as(zip_path)
        import zipfile
        with zipfile.ZipFile(zip_path) as z:
            rules=json.loads(z.read('shared-rules.json'))
            family_meta=json.loads(ET.fromstring(z.read('wildfire-management.svg')).find('s:metadata',ns).text)
            record('Family export propagates reactive mode and excludes Fire Control',rules['tabSizing']=='follow-text' and family_meta['configuration']['tabSizing']=='follow-text' and 'fire-control.svg' not in z.namelist())
        layouts=page.evaluate('''()=>Object.keys(BCPrimitives.LOCKUPS).map(layout=>{const s=BCLogo.recipeState('bcts-tree');s.tab='wildfire-bottom';s.tabSizing='follow-text';s.layout=layout;s.content.service='WILDFIRE SERVICE';s.content.lines='BC\\nTimber\\nSales';s.content.branch='EXAMPLE BRANCH';const r=BCLogo.makeLogo(s);return{layout,finite:r.viewBox.w>0&&r.viewBox.h>0&&!/(NaN|Infinity)/.test(BCLogo.serialise(r))};})''')
        record('All seven composition types produce finite bounds in reactive mode',all(r['finite'] for r in layouts),layouts)
        page.screenshot(path=str(out/'fixture-desktop.png'),full_page=True)
        record('Excluded reference remains outside the selectable family',page.locator('#recipe option[value="fire-control"]').count()==0)
        record('No uncaught browser errors',not errors,errors)
        browser.close()
    summary={'scope':'isolated source-module tests; fixture DOM and artwork' if args.isolated else 'actual built studio with repository artwork',
             'browser':'Chromium via Playwright','tests':len(results),'passed':sum(r['passed'] for r in results),
             'failed':sum(not r['passed'] for r in results),'fonts':fonts,'results':results}
    (out/'results.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False))
    print(json.dumps({k:v for k,v in summary.items() if k!='results'},indent=2))
    return 1 if summary['failed'] else 0

if __name__=='__main__':
    sys.exit(main())
