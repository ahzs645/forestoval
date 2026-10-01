#!/usr/bin/env python3
"""UI regression test. Default: the real Vite app at --url.

--html runs the actual DOM controller/engine in a supplied standalone fixture;
it does NOT test the React wrapper, Vite build, native localStorage, or deployment.
The optional fixture uses an explicitly in-memory Storage implementation.
"""
from __future__ import annotations
import argparse, json, os, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

STORAGE = '''<script>window.__TEST_STORAGE__=new class {
 constructor(){this.map=new Map()} get length(){return this.map.size}
 key(n){return [...this.map.keys()][n]??null} getItem(k){return this.map.get(k)??null}
 setItem(k,v){this.map.set(k,String(v))} removeItem(k){this.map.delete(k)} clear(){this.map.clear()}
};</script>'''

def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--url',default='http://localhost:5173/#/compose')
 ap.add_argument('--html',type=Path)
 ap.add_argument('--out',type=Path,default=Path('tests/output/live-lettering'))
 a=ap.parse_args();out=a.out.resolve();out.mkdir(parents=True,exist_ok=True)
 results=[]
 def record(name,passed,detail=None):
  row={'name':name,'passed':bool(passed),'detail':detail};results.append(row)
  print(('PASS ' if passed else 'FAIL ')+name,flush=True)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM') or shutil.which('chromium'),args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1500,'height':1180},accept_downloads=True)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  if a.html:page.set_content(a.html.read_text().replace('<head>','<head>'+STORAGE,1))
  else:page.goto(a.url);page.get_by_role('button',name='Live lettering',exact=True).click()
  root=page.locator('.fo-editor')
  def wait():
   page.wait_for_function('''()=>{const b=document.querySelector('.fo-editor [data-action="svg"]');return b&&!b.disabled}''',timeout=30000)
  def field(key):return root.locator(f'[data-part="fields"] [data-content="{key}"]')
  def text(key):return root.locator(f'[data-part="canvas"] [data-live-text="{key}"]')
  def pick(id):root.get_by_label('Current preset',exact=True).select_option(id);wait()
  def crest():return root.locator('[data-part="canvas"] [data-layer="badge"]').get_attribute('data-crest')
  def dots():
   g=root.locator('[data-part="canvas"] [data-layer="separators"]')
   return {'placement':g.get_attribute('data-separator-placement'),'y':float(g.get_attribute('data-separator-y'))}
  def gaps():return root.locator('[data-part="canvas"] [data-layer="separators"] > *').evaluate_all('(cs)=>cs.map(c=>[+c.getAttribute("data-clearance-upper"),+c.getAttribute("data-clearance-lower")])')
  def upper_size():return float(text('upper').get_attribute('font-size'))
  def resolved(slot):
   meta=json.loads(root.locator('[data-part="canvas"] svg metadata').text_content())
   return next(r for r in meta['resolved'] if r.get('slot')==slot)
  def dot_x():return root.locator('[data-part="canvas"] [data-layer="separators"] circle').evaluate_all('(cs)=>cs.map(c=>+c.getAttribute("cx"))')
  def reset():root.get_by_role('button',name='Reset this preset',exact=True).click();wait()
  def click_character(key,index=0):
   # Bring this glyph (not just the curved run's large box) to mid-window, clear of the sticky header.
   text(key).evaluate('''(t,i)=>{const r=t.getExtentOfChar(i),p=new DOMPoint(r.x+r.width/2,r.y+r.height/2).matrixTransform(t.getScreenCTM());window.scrollBy(0,p.y-innerHeight/2)}''',index)
   xy=text(key).evaluate('''(t,i)=>{const r=t.getExtentOfChar(i),p=new DOMPoint(r.x+r.width/2,r.y+r.height/2).matrixTransform(t.getScreenCTM());return {x:p.x,y:p.y}}''',index)
   page.mouse.click(xy['x'],xy['y'])
  wait()
  expected=page.evaluate("BCPrimitives.RECIPES.filter(r=>!r.excluded).map(r=>r.id)")
  actual=root.locator('[data-control="recipe"] option').evaluate_all('(es)=>es.map(e=>e.value)')
  record('All active v5 recipes present; excluded references absent',actual==expected,actual)
  record('Fresh editor selects reference-calibrated fitting',root.get_by_label('Lettering style',exact=True).input_value()=='reference-calibrated')
  record('Preview is native SVG with editable textPaths, not an image',root.locator('[data-part="canvas"] > svg').count()==1 and text('lower').locator('textPath').count()==1)
  record('No fallback for the starting mixed-case reference profile',root.locator('[data-warning="FONT_FALLBACK"]').count()==0)
  click_character('lower',0)
  dock=root.get_by_label('Edit selected lettering',exact=True)
  record('Actual mouse click on a glyph opens its inline editor',dock.is_visible() and dock.input_value()==field('lower').input_value())
  dock.fill('Environmental Monitoring and Conservation');wait()
  record('Typing in inline editor updates one curved SVG run and sidebar field',text('lower').text_content()=='Environmental Monitoring and Conservation' and field('lower').input_value()==dock.input_value() and text('lower').locator('textPath').count()==1)
  record('Focused input and selection survive asynchronous renders',dock.evaluate('(x)=>x===document.activeElement') and dock.evaluate('(x)=>x.selectionStart')==len(dock.input_value()))
  page.keyboard.press('Escape');record('Escape returns focus to the corresponding sidebar field',not dock.is_visible() and field('lower').evaluate('(x)=>x===document.activeElement'))
  # A curved line's large bounding rectangle must not eat clicks on the landscape.
  pos=root.locator('[data-part="canvas"] > svg').evaluate('''s=>{const p=new DOMPoint(338,421).matrixTransform(s.getScreenCTM());return {x:p.x,y:p.y}}''')
  page.mouse.click(**pos);record('Clicking the landscape does not select an enclosing text bounding box',not dock.is_visible())
  text('upper').focus();page.keyboard.press('Enter')
  record('Keyboard Enter activates curved lettering',dock.is_visible() and dock.input_value()==field('upper').input_value())
  page.keyboard.press('Escape')
  record('v2 emits its calibrated mixed-case face',text('upper').get_attribute('data-face')=='noto-condensed')
  pick('forests');field('lower').fill('PARKS');wait()
  record('Short wording remains a single editable run',text('lower').text_content()=='PARKS' and text('lower').get_attribute('textLength') is None)
  pick('long-wildfire');record('Switching presets restores each preset’s draft',field('lower').input_value()=='Environmental Monitoring and Conservation')
  # The production source catalogue stays immutable even though drafts change.
  record('Editing does not change recipe source defaults',page.evaluate("BCPrimitives.recipe('long-wildfire').content.lower")=='Forests, Lands and Natural Resource Operations')
  pick('forests');field('lower').fill('');wait();record('Blank line can be removed and restored through the field',text('lower').count()==0)
  field('lower').fill('PARKS');wait()
  field('lower').fill('<script>alert(1)</script> & ÉCOLOGIE');wait()
  record('Punctuation, accents and HTML-like wording are treated as text',text('lower').text_content()=='<script>alert(1)</script> & ÉCOLOGIE' and root.locator('[data-part="canvas"] script').count()==0)
  field('lower').fill('PARKS');wait()
  field('lower').dispatch_event('compositionstart')
  field('lower').fill('ÉCOLOGIE')
  page.wait_for_timeout(120)
  ime_pending = text('lower').text_content()=='PARKS'
  field('lower').dispatch_event('compositionend');wait()
  record('IME composition is committed without mid-composition rerender',ime_pending and text('lower').text_content()=='ÉCOLOGIE')
  # Delay one old render. An edit that arrives later must remain the winner.
  page.evaluate('''()=>{const old=BCLogo.render;window.originalRender=old;BCLogo.render=async function(s,o){const r=await old(s,o);if(s.content.lower==='Lagged old')await new Promise(ok=>setTimeout(ok,350));return r}}''')
  field('lower').fill('Lagged old');page.wait_for_timeout(120);field('lower').fill('LATEST');wait();page.wait_for_timeout(400)
  record('A delayed stale render cannot overwrite later wording',text('lower').text_content()=='LATEST')
  page.evaluate('()=>{BCLogo.render=window.originalRender}')
  # Save/export always consumes the last finished engine result, not decorated preview.
  with page.expect_download() as dl:root.get_by_role('button',name='SVG',exact=True).click()
  svg=dl.value.path().read_text();(out/'edited.svg').write_text(svg)
  record('SVG export keeps latest editable wording and excludes editor decorations','LATEST' in svg and '<textPath' in svg and 'fo-selected-text' not in svg and 'tabindex=' not in svg and 'data:font' not in svg)
  with page.expect_download() as dl:root.get_by_role('button',name='Save configuration',exact=True).click()
  cfg=json.loads(dl.value.path().read_text());(out/'saved-configuration.json').write_text(json.dumps(cfg,indent=2))
  record('Configuration export retains wording and fitting policy',cfg['textFit']=='reference-calibrated' and cfg['content']['lower']=='LATEST')
  pick('long-ministry');root.locator('[data-part="file"]').set_input_files({'name':'restore.json','mimeType':'application/json','buffer':json.dumps(cfg).encode()});wait()
  record('Saved configuration imports and restores the same text',field('lower').input_value()=='LATEST' and root.get_by_label('Current preset',exact=True).input_value()=='forests')
  wrong={**cfg,'recipe':'does-not-exist'}
  root.locator('[data-part="file"]').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':json.dumps(wrong).encode()});page.wait_for_timeout(150)
  record('Invalid preset import is rejected without destroying the draft','not opened' in root.locator('[data-part="status"]').inner_text() and field('lower').input_value()=='LATEST')
  with page.expect_download() as dl:root.get_by_role('button',name='PNG',exact=True).click()
  png=dl.value.path().read_bytes();(out/'edited.png').write_bytes(png)
  record('PNG export produces an encoded image',png.startswith(b'\x89PNG\r\n\x1a\n') and len(png)>1000,len(png))
  pick('long-wildfire');root.get_by_label('Service holder',exact=True).select_option('follow-text');wait()
  record('Reactive service holder is driven by the shared tab solver',root.locator('[data-primitive="reactive-service-ribbon"]').count()==1)
  root.get_by_label('Service holder',exact=True).select_option('reference');wait()
  record('Reference holder can be restored',root.locator('[data-primitive="reactive-service-ribbon"]').count()==0)
  rows=[]
  for id in expected:
   pick(id)
   keys=root.locator('[data-part="fields"] [data-content]').evaluate_all('(es)=>es.map(e=>e.dataset.content)')
   rows.append({'recipe':id,'fields':keys,'textRuns':root.locator('[data-part="canvas"] text[data-live-text]').count()})
  record('Every active recipe renders with its applicable text fields',len(rows)==len(expected) and all(r['fields'] for r in rows),rows)
  # The crest follows its wording: the short/long profile and the separator dots.
  pick('forests-wildfire');reset()
  auto=root.get_by_label('Pick the short or long crest from the wording',exact=True)
  record('New drafts pick the crest from the wording and let the dots follow it',auto.is_checked() and root.get_by_label('Separator dots',exact=True).input_value()=='follow-text' and dots()['placement']=='follow-text' and abs(dots()['y']-446)<.01,dots())
  field('upper').fill('British Columbia');field('lower').fill('Forests, Lands and Natural Resource Operations');wait()
  long_dots=dots()
  record('Long ministry wording turns Forests · Wildfire into the long crest with its dots near the reference height',crest()=='wildlife-long' and abs(long_dots['y']-215)<6 and root.locator('[data-warning]').count()==0,{'crest':crest(),**long_dots})
  record('Squeezed dots sit halfway between the upper and lower lines',root.locator('[data-layer="separators"]').get_attribute('data-separator-state')=='centred' and all(abs(u-l)<.1 for u,l in gaps()),gaps())
  # Measured references: wildfire-source.svg (capitals), and both long-crest rasters, which agree.
  long_x=dot_x();pick('forests');reset();caps_x=dot_x();pick('forests-wildfire')
  # The long crest's dots are halfway between its lines, which puts them within a few units of the rasters' dots.
  record('Dots sit where the references put them, across the band as well as down it',abs(long_x[0]-126.45)<3.5 and abs(long_x[1]-550.95)<3.5 and abs(caps_x[0]-76.45)<1 and abs(caps_x[1]-600.53)<1,{'long':long_x,'caps':caps_x})
  reset();pick('long-wildfire')
  field('upper').fill('BRITISH COLUMBIA');field('lower').fill('FORESTS');wait()
  record('Short capitals turn Long ministry · Wildfire into the capitals crest with its dots on the reference height',crest()=='wildlife-caps' and abs(dots()['y']-446)<.01,{'crest':crest(),**dots()})
  field('upper').fill('BRITISH COLUMBIA');field('lower').fill('Forests, Lands and Mines');wait()
  moved=dots()['y']
  record('Lower wording that climbs the sides pushes the dots up',crest()=='wildlife-caps' and moved<440 and root.locator('[data-layer="separators"]').get_attribute('data-separator-state')=='pushed',moved)
  root.get_by_label('Separator dots',exact=True).select_option('reference');wait()
  record('Separator dots can be kept at the reference position',dots()=={'placement':'reference','y':446.0},dots())
  root.get_by_label('Separator dots',exact=True).select_option('follow-text')
  root.get_by_text('Change the composition',exact=True).click()
  root.get_by_label('Crest profile',exact=True).select_option('wildlife-long');wait()
  root.get_by_text('Change the composition',exact=True).click()
  record('Choosing a crest profile by hand turns the automatic pick off',crest()=='wildlife-long' and not auto.is_checked())
  # Long crest, short lower line: the upper line spreads toward the capitals look; the dots stay at the sides.
  field('upper').fill('British Columbia');field('lower').fill('Forests and Range');wait()
  spread=root.get_by_label('Spread the upper line when there is room',exact=True)
  wide=upper_size();home=dots()['y'];spread.uncheck();wait();narrow=upper_size();spread.check();wait()
  record('With room, the long crest spreads its upper line and keeps the dots at the sides',wide>narrow*1.1 and abs(home-446)<.01,{'spread':wide,'compact':narrow,'dots':home})
  # The screenshot case: a mixed-case ministry line climbing the sides of the capitals crest.
  reset();pick('forests-wildfire');field('upper').fill('British Columbia');field('lower').fill('Forests, Lands and Mines');wait()
  low=resolved('wildlife-lower');body=low['cap']*low['bodyRatio']
  ring_ok=crest()=='wildlife-caps' and abs(low['curve']['rx']-body/2-266.43562)<.01 and abs(low['curve']['ry']-body/2-355.59686)<.01 and low['bodyRatio']<1
  record('Lines are centred in the white ring on their x-height (mixed case) all the way round',ring_ok,low)
  ring=root.get_by_label('Centre each line in the white ring',exact=True);ring.uncheck();wait()
  record('Unticking ring centring restores the calibrated slot geometry',abs(resolved('wildlife-lower')['curve']['rx']-300.30455-(47.99913-resolved('wildlife-lower')['cap'])/2)<.01,resolved('wildlife-lower')['curve'])
  ring.check();wait()
  reset();pick('forests')
  field('lower').fill('FORESTS, LANDS AND NATURAL RESOURCE OPERATIONS');wait()
  record('Capitals that fill both arcs leave room for the dots',crest()=='wildlife-long' and root.locator('[data-warning="SEPARATOR_CROWDED"]').count()==0 and root.locator('[data-warning="TEXT_FIT_OVERFLOW"]').count()==0,dots())
  reset()
  # The tree crest runs on the same rules, with diamonds as the marks.
  pick('forest-service');reset()
  marks=lambda:root.locator('[data-part="canvas"] [data-layer="separators"] path').count()
  home=crest()=='tree-heavy' and marks()==2 and abs(dots()['y']-397.65)<.01 and root.get_by_label('Pick the short or long crest from the wording',exact=True).is_enabled()
  # Calibrated against the Forest Service vector: Open Sans Bold above, Raleway Black (flat-apex A) below.
  record('The tree crest uses its calibrated faces and profiles',text('upper').get_attribute('data-face')=='open-bold' and text('lower').get_attribute('data-face')=='raleway-black' and resolved('tree-upper').get('referenceProfile')=='tree-upper' and resolved('tree-lower').get('referenceProfile')=='tree-lower')
  field('lower').fill('Forests, Lands and Natural Resource Operations');wait()
  state=root.locator('[data-layer="separators"]').get_attribute('data-separator-state')
  record('The tree crest switches to its long profile and keeps its diamonds halfway between the lines',home and crest()=='tree-long' and marks()==2 and state=='centred' and all(abs(u-l)<.1 for u,l in gaps()) and resolved('long-lower')['ringCentred'],{'crest':crest(),'state':state,'gaps':gaps()})
  field('lower').fill('BRITISH COLUMBIA');wait()
  record('Short wording returns the tree crest and its diamonds to the sides',crest()=='tree-heavy' and abs(dots()['y']-397.65)<.01)
  reset()
  # Wildfire Management's upper tab sits on the oval: the oval-hugging holder at its fixed reference span.
  pick('wildfire-management');reset()
  holder=root.locator('[data-part="canvas"] [data-primitive="reactive-service-ribbon"]')
  record('The Wildfire Management tab sits on the oval at its reference span',root.get_by_label('Service holder',exact=True).input_value()=='reference' and holder.count()==1 and abs(float(holder.get_attribute('data-tab-half-span'))-60)<.01)
  reset()
  pick('long-wildfire')
  root.get_by_role('button',name='Reset this preset',exact=True).click();wait()
  record('Reset restores default wording and calibrated mode',field('lower').input_value()=='Forests, Lands and Natural Resource Operations' and root.get_by_label('Lettering style',exact=True).input_value()=='reference-calibrated')
  if a.html:
   field('upper').fill('Province of British Columbia');wait();page.evaluate('mountAgain()');wait()
   record('Controller remount restores its per-preset draft (in-memory Storage fixture)',field('upper').input_value()=='Province of British Columbia')
   page.evaluate("editor.setPalette({text:'#000000'})");wait()
   record('Parent palette changes re-render live text',text('upper').get_attribute('fill')=='#000000')
   page.evaluate('editor.setPalette(null)');wait()
   root.evaluate("el=>el.parentElement.style.setProperty('--fo-canvas-background','#111111')")
   record('Backdrop CSS contract reaches the canvas',root.locator('[data-part=canvas]').evaluate("el=>getComputedStyle(el).backgroundColor")=='rgb(17, 17, 17)')
   root.evaluate("el=>el.parentElement.style.removeProperty('--fo-canvas-background')")
  else:
   page.get_by_role('button',name='Layer assembly',exact=True).click()
   record('Existing layer presets remain usable in the React Compose tab',page.locator('.fo-mode-panel:not([hidden]) .presets button').count()>0)
   page.get_by_role('button',name='Live lettering',exact=True).click();wait()
   record('Switching Compose modes preserves the editor',text('lower').text_content()=='Forests, Lands and Natural Resource Operations')
   # The app ships its own faces: no local install or Google request is needed.
   faces=page.evaluate("()=>[...BCLogo.fontState.values()].map(f=>({face:f.face,status:f.status,source:f.source,verified:f.verified}))")
   # Kabel Black is user-supplied (an ignored build input), so this checkout reports it as a plain fallback.
   bundled=[f for f in faces if f['face']!='kabel-black'];kabel=[f for f in faces if f['face']=='kabel-black']
   record('Lettering faces load from the app bundle and match the calibration advances',bundled and all(f['status']=='ready' and f['source']=='bundled' and f['verified'] for f in bundled) and all(f['source'] in ('bundled','fallback') for f in kabel),faces)
   pick('forests-wildfire')
   backing=root.get_by_label('Service backing',exact=True)
   faces_drawn=lambda:root.locator('[data-part="canvas"] [data-tab-part="face"]').count()
   see_through=backing.input_value()=='transparent' and faces_drawn()==0
   backing.select_option('paper');wait();paper=faces_drawn()==1
   backing.select_option('transparent');wait()
   pick('long-wildfire')
   record('Service backing defaults per preset and can be changed',see_through and paper and backing.input_value()=='paper' and faces_drawn()==1)
   # Fallback output needs consent: block the bundled Noto file and every local face.
   probe=context.new_page();probe.on('pageerror',lambda e:errors.append(str(e)))
   probe.add_init_script('''(()=>{const F=window.FontFace;window.FontFace=function(f,src,d){return new F(f,typeof src==='string'&&src.startsWith('local(')?'local("missing-face")':src,d)};window.FontFace.prototype=F.prototype;})()''')
   # Only the engine's fetch of the font bytes (Vite dev also serves the import as a module).
   probe.route('**/noto-sans-latin*',lambda route:route.abort() if route.request.resource_type=='fetch' else route.continue_())
   probe.goto(a.url);probe.get_by_role('button',name='Live lettering',exact=True).click()
   probe.wait_for_function('''()=>{const b=document.querySelector('.fo-editor [data-action="save"]');return b&&!b.disabled}''',timeout=30000)
   proot=probe.locator('.fo-editor');proot.get_by_label('Current preset',exact=True).select_option('long-ministry')
   probe.wait_for_function('''()=>document.querySelector('.fo-editor [data-warning="FONT_FALLBACK"]')&&!document.querySelector('.fo-editor [data-action="save"]').disabled''',timeout=30000)
   svg_button=proot.get_by_role('button',name='SVG',exact=True)
   blocked=svg_button.is_disabled() and proot.get_by_role('button',name='PNG',exact=True).is_disabled() and not proot.get_by_role('button',name='Save configuration',exact=True).is_disabled()
   proot.locator('[data-part="font-ack-input"]').check()
   record('Exports with a fallback face need explicit consent',blocked and svg_button.is_enabled())
   # Once the file is reachable again, the font button reloads it from the bundle.
   probe.unroute('**/noto-sans-latin*')
   proot.get_by_role('button',name='Load reference fonts online',exact=True).click()
   probe.wait_for_function('''()=>!document.querySelector('.fo-editor [data-warning="FONT_FALLBACK"]')&&!document.querySelector('.fo-editor [data-action="save"]').disabled''',timeout=30000)
   noto=probe.evaluate("()=>{const f=BCLogo.fontState.get('noto-condensed');return {source:f?.source,verified:f?.verified}}")
   record('The font button reloads the bundled face once it is available',noto=={'source':'bundled','verified':True} and proot.locator('[data-part="font-ack"]').is_hidden() and svg_button.is_enabled(),noto)
   probe.close()
   # Kabel Black is a user-supplied face. Without it, tree crests keep the calibrated
   # substitutes (no Arial fallback, exports open); loading an OTF in the session switches
   # the crest to it. A bundled WOFF2 stands in for the user's file here.
   kp=context.new_page();kp.on('pageerror',lambda e:errors.append(str(e)))
   kp.goto(a.url);kp.get_by_role('button',name='Live lettering',exact=True).click()
   kwait=lambda:kp.wait_for_function('''()=>{const b=document.querySelector('.fo-editor [data-action="save"]');return b&&!b.disabled}''',timeout=30000)
   kwait();kroot=kp.locator('.fo-editor');kroot.get_by_label('Current preset',exact=True).select_option('forest-service');kwait()
   kroot.get_by_role('button',name='Reset this preset',exact=True).click();kwait()
   ktext=lambda k:kroot.locator(f'[data-part="canvas"] [data-live-text="{k}"]')
   kselect=kroot.get_by_label('Tree oval lettering',exact=True)
   without=kselect.input_value()=='reference-v2' and ktext('lower').get_attribute('data-face')=='raleway-black' and kroot.locator('[data-warning="FONT_FALLBACK"]').count()==0 and kroot.get_by_role('button',name='SVG',exact=True).is_enabled()
   kroot.locator('[data-part="kabel-file"]').set_input_files(str(Path('node_modules/@fontsource/raleway/files/raleway-latin-900-normal.woff2').resolve()))
   kp.wait_for_function('''()=>document.querySelector('.fo-editor [data-live-text="lower"]')?.getAttribute('data-face')==='kabel-black'&&!document.querySelector('.fo-editor [data-action="save"]').disabled''',timeout=30000)
   record('Without the Kabel OTF tree crests keep the calibrated faces; loading one switches the crest to it',without and kselect.input_value()=='kabel-black' and ktext('upper').get_attribute('data-face')=='kabel-black',{'without':without})
   kp.close()
   # The Recreations page draws the same engine output as the editor's defaults.
   page.goto(a.url.split('#')[0]+'#/recreations')
   page.wait_for_function("document.querySelectorAll('.reccard svg text[data-live-text]').length>10",timeout=60000)
   cards=page.evaluate('''async()=>{const out={},names={'forests':'Forests','forests-wildfire':'Forests · Wildfire Service','long-ministry':'Long ministry','long-wildfire':'Long ministry · Wildfire Service'};
       for(const id of Object.keys(names)){
       const r=await BCLogo.render(BCLogo.recipeState(id,{textFit:'reference-calibrated',autoProfile:true,separatorPlacement:'follow-text',fanOut:true,centreInRing:true}));
       const card=[...document.querySelectorAll('.reccard')].find(c=>c.querySelector('h3').textContent===names[id]);
       const shown=[...card.querySelectorAll('svg text[data-live-text]')].map(t=>[t.textContent,t.getComputedTextLength()]);
       out[id]={expected:r.report.map(x=>[x.text,x.width]),shown};}return out;}''')
   same=all(len(c['expected'])==len(c['shown']) and all(e[0]==v[0] and abs(e[1]-v[1])<.1 for e,v in zip(c['expected'],c['shown'])) for c in cards.values())
   record('Recreations shows the live engine lettering with the editor configuration and advances',same,cards)
   # Drafts saved before the profile/dot controls existed take their new defaults.
   page.evaluate('''()=>localStorage.setItem('forestoval-compose-lettering-v1',JSON.stringify({version:1,active:'forests',drafts:{forests:{...BCLogo.recipeState('forests',{textFit:'reference-calibrated'}),content:{upper:'BRITISH COLUMBIA',lower:'Forests, Lands and Natural Resource Operations'}}}}))''')
   page.goto(a.url);page.get_by_role('button',name='Live lettering',exact=True).click();wait()
   record('Older saved drafts adopt the automatic crest, following dots, spreading and ring centring',root.get_by_label('Current preset',exact=True).input_value()=='forests' and auto.is_checked() and crest()=='wildlife-long' and dots()['placement']=='follow-text' and root.get_by_label('Spread the upper line when there is room',exact=True).is_checked() and root.get_by_label('Centre each line in the white ring',exact=True).is_checked())
   reset();pick('long-wildfire')
  root.get_by_role('button',name='Reset this preset',exact=True).click();wait()
  click_character('lower',0);dock.fill('Environmental Monitoring and Conservation');wait()
  page.screenshot(path=str(out/'live-lettering-desktop.png'),full_page=True)
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200)
  record('390px viewport has no horizontal page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  page.screenshot(path=str(out/'live-lettering-mobile.png'),full_page=True)
  record('No uncaught browser exceptions',not errors,errors)
  browser.close()
 (out/'results.json').write_text(json.dumps({'mode':'isolated controller with v2 engine and fixture artwork' if a.html else 'full application URL','browser':'Chromium','checks':results,'passed':sum(r['passed'] for r in results),'total':len(results)},indent=2))
 if not all(r['passed'] for r in results):raise SystemExit(1)

if __name__=='__main__':main()
