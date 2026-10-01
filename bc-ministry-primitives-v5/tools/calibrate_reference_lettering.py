"""Whole live-text reference fitting; oval registration is fixed throughout."""
from pathlib import Path
import argparse, base64, io, json, os, shutil, time
import cv2, numpy as np
from PIL import Image
from scipy.optimize import minimize
from playwright.sync_api import sync_playwright
V5=Path(__file__).resolve().parents[1];ROOT=V5;D=V5/'tests/output/calibration';FIXTURES=V5/'tests/fixtures/reference-lettering'
EXTRA=""" 'open-condensed':{family:'Open Sans Condensed',weight:700,locals:['Open Sans Condensed Bold','OpenSans-CondensedBold'],google:'Open+Sans+Condensed:wght@700',fallback:'sans-serif',label:'Open Sans Condensed Bold · substitute'},
"""
PROBE=r"""
window.calibrationReady=false;
window.probe=async function(q){
 const E=BCLogo,P=BCPrimitives,base=P.SLOTS[q.slot],m=E.metrics(q.text,q.face);
 const [cap,rx,ry,tracking,wordSpacing,bias,y=0]=q.params;
 const t={...base,cap,anchorCap:cap,rx,ry,y},c=E.curve(t,cap,q.span||base.maxSpan),size=cap/m.cap;
 const s=E.node('svg',{xmlns:'http://www.w3.org/2000/svg',width:q.width||473,height:Math.round((q.width||473)*945/676),viewBox:'0 0 676 945'});
 const defs=E.node('defs'),path=E.node('path',{id:'p',d:c.d});defs.append(path);s.append(defs);
 const text=E.node('text',{'font-family':m.family,'font-weight':m.weight,'font-stretch':m.stretch||'normal','font-size':Math.round(size*1e5)/1e5,'font-kerning':'normal','text-rendering':'geometricPrecision','letter-spacing':Math.round(tracking*size*1e5)/1e5,'word-spacing':Math.round(wordSpacing*size*1e5)/1e5,'text-anchor':'middle',style:'font-synthesis:none;white-space:pre','xml:space':'preserve',fill:'#000000'});
 const tp=E.node('textPath',{href:'#p',startOffset:c.length/2+bias,method:'align',spacing:'exact'},q.text);text.append(tp);s.append(text);
 const blob=await E.png({svg:s,fontIds:[q.face],viewBox:{x:0,y:0,w:676,h:945}},q.width||473);
 return await new Promise(ok=>{const f=new FileReader;f.onload=()=>ok(f.result.split(',')[1]);f.readAsDataURL(blob)});
};
BCLogo.ensureFonts(['open-heavy','open-bold','condensed-bold','open-condensed','noto-condensed'],false).then(f=>{window.loadedFonts=f.map(x=>({face:x.face,status:x.status}));window.calibrationReady=true;});
"""
def html():
 prim=(V5/'src/primitives.js').read_text().replace('const FACES={','const FACES={\n'+EXTRA)
 return '<!doctype html><html><body>'+''.join('<script>'+s+'</script>' for s in [prim,'window.BC_ART={};',(V5/'src/engine.js').read_text(),PROBE])+'</body></html>'
GROUPS={
 'caps-upper':dict(slot='wildlife-upper',text='BRITISH COLUMBIA',refs=[2,4],part='upper',faces=['open-heavy'],init=[51.42037,239.89365,332.15782,.01157,0,0,0],bounds=[(44,59),(225,252),(320,345),(-.025,.06),(-.15,.15),(-20,20),(-3,3)]),
 'caps-lower':dict(slot='wildlife-lower',text='FORESTS',refs=[2,4],part='lower',faces=['open-heavy'],init=[47.5561,302.62174,379.46732,.14149,0,0,0],bounds=[(41,53),(279,320),(370,390),(.05,.2),(0,0),(-15,15),(-3,3)]),
 'long-upper':dict(slot='long-upper',text='British Columbia',refs=[1,3],part='upper',faces=['condensed-bold','open-condensed','noto-condensed'],init=[53,249,334,0,0,0,0],bounds=[(42,57),(236,262),(320,350),(-.06,.06),(-.19,.12),(-15,15),(-4,4)]),
 'long-lower':dict(slot='long-lower',text='Forests, Lands and Natural Resource Operations',refs=[1,3],part='lower',faces=['condensed-bold','open-condensed','noto-condensed'],init=[50,290,379,0,0,0,0],bounds=[(43,55),(275,303),(367,393),(-.035,.04),(-.10,.18),(-18,18),(-3,3)]),
 'caps-service':dict(slot='service-bottom',text='WILDFIRE SERVICE',refs=[2],part='service',faces=['open-heavy'],init=[48.04678,402.36543,484.21603,.04075,0,0,0],bounds=[(41,53),(370,424),(475,492),(-.01,.075),(-.1,.1),(-15,15),(-3,3)]),
 'long-service':dict(slot='service-bottom',text='WILDFIRE SERVICE',refs=[3],part='service',faces=['open-heavy','condensed-bold'],init=[41,402.36543,484.21603,.04,0,0,0],bounds=[(34,47),(368,421),(470,492),(-.01,.15),(-.12,.16),(-15,15),(-3,3)])}
def main():
 global D,FIXTURES
 ap=argparse.ArgumentParser();ap.add_argument('--groups',nargs='*');ap.add_argument('--maxiter',type=int,default=28);ap.add_argument('--faces',nargs='*');ap.add_argument('--out',type=Path,default=D);ap.add_argument('--fixtures',type=Path,default=FIXTURES);args=ap.parse_args();D=args.out;D.mkdir(parents=True,exist_ok=True);FIXTURES=args.fixtures
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM') or shutil.which('chromium'),args=['--no-sandbox']);page=browser.new_page();page.set_content(html());page.wait_for_function('window.calibrationReady');loaded=page.evaluate('window.loadedFonts');print(loaded,flush=True)
  required={face for name in args.groups or list(GROUPS) for face in args.faces or GROUPS[name]['faces']}
  ready={x['face'] for x in loaded if x['status']=='ready'}
  if required-ready:raise RuntimeError('Install the exact local faces before fitting: '+', '.join(sorted(required-ready)))
  for name in args.groups or list(GROUPS):
   cfg=GROUPS[name];width=473;shape=(width,round(width*945/676))
   targets=[cv2.resize(np.array(Image.open(FIXTURES/f'ref-{i}-{cfg["part"]}-mask.png'),dtype=np.float32)/255,shape,interpolation=cv2.INTER_AREA) for i in cfg['refs']]
   target=sum(targets)/len(targets);target[target<.10]=0;sigmas=[2.2,.75]
   blurred=[cv2.GaussianBlur(target,(0,0),s) for s in sigmas];norms=[float(np.sum(t*t)) for t in blurred];solutions=[]
   for face in args.faces or cfg['faces']:
    count=0;best=[1e9,None];t0=time.time();memo={}
    def objective(x):
     nonlocal count
     key=tuple(np.round(x,6))
     if key in memo:return memo[key]
     payload=dict(slot=cfg['slot'],text=cfg['text'],face=face,params=list(x),width=width)
     raw=base64.b64decode(page.evaluate('q=>window.probe(q)',payload));a=np.array(Image.open(io.BytesIO(raw)).convert('RGBA'))[:,:,3].astype(np.float32)/255
     losses=[]
     for sigma,t,tn in zip(sigmas,blurred,norms):
      g=cv2.GaussianBlur(a,(0,0),sigma);losses.append(1-2*float(np.sum(g*t))/(float(np.sum(g*g))+tn+1e-9))
     loss=.70*losses[0]+.30*losses[1];count+=1;memo[key]=loss
     if loss<best[0]:best[:]=[loss,list(x)]
     if count%150==0:print(name,face,count,round(best[0],5),'sec',round(time.time()-t0),flush=True)
     return loss
    x0=np.array(cfg['init'],float);active=[i for i,(lo,hi) in enumerate(cfg['bounds']) if hi>lo and i!=6];bounds=[cfg['bounds'][i] for i in active]
    def unpack(v):
     x=x0.copy();x[active]=v;return x
    res=minimize(lambda v:objective(unpack(v)),x0[active],method='Powell',bounds=bounds,options={'maxiter':args.maxiter,'xtol':1e-4,'ftol':2e-5})
    score,x=best;payload=dict(slot=cfg['slot'],text=cfg['text'],face=face,params=x,width=676)
    (D/f'{name}-{face}-fit.png').write_bytes(base64.b64decode(page.evaluate('q=>window.probe(q)',payload)))
    sol=dict(group=name,face=face,loss=score,params=x,calls=count,seconds=time.time()-t0,success=bool(res.success),message=str(res.message),references=cfg['refs']);solutions.append(sol);(D/f'{name}-{face}.json').write_text(json.dumps(sol,indent=2));print('DONE',json.dumps(sol),flush=True)
   (D/f'{name}-best.json').write_text(json.dumps(min(solutions,key=lambda x:x['loss']),indent=2))
  browser.close()
if __name__=='__main__':main()
