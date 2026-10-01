#!/usr/bin/env python3
"""Smoke test of the standalone live lettering app (the package on its own page).

The full editor behaviour is covered by site/tests/test_live_lettering.py, which
mounts the same package inside the viewer. This checks that the package works
without the viewer: engine, bundled faces, the badge presets and exports.

  npm run dev -w @forestoval/live-lettering   # or the built site's lettering/
  python3 tests/test_standalone.py --url http://localhost:5174/
"""
from __future__ import annotations
import argparse, os, shutil
from playwright.sync_api import sync_playwright

def main():
 ap=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
 ap.add_argument('--url',default='http://localhost:5174/')
 a=ap.parse_args();results=[]
 def record(name,passed,detail=None):
  results.append(passed);print(('PASS ' if passed else 'FAIL ')+name+('' if passed or detail is None else f' · {detail}'),flush=True)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM') or shutil.which('chromium'),args=['--no-sandbox'])
  page=browser.new_context(viewport={'width':1400,'height':1000},accept_downloads=True).new_page()
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(a.url);root=page.locator('.fo-editor')
  def wait():page.wait_for_function('''()=>{const b=document.querySelector('.fo-editor [data-action="svg"]');return b&&!b.disabled}''',timeout=30000)
  wait()
  presets=root.locator('[data-control="recipe"] option').evaluate_all('(es)=>es.map(e=>e.value)')
  record('The editor starts on its own page with the recipes and badge presets',len(presets)>10 and presets.index('airtanker-package')==presets.index('airtanker')+1,presets)
  faces=page.evaluate("()=>[...BCLogo.fontState.values()].filter(f=>f.face!=='kabel-black').map(f=>f.source)")
  record('Faces load from the package bundle',faces and all(f=='bundled' for f in faces),faces)
  root.get_by_role('button',name='Airtanker Operations · package',exact=True).click();wait()
  root.get_by_role('button',name='Reset this preset',exact=True).click();wait()
  svg=root.locator('[data-part="canvas"] > svg')
  runs=root.locator('[data-part="canvas"] text[data-live-text]').evaluate_all('(ts)=>ts.map(t=>t.dataset.liveText)')
  record('The airtanker badge draws from the package with three live runs',svg.get_attribute('data-composition')=='airtanker-package' and sorted(runs)==['lower','service','upper'] and root.locator('[data-warning]').count()==0,runs)
  root.locator('[data-part="fields"] [data-content="service"]').fill('TANKER BASE');wait()
  record('Editing the band words redraws them',root.locator('[data-part="canvas"] [data-live-text="service"]').text_content()=='TANKER BASE')
  with page.expect_download() as dl:root.get_by_role('button',name='SVG',exact=True).click()
  out=dl.value.path().read_text()
  record('SVG export is the composed badge',dl.value.suggested_filename=='airtanker-package-editable.svg' and 'TANKER BASE' in out and 'data-composition="airtanker-package"' in out)
  root.get_by_role('button',name='Reset this preset',exact=True).click();wait()
  record('No uncaught browser exceptions',not errors,errors)
  browser.close()
 if not all(results):raise SystemExit(1)

if __name__=='__main__':main()
