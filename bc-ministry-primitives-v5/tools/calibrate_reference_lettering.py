"""Whole live-text reference fitting; oval registration is fixed throughout."""
from pathlib import Path
import argparse, base64, io, json, os, shutil, time
import cv2, numpy as np
from PIL import Image
from scipy.optimize import minimize
from playwright.sync_api import sync_playwright
V5=Path(__file__).resolve().parents[1];ROOT=V5;D=V5/'tests/output/calibration';FIXTURES=V5/'tests/fixtures/reference-lettering'
EXTRA=""" 'jost-semibold':{family:'Jost',weight:600,locals:['Jost SemiBold','Jost-SemiBold'],google:'Jost:wght@600',fallback:'sans-serif',label:'Jost SemiBold · candidate'},
 'jost-bold':{family:'Jost',weight:700,locals:['Jost Bold','Jost-Bold'],google:'Jost:wght@700',fallback:'sans-serif',label:'Jost Bold · candidate'},
 'jost-heavy':{family:'Jost',weight:800,locals:['Jost ExtraBold','Jost-ExtraBold'],google:'Jost:wght@800',fallback:'sans-serif',label:'Jost ExtraBold · candidate'},
 'spartan-bold':{family:'League Spartan',weight:700,locals:['League Spartan Bold','LeagueSpartan-Bold'],google:'League+Spartan:wght@700',fallback:'sans-serif',label:'League Spartan Bold · candidate'},
 'spartan-heavy':{family:'League Spartan',weight:800,locals:['League Spartan ExtraBold','LeagueSpartan-ExtraBold'],google:'League+Spartan:wght@800',fallback:'sans-serif',label:'League Spartan ExtraBold · candidate'},
 'spartan-black':{family:'League Spartan',weight:900,locals:['League Spartan Black','LeagueSpartan-Black'],google:'League+Spartan:wght@900',fallback:'sans-serif',label:'League Spartan Black · candidate'},
 'montserrat-heavy':{family:'Montserrat',weight:800,locals:['Montserrat ExtraBold','Montserrat-ExtraBold'],google:'Montserrat:wght@800',fallback:'sans-serif',label:'Montserrat ExtraBold · candidate'},
 'montserrat-black':{family:'Montserrat',weight:900,locals:['Montserrat Black','Montserrat-Black'],google:'Montserrat:wght@900',fallback:'sans-serif',label:'Montserrat Black · candidate'},
 'nunito-heavy':{family:'Nunito Sans',weight:800,locals:['Nunito Sans ExtraBold','NunitoSans-ExtraBold'],google:'Nunito+Sans:wght@800',fallback:'sans-serif',label:'Nunito Sans ExtraBold · candidate'},
 'nunito-black':{family:'Nunito Sans',weight:900,locals:['Nunito Sans Black','NunitoSans-Black'],google:'Nunito+Sans:wght@900',fallback:'sans-serif',label:'Nunito Sans Black · candidate'},
 'redhat-heavy':{family:'Red Hat Display',weight:800,locals:['Red Hat Display ExtraBold','RedHatDisplay-ExtraBold'],google:'Red+Hat+Display:wght@800',fallback:'sans-serif',label:'Red Hat Display ExtraBold · candidate'},
 'redhat-black':{family:'Red Hat Display',weight:900,locals:['Red Hat Display Black','RedHatDisplay-Black'],google:'Red+Hat+Display:wght@900',fallback:'sans-serif',label:'Red Hat Display Black · candidate'},
 'lexend-heavy':{family:'Lexend',weight:800,locals:['Lexend ExtraBold','Lexend-ExtraBold'],google:'Lexend:wght@800',fallback:'sans-serif',label:'Lexend ExtraBold · candidate'},
 'figtree-heavy':{family:'Figtree',weight:800,locals:['Figtree ExtraBold','Figtree-ExtraBold'],google:'Figtree:wght@800',fallback:'sans-serif',label:'Figtree ExtraBold · candidate'},
 'figtree-black':{family:'Figtree',weight:900,locals:['Figtree Black','Figtree-Black'],google:'Figtree:wght@900',fallback:'sans-serif',label:'Figtree Black · candidate'},
 'mulish-heavy':{family:'Mulish',weight:800,locals:['Mulish ExtraBold','Mulish-ExtraBold'],google:'Mulish:wght@800',fallback:'sans-serif',label:'Mulish ExtraBold · candidate'},
 'mulish-black':{family:'Mulish',weight:900,locals:['Mulish Black','Mulish-Black'],google:'Mulish:wght@900',fallback:'sans-serif',label:'Mulish Black · candidate'},
 'urbanist-heavy':{family:'Urbanist',weight:800,locals:['Urbanist ExtraBold','Urbanist-ExtraBold'],google:'Urbanist:wght@800',fallback:'sans-serif',label:'Urbanist ExtraBold · candidate'},
 'urbanist-black':{family:'Urbanist',weight:900,locals:['Urbanist Black','Urbanist-Black'],google:'Urbanist:wght@900',fallback:'sans-serif',label:'Urbanist Black · candidate'},
 'outfit-heavy':{family:'Outfit',weight:800,locals:['Outfit ExtraBold','Outfit-ExtraBold'],google:'Outfit:wght@800',fallback:'sans-serif',label:'Outfit ExtraBold · candidate'},
 'jakarta-heavy':{family:'Plus Jakarta Sans',weight:800,locals:['Plus Jakarta Sans ExtraBold','PlusJakartaSans-ExtraBold'],google:'Plus+Jakarta+Sans:wght@800',fallback:'sans-serif',label:'Plus Jakarta Sans ExtraBold · candidate'},
 'poppins-heavy':{family:'Poppins',weight:800,locals:['Poppins ExtraBold','Poppins-ExtraBold'],google:'Poppins:wght@800',fallback:'sans-serif',label:'Poppins ExtraBold · candidate'},
 'kumbh-heavy':{family:'Kumbh Sans',weight:800,locals:['Kumbh Sans ExtraBold','KumbhSans-ExtraBold'],google:'Kumbh+Sans:wght@800',fallback:'sans-serif',label:'Kumbh Sans ExtraBold · candidate'},
 'kumbh-black':{family:'Kumbh Sans',weight:900,locals:['Kumbh Sans Black','KumbhSans-Black'],google:'Kumbh+Sans:wght@900',fallback:'sans-serif',label:'Kumbh Sans Black · candidate'},
 'albert-heavy':{family:'Albert Sans',weight:800,locals:['Albert Sans ExtraBold','AlbertSans-ExtraBold'],google:'Albert+Sans:wght@800',fallback:'sans-serif',label:'Albert Sans ExtraBold · candidate'},
 'franklin-heavy':{family:'Libre Franklin',weight:800,locals:['Libre Franklin ExtraBold','LibreFranklin-ExtraBold'],google:'Libre+Franklin:wght@800',fallback:'sans-serif',label:'Libre Franklin ExtraBold · candidate'},
 'franklin-black':{family:'Libre Franklin',weight:900,locals:['Libre Franklin Black','LibreFranklin-Black'],google:'Libre+Franklin:wght@900',fallback:'sans-serif',label:'Libre Franklin Black · candidate'},
 'public-heavy':{family:'Public Sans',weight:800,locals:['Public Sans ExtraBold','PublicSans-ExtraBold'],google:'Public+Sans:wght@800',fallback:'sans-serif',label:'Public Sans ExtraBold · candidate'},
 'public-black':{family:'Public Sans',weight:900,locals:['Public Sans Black','PublicSans-Black'],google:'Public+Sans:wght@900',fallback:'sans-serif',label:'Public Sans Black · candidate'},
 'archivo-black':{family:'Archivo',weight:900,locals:['Archivo Black','Archivo-Black'],google:'Archivo:wght@900',fallback:'sans-serif',label:'Archivo Black · candidate'},
 'work-black':{family:'Work Sans',weight:900,locals:['Work Sans Black','WorkSans-Black'],google:'Work+Sans:wght@900',fallback:'sans-serif',label:'Work Sans Black · candidate'},
 'albert-black':{family:'Albert Sans',weight:900,locals:['Albert Sans Black','AlbertSans-Black'],google:'Albert+Sans:wght@900',fallback:'sans-serif',label:'Albert Sans Black · candidate'},
'open-condensed':{family:'Open Sans Condensed',weight:700,locals:['Open Sans Condensed Bold','OpenSans-CondensedBold'],google:'Open+Sans+Condensed:wght@700',fallback:'sans-serif',label:'Open Sans Condensed Bold · substitute'},
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
BCLogo.ensureFonts(Object.keys(BCPrimitives.FACES),false).then(f=>{window.loadedFonts=f.map(x=>({face:x.face,status:x.status}));window.calibrationReady=true;});
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
 # Tree crest, from the Forest Service vector (tools/extract_tree_masks.py). Uppercase runs, cap-height targets.
 'tree-upper':dict(slot='tree-upper',text='FOREST SERVICE',refs=[5],part='upper',faces=['condensed-bold','condensed-heavy','noto-condensed','open-heavy','open-bold','inter-black','sans-bold'],init=[62.36874,232.06115,322.96198,.00156,0,0,0],bounds=[(50,72),(220,248),(310,336),(-.06,.15),(-.15,.3),(-20,20),(-3,3)]),
 'tree-lower':dict(slot='tree-lower',text='BRITISH COLUMBIA',refs=[5],part='lower',faces=['raleway-black','franklin-black','public-black','open-heavy','inter-black','condensed-heavy','noto-condensed'],init=[62.5,296.07,381.95,.054,0,0,0],bounds=[(50,72),(282,310),(368,396),(-.06,.2),(-.15,.3),(-20,20),(-3,3)]),
 # The same runs on the ring-centred baseline the editor uses by default
 # (tree ring centre 266.785 x 355.965, ringOffset -4.5, capitals body = cap).
 'tree-upper-ring':dict(slot='tree-upper',text='FOREST SERVICE',refs=[5],part='upper',faces=['open-bold'],init=[60.94783,231.81,320.99,-.05226,.03374,.31742,0],bounds=[(54,68),(231.81,231.81),(320.99,320.99),(-.06,.1),(-.15,.3),(-20,20),(-3,3)]),
 'tree-lower-ring':dict(slot='tree-lower',text='BRITISH COLUMBIA',refs=[5],part='lower',faces=['raleway-black'],init=[60.70725,292.639,381.819,0.07470,0.19079,7.32139,0],bounds=[(52,66),(292.639,292.639),(381.819,381.819),(-.06,.2),(-.15,.3),(-20,20),(-3,3)]),
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
