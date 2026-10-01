#!/usr/bin/env python3
"""Regression tests for opt-in lettering-fit policies in the v5 studio.

Default: build and exercise the production standalone studio in a full checkout.
--isolated: exercise actual source modules in the existing minimal studio fixture.
--art: optionally inject repository artwork into that isolated fixture.
No network fonts are requested; missing named faces fail the font prerequisite.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import zipfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
POLICIES = ['legacy', 'reference-locked', 'reference-calibrated', 'style-preserving']


def module_at(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Cannot import {path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def isolated_html(root: Path, art: Path | None) -> str:
    fixture = module_at('reactive_fixture', ROOT / 'tests/test_reactive_tabs.py')
    html = fixture.fixture(root)
    if art:
        # Inject before the engine captures ART, without altering the source modules.
        marker = '<script>/* Browser SVG engine.'
        if html.count(marker) != 1:
            raise RuntimeError('Cannot locate engine entry point in isolated fixture')
        data = json.dumps(json.loads(art.read_text(encoding='utf-8'))).replace('</', '<\\/')
        html = html.replace(marker, '<script>window.BC_ART=' + data + ';</script>' + marker, 1)
    return html


SNAPSHOTS = """() => BCPrimitives.RECIPES.filter(r=>!r.excluded).flatMap(rec=>
 ['reference','follow-text'].map(tabSizing=>{
  const state=BCLogo.recipeState(rec.id);state.tabSizing=tabSizing;
  const r=BCLogo.makeLogo(state,{prefix:'compat'});r.svg.querySelector('metadata').remove();
  return {recipe:rec.id,tabSizing,svg:BCLogo.serialise(r),report:r.report,warnings:r.warnings};
 }))"""


SCALE_CASES = """() => {
 const results=[];
 for(const rec of BCPrimitives.RECIPES.filter(r=>!r.excluded)){
  for(const text of [null,'PARKS','NATURAL RESOURCES','Écologie, pêches & office – Ågyp']){
   for(const policy of ['reference-locked','style-preserving']){
    for(const outputWidth of [100,500,1200,6000]){
     const state=BCLogo.recipeState(rec.id);state.textFit=policy;state.outputWidth=outputWidth;
     if(text!==null){state.content.lower=text;state.content.service=text;}
     const r=BCLogo.makeLogo(state);document.body.append(r.svg);
     const actual=[...r.svg.querySelectorAll('text[data-slot]')].map(el=>{
      const fit=r.report.find(x=>x.slot===el.dataset.slot);
      return {slot:fit.slot,width:fit.width,actual:el.getComputedTextLength(),
       available:fit.available,cap:fit.cap,span:fit.curve.span,stylePreserved:fit.stylePreserved,
       text:el.textContent,textLength:el.hasAttribute('textLength'),
       children:el.children.length,rendering:el.getAttribute('text-rendering')};
     });
     results.push({recipe:rec.id,text,policy,outputWidth,runs:actual});r.svg.remove();
    }
   }
  }
 }
 return results;
}"""


MASK_CASES = """async () => {
 const pixels=async blob=>{
  const url=URL.createObjectURL(blob);
  try{
   const image=new Image();await new Promise((ok,no)=>{image.onload=ok;image.onerror=no;image.src=url});
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   return ctx.getImageData(0,0,canvas.width,canvas.height).data;
  }finally{URL.revokeObjectURL(url)}
 };
 const cases=[];
 for(const recipe of ['forests','long-ministry']){
  const names=recipe==='forests'?['FORESTS','NATURAL RESOURCES','NATURAL RESOURCE OPERATIONS']:
   ['Forests, Lands and Natural Resource Operations','Environmental Monitoring and Conservation'];
  for(const mode of ['legacy','reference-locked','style-preserving'])for(const text of names){
   const state=BCLogo.recipeState(recipe);state.textFit=mode;state.content.lower=text;state.theme='mono';
   const r=BCLogo.makeLogo(state),mask=r.svg.cloneNode(true),ink=r.svg.cloneNode(true),v=r.viewBox;
   const bg=BCLogo.node('rect',{x:v.x,y:v.y,width:v.w,height:v.h,fill:'#000000'});
   const frame=mask.querySelector('[data-layer="frame"]').cloneNode(true);
   const dots=mask.querySelector('[data-layer="separators"]').cloneNode(true);
   mask.querySelector('[data-layer="composition"]').replaceChildren(bg,frame,dots);
   const letters=ink.querySelector('[data-layer="live-lettering"]').cloneNode(true);
   ink.querySelector('[data-layer="composition"]').replaceChildren(letters);
   const a=await pixels(await BCLogo.png({...r,svg:mask},1000));
   const b=await pixels(await BCLogo.png({...r,svg:ink},1000));let total=0,outside=0;
   for(let i=0;i<b.length;i+=4)if(b[i+3]>128){total++;if(a[i]<200)outside++}
   cases.push({recipe,mode,text,total,outside});
  }
 }
 return cases;
}"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--isolated', action='store_true')
    ap.add_argument('--art', type=Path, help='Actual art.json; isolated mode only')
    ap.add_argument('--baseline-dir', type=Path, help='Unmodified v5 studio directory; isolated mode only')
    ap.add_argument('--out', type=Path, default=ROOT / 'tests/output/text-fit')
    args = ap.parse_args()
    if (args.art or args.baseline_dir) and not args.isolated:
        ap.error('--art and --baseline-dir require --isolated')
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    if args.isolated:
        html = isolated_html(ROOT, args.art)
    else:
        build = module_at('production_build', ROOT / 'build.py')
        html = build.build(out / 'studio.html').read_text(encoding='utf-8')
    (out / 'studio.html').write_text(html, encoding='utf-8')
    results = []

    def record(name: str, passed: bool, details=None):
        results.append({'name': name, 'passed': bool(passed), 'details': details})
        print(('PASS ' if passed else 'FAIL ') + name, flush=True)

    with sync_playwright() as pw:
        executable = os.environ.get('CHROMIUM') or (
            '/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
        browser = pw.chromium.launch(
            **({'executable_path': executable} if executable else {}), args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1400, 'height': 1100}, accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        if args.isolated:
            # Opaque-origin fixtures cannot use native localStorage. Keep this
            # explicit: production mode below tests actual browser persistence.
            page.evaluate("""() => {window.__storageFixture={};Object.defineProperty(window,'localStorage',
             {value:{getItem:k=>window.__storageFixture[k]??null,
                     setItem:(k,v)=>{window.__storageFixture[k]=String(v)}}});}""")
            page.set_content(html)
        else:
            page.goto((out / 'studio.html').as_uri())
        page.wait_for_function('window.BCStudio?.current', timeout=30000)
        fonts = page.evaluate("""() => [...BCLogo.fontState].map(([id,s])=>
            ({id,status:s.status,source:s.source,weight:s.weight}))""")
        record('Named default faces loaded locally at requested weights',
               bool(fonts) and all(f['status'] == 'ready' for f in fonts), fonts)
        config = page.evaluate("""() => {
         const E=BCLogo;let rejected=0;
         for(const textFit of ['bad','toString','__proto__',42,['legacy'],{toString:()=> 'legacy'}]){
          try{E.normalise({textFit})}catch{rejected++}
         }
         const policies=Object.keys(E.TEXT_FIT_POLICIES);
         return {legacy:E.normalise({version:5}).textFit,rejected,policies,
          shared:policies.map(textFit=>E.recipeState('long-wildfire',{textFit}).textFit),
          roundtrip:policies.map(textFit=>E.normalise(JSON.parse(JSON.stringify(E.normalise({textFit})))).textFit)};
        }""")
        record('Policy defaults, validation, recipe inheritance and config roundtrip',
               config == {'legacy': 'legacy', 'rejected': 6, 'policies': POLICIES,
                          'shared': POLICIES, 'roundtrip': POLICIES}, config)
        rows = page.evaluate("""() => {
         const rows=[];
         for(const text of ['FORESTS','PARKS','CONSERVATION','NATURAL RESOURCES',
          'NATURAL RESOURCE OPERATIONS','W'.repeat(320),'','  ', 'E\\u0301cologie & office']){
          for(const policy of Object.keys(BCLogo.TEXT_FIT_POLICIES)){
           const s=BCLogo.recipeState('forests');s.textFit=policy;s.content.lower=text;
           const r=BCLogo.makeLogo(s),f=BCLogo.fitRun(s.content.lower,'wildlife-lower',s);
           rows.push({text,policy,fit:f,warnings:r.warnings.map(w=>w.code)});
          }
         }return rows;
        }""")
        (out / 'wording-cases.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
        def row(text, policy):
            return next(r for r in rows if r['text'] == text and r['policy'] == policy)
        short = [row(t, p)['fit'] for t in ['FORESTS', 'PARKS'] for p in POLICIES[1:]]
        record('Short wording is neither spread nor enlarged', all(
            f['stylePreserved'] and f['adjustments'] == [] and f['curve']['span'] == 116 for f in short))
        preferred = row('NATURAL RESOURCES', 'style-preserving')['fit']
        old = row('NATURAL RESOURCES', 'legacy')['fit']
        record('NATURAL RESOURCES keeps cap and tracking by expanding first',
               preferred['stylePreserved'] and preferred['adjustments'] == ['arc-expanded']
               and preferred['cap'] == old['cap'] and preferred['trackingEm'] > old['trackingEm']
               and 116 < preferred['curve']['span'] <= 165, {'legacy': old, 'style': preferred})
        locked = [r['fit'] for r in rows if r['policy'] == 'reference-locked']
        record('Reference-locked policy never expands the configured angular span',
               all(f['curve']['span'] == 116 and 'arc-expanded' not in f['adjustments'] for f in locked))
        reduced = row('NATURAL RESOURCE OPERATIONS', 'style-preserving')
        extreme = row('W' * 320, 'style-preserving')
        record('Long wording compromises in order and reports the limitation',
               reduced['fit']['adjustments'] == ['arc-expanded', 'tracking', 'uniform-shrink']
               and 'TEXT_STYLE_REDUCED' in reduced['warnings']
               and 'SMALL_TEXT' in extreme['warnings'] and extreme['fit']['overflow'] <= .05)
        edge_cases = page.evaluate("""() => {
         const s=BCLogo.recipeState('forests');s.textFit='style-preserving';
         s.slots['wildlife-lower']={tracking:0};
         const low=BCLogo.fitRun('NATURAL RESOURCES','wildlife-lower',s);
         const flat=BCLogo.fitRun('PARKS','plate-label',s);
         const before=BCLogo.fitRun('NATURAL RESOURCES','wildlife-lower',s);
         BCLogo.invalidateMetrics();const after=BCLogo.fitRun('NATURAL RESOURCES','wildlife-lower',s);
         return {low,flat,repeat:JSON.stringify(before)===JSON.stringify(after),
          leftover:document.querySelectorAll('[id^="bc-advance-"]').length};
        }""")
        record('Zero tracking is not raised to the profile floor',
               edge_cases['low']['trackingEm'] == 0 and edge_cases['low']['minimumTrackingEm'] == 0)
        record('Flat slots keep a straight baseline', edge_cases['flat']['curve']['span'] == 0)
        record('Measurement invalidation is deterministic and probes leave no DOM nodes',
               edge_cases['repeat'] and edge_cases['leftover'] == 0)

        scale = page.evaluate(SCALE_CASES)
        (out / 'scale-cases.json').write_text(json.dumps(scale, indent=2), encoding='utf-8')
        runs = [run for case in scale for run in case['runs']]
        bad = [dict(case=case, bad=run) for case in scale for run in case['runs']
               if abs(run['actual'] - run['width']) > .1 or run['actual'] > run['available'] + .1]
        record('Final-size textPath measurement agrees across recipes and four output sizes',
               bool(runs) and not bad, {'compositions': len(scale), 'runs': len(runs),
                                        'max_error': max(abs(r['actual']-r['width']) for r in runs),
                                        'failures': bad[:10]})
        record('Live phrases stay one textPath without glyph stretching', all(
            r['children'] == 1 and not r['textLength'] and r['rendering'] == 'geometricPrecision'
            for r in runs))
        record('Finite adaptive metrics for empty, accented and extreme strings', all(
            all(isinstance(r['fit'][k], (int, float)) and abs(r['fit'][k]) < 1e7
                for k in ['cap', 'size', 'tracking', 'width', 'available']) for r in rows))
        if args.baseline_dir:
            base_html = isolated_html(args.baseline_dir.resolve(), args.art)
            base_path = out / 'baseline-fixture.html'
            base_path.write_text(base_html, encoding='utf-8')
            baseline = context.new_page()
            baseline.set_content(base_html)
            baseline.wait_for_function('window.BCStudio?.current')
            before, after = baseline.evaluate(SNAPSHOTS), page.evaluate(SNAPSHOTS)
            differences = [{'recipe': a['recipe'], 'tabSizing': a['tabSizing']}
                           for a, b in zip(before, after) if a != b]
            record('Legacy geometry, reports and warnings match unmodified source',
                   len(before) == len(after) == 28 and not differences,
                   {'comparisons': len(before), 'differences': differences,
                    'metadata': 'Excluded: new configuration field is intentional'})
            baseline.close()
        if not args.isolated or args.art:
            masks = page.evaluate(MASK_CASES)
            (out / 'band-containment.json').write_text(json.dumps(masks, indent=2), encoding='utf-8')
            record('Wildlife-band raster checks exclude borders and separators',
                   all(r['total'] > 0 and r['outside'] == 0 for r in masks), masks)

        # Exercise real studio listeners and exports, not a parallel test UI.
        page.select_option('#recipe', 'forests')
        page.select_option('#textFit', 'style-preserving')
        page.fill('#content-lower', 'NATURAL RESOURCES')
        page.wait_for_function("""BCStudio.current?.state.textFit==='style-preserving' &&
            BCStudio.current?.state.content.lower==='NATURAL RESOURCES'""")
        ui = page.evaluate("""() => ({state:BCStudio.state.textFit,
          report:BCStudio.current.report.find(r=>r.slot==='wildlife-lower'),
          metrics:document.querySelector('#metricsBody').textContent})""")
        record('Studio selector and live wording use the new solver and diagnostics',
               ui['state'] == 'style-preserving' and ui['report']['stylePreserved']
               and 'Tracking 0.1415 em' in ui['metrics'], ui)
        if args.isolated:
            saved = page.evaluate('window.__storageFixture')
            page.close()
            page = context.new_page()
            page.on('pageerror', lambda exc: errors.append(str(exc)))
            page.evaluate("""saved => {window.__storageFixture=saved;Object.defineProperty(window,'localStorage',
             {value:{getItem:k=>window.__storageFixture[k]??null,
                     setItem:(k,v)=>{window.__storageFixture[k]=String(v)}}});}""", saved)
            page.set_content(html)
        else:
            page.reload()
        page.wait_for_function("BCStudio.current?.state.textFit==='style-preserving'")
        record('Selected policy and wording survive ' + ('fixture-storage roundtrip' if args.isolated else 'native local reload'),
               page.locator('#content-lower').input_value() == 'NATURAL RESOURCES')
        with page.expect_download() as download:
            page.click('#exportConfig')
        config_path = download.value.path()
        exported = json.loads(Path(config_path).read_text())
        record('Configuration download includes selected fit policy',
               exported.get('textFit') == 'style-preserving')
        with page.expect_download() as download:
            page.click('#exportSVG')
        svg = Path(download.value.path()).read_text()
        record('SVG export keeps policy metadata, editable text and measurement rendering',
               'style-preserving' in svg and 'geometricPrecision' in svg
               and 'NATURAL RESOURCES' in svg and 'textLength=' not in svg)
        with page.expect_download() as download:
            page.click('#exportFamily')
        family = Path(download.value.path()).read_bytes()
        with zipfile.ZipFile(io.BytesIO(family)) as archive:
            rules = json.loads(archive.read('shared-rules.json'))
            names = archive.namelist()
            family_svg = [archive.read(n).decode() for n in names if n.endswith('.svg')]
        record('Family export propagates policy to shared rules and every recipe',
               rules.get('textFit') == 'style-preserving' and len(family_svg) == 14
               and all('style-preserving' in s for s in family_svg)
               and not any(n.lower().endswith(('.ttf', '.otf', '.woff', '.woff2')) for n in names))
        imported = out / 'import.json'
        exported['textFit'] = 'reference-locked'
        imported.write_text(json.dumps(exported))
        page.set_input_files('#configFile', str(imported))
        page.wait_for_function("BCStudio.current?.state.textFit==='reference-locked'")
        record('Import updates both the selector and rendered result',
               page.locator('#textFit').input_value() == 'reference-locked')
        page.select_option('#recipe', 'long-wildfire')
        page.select_option('#tabSizing', 'follow-text')
        page.select_option('#textFit', 'style-preserving')
        page.wait_for_function("BCStudio.current?.state.tabSizing==='follow-text' && BCStudio.current?.state.textFit==='style-preserving'")
        reactive = page.evaluate("""() => BCStudio.current.report.map(r=>
           ({slot:r.slot,policy:r.fitPolicy||null,tab:r.tab?.mode||null}))""")
        record('Reactive service tabs keep their independent solver',
               any(r['tab'] == 'follow-text' and r['policy'] is None for r in reactive)
               and any(r['policy'] == 'style-preserving' for r in reactive), reactive)
        page.select_option('#recipe', 'bcts-wordmark')
        record('Wordmark-only composition hides the inapplicable policy control',
               not page.locator('#textFit').is_visible())
        record('No uncaught browser errors', not errors, errors)
        report = {
            'scope': ('Isolated source modules and minimal DOM shell; ' +
                      ('actual recovered artwork' if args.art else 'dummy artwork'))
                     if args.isolated else 'Full standalone studio build',
            'browser': browser.version, 'network_fonts_requested': False,
            'storage_test': 'Explicit in-memory localStorage fixture' if args.isolated else 'Native localStorage',
            'source_sha256': {name: hashlib.sha256((ROOT / 'src' / name).read_bytes()).hexdigest()
                              for name in ['engine.js', 'studio.js', 'primitives.js']},
            'passed': sum(r['passed'] for r in results), 'total': len(results), 'results': results,
            'limitations': ['Chromium only; other browsers and vector editors not verified',
                            'Raster checks cover selected wildlife-band strings, not all possible edits',
                            'These tests do not authenticate the original reference typefaces'],
        }
        (out / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        browser.close()
    print(f"{report['passed']}/{report['total']} checks passed; {out / 'report.json'}")
    return 0 if all(r['passed'] for r in results) else 1


if __name__ == '__main__':
    sys.exit(main())
