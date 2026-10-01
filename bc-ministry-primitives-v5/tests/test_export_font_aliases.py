#!/usr/bin/env python3
"""Reopen editable exports without inheriting the editor's FontFace aliases.
Requires the exact local recipe fonts; does not download or embed font files.
Uses the actual standalone builder; all assertions run in Chromium documents.
"""
from pathlib import Path
import argparse, importlib.util, json, os, shutil
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--out', type=Path, default=ROOT/'tests/output/export-font-aliases')
    args = ap.parse_args(); out = args.out.resolve(); out.mkdir(parents=True, exist_ok=True)
    spec = importlib.util.spec_from_file_location('studio_build', ROOT/'build.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    html = module.build(out/'studio.html').read_text()
    results=[]; measurements=[]
    def record(name, passed, details=None):
        results.append({'name':name,'passed':bool(passed),'details':details})
        print(('PASS ' if passed else 'FAIL ')+name, flush=True)
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM') or shutil.which('chromium'),args=['--no-sandbox'])
        page=browser.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html);page.wait_for_function('window.BCStudio?.current')
        faces=page.evaluate("async()=> (await BCLogo.ensureFonts(['noto-condensed','open-heavy'],false)).map(f=>({face:f.face,status:f.status}))")
        record('Exact local calibration faces are ready',all(f['status']=='ready' for f in faces),faces)
        if not all(f['status']=='ready' for f in faces):raise RuntimeError('Install the named local faces before testing export fidelity.')
        for recipe in ['forests','forests-wildfire','long-ministry','long-wildfire']:
            data=page.evaluate('''async recipe=>{
                const r=await BCLogo.render({recipe,textFit:'reference-calibrated',autoProfile:false});
                const original=new XMLSerializer().serializeToString(r.svg),svg=BCLogo.serialise(r);
                return{svg,report:r.report,untouched:original===new XMLSerializer().serializeToString(r.svg),
                    rawUnchanged:!BCLogo.serialise(r.svg).includes('data-export-fonts'),
                    text:[...r.svg.querySelectorAll('text[data-live-text]')].map(t=>t.textContent)};
            }''',recipe)
            (out/f'{recipe}.svg').write_text(data['svg'])
            record(recipe+': export does not mutate the live result or raw SVG serialization',data['untouched'] and data['rawUnchanged'])
            record(recipe+': aliases reference local faces without embedded fonts or remote font URLs',
                   'data-export-fonts="local-aliases"' in data['svg'] and 'src:local(' in data['svg'] and 'data:font' not in data['svg'] and '@import' not in data['svg'] and 'url(data:' not in data['svg'])
            context=browser.new_context(); fresh=context.new_page(); fresh.on('pageerror',lambda e:errors.append(str(e)))
            fresh.set_content('<!doctype html><html><body>'+data['svg']+'</body></html>');fresh.evaluate('document.fonts.ready')
            actual=fresh.evaluate("()=>[...document.querySelectorAll('text[data-live-text]')].map(t=>({text:t.textContent,width:t.getComputedTextLength(),paths:t.querySelectorAll('textPath').length}))")
            diffs=[abs(r['width']-a['width']) for r,a in zip(data['report'],actual)]
            record(recipe+': fresh-document advances match the fitted preview',len(actual)==len(data['report']) and max(diffs,default=0)<.1,{'maxError':max(diffs,default=0),'errors':diffs})
            record(recipe+': all inscriptions remain editable single textPath runs',[a['text'] for a in actual]==data['text'] and all(a['paths']==1 for a in actual))
            measurements.append({'recipe':recipe,'reported':[r['width'] for r in data['report']],'reopened':[a['width'] for a in actual]});context.close()
        record('No uncaught browser errors',not errors,errors)
        version=browser.version;browser.close()
    report={'scope':'Actual builder; fresh Chromium documents; exact locally installed fonts','browser':version,'checks':results,'measurements':measurements,'passed':sum(r['passed'] for r in results),'total':len(results)}
    (out/'report.json').write_text(json.dumps(report,indent=2));print(f"{report['passed']}/{report['total']} passed")
    return 0 if all(r['passed'] for r in results) else 1
if __name__=='__main__':raise SystemExit(main())
