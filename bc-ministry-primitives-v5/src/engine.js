/* Browser SVG engine. ART is immutable source geometry. Each phrase is one
 * live text/textPath, never a traced alphabet or per-character transform. */
(function(global){
'use strict';
const P=global.BCPrimitives, NS='http://www.w3.org/2000/svg', XL='http://www.w3.org/1999/xlink';
const CX=338.36631,CY=420.96480;
const clone=x=>JSON.parse(JSON.stringify(x));
const round=x=>Math.round(x*1e5)/1e5;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function node(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))if(v!==undefined&&v!==null)e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;}
function fragment(xml){const d=new DOMParser().parseFromString(`<svg xmlns="${NS}">${xml}</svg>`,'image/svg+xml');if(d.querySelector('parsererror'))throw Error('Invalid source SVG');const f=document.createDocumentFragment();for(const e of d.documentElement.children)f.append(document.importNode(e,true));return f;}
function readData(id){return JSON.parse(document.getElementById(id).textContent);}
const ART=global.BC_ART||readData('art-data');
let measureRoot,seq=0;const cache=new Map();
function measurementRoot(){if(!measureRoot){measureRoot=node('svg',{width:1,height:1,'aria-hidden':'true'});measureRoot.style.cssText='position:fixed;left:-20000px;top:-20000px;visibility:hidden;overflow:visible';document.body.append(measureRoot);}return measureRoot;}
const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
const fontState=new Map(),fontPromises=new Map();
function invalidateMetrics(){cache.clear();}
const timeout=(promise,ms)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('Font loading timed out')),ms))]);
async function loadFace(id,allowNetwork=false){
 const face=P.FACES[id];if(!face)throw Error('Unknown face '+id);
 const known=fontState.get(id);if(known?.status==='ready')return known;
 const key=id+':'+allowNetwork;if(fontPromises.has(key))return fontPromises.get(key);
 const task=(async()=>{
  for(const name of face.locals){try{const f=new FontFace(face.family,`local("${name}")`,{weight:String(face.weight),style:'normal'});await timeout(f.load(),1800);document.fonts.add(f);const s={status:'ready',source:'local',face:id,family:face.family,weight:face.weight,font:f};fontState.set(id,s);invalidateMetrics();return s;}catch{}}
  if(allowNetwork){try{
   const css=await timeout(fetch('https://fonts.googleapis.com/css2?family='+face.google+'&display=block').then(r=>{if(!r.ok)throw Error('Font CSS HTTP '+r.status);return r.text();}),6500);
   // Request full available latin/latin-extended subsets, never a text-subset tied
   // to one recipe. A new name must not silently lack letters.
   const blocks=[...css.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)];let loaded=[];
   for(const b of blocks){const body=b[1],u=body.match(/url\(([^)]+)\)/),range=body.match(/unicode-range:\s*([^;]+);/);if(!u)continue;
    const url=u[1].replace(/["']/g,''),buf=await timeout(fetch(url).then(r=>{if(!r.ok)throw Error('Font bytes HTTP '+r.status);return r.arrayBuffer();}),6500);
    const f=new FontFace(face.family,buf,{weight:String(face.weight),style:'normal',...(range?{unicodeRange:range[1]}:{})});await f.load();document.fonts.add(f);loaded.push({font:f,bytes:buf,range:range?.[1]||null});
   }
   if(!loaded.length)throw Error('No font faces in stylesheet');const s={status:'ready',source:'web',face:id,family:face.family,weight:face.weight,loaded};fontState.set(id,s);invalidateMetrics();return s;
  }catch(e){fontState.set(id,{status:'fallback',source:'fallback',face:id,family:face.family,weight:face.weight,error:e.message});}}
  const s=fontState.get(id)||{status:'fallback',source:'fallback',face:id,family:face.family,weight:face.weight,error:'Exact face not found locally'};fontState.set(id,s);return s;
 })();fontPromises.set(key,task);return task;
}
function retryFonts(){fontPromises.clear();}
async function ensureFonts(ids,allowNetwork=false){const r=await Promise.all([...new Set(ids)].map(id=>loadFace(id,allowNetwork)));await document.fonts.ready;return r;}
function metrics(text,faceId){
 const f=P.FACES[faceId];if(!f)throw Error('Unknown font face');const key=faceId+'|'+text;if(cache.has(key))return cache.get(key);
 const family=`"${f.family}", ${f.fallback}`;
 ctx.font=`${f.weight} 1000px ${family}`;ctx.fontKerning='normal';
 const h=ctx.measureText('H'),m=ctx.measureText(text);
 const el=node('text',{'font-family':family,'font-weight':f.weight,'font-size':1000,'font-kerning':'normal',style:'font-synthesis:none;white-space:pre'},text);measurementRoot().append(el);const width=el.getComputedTextLength()/1000;el.remove();
 const v={cap:(h.actualBoundingBoxAscent||714)/1000,ascent:Math.max(0,m.actualBoundingBoxAscent||0)/1000,descent:Math.max(0,m.actualBoundingBoxDescent||0)/1000,left:(m.actualBoundingBoxLeft||0)/1000,right:(m.actualBoundingBoxRight||m.width)/1000,width,family,weight:f.weight,faceId};cache.set(key,v);return v;
}
function clean(value,max=320){return String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').normalize('NFC').slice(0,max);}
function normalise(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Configuration must be an object');
 const rid=P.RECIPES.some(r=>r.id===input.recipe)?input.recipe:'forests';const r=P.recipe(rid);
 const s={version:5,recipe:rid,crest:input.crest||r.crest,tab:input.tab||r.tab,layout:input.layout||r.layout,theme:input.theme||r.theme,autoProfile:input.autoProfile===true,content:{...r.content},roles:{},slots:{},colours:{},outputWidth:clamp(Number(input.outputWidth)||1200,100,6000)};
 for(const [k,v]of Object.entries(input.content||{}))if(['upper','lower','service','word','descriptor','district','lines','branch'].includes(k))s.content[k]=clean(v);
 for(const k of ['crest','tab','layout','theme']){const t={crest:P.CRESTS,tab:P.TABS,layout:P.LOCKUPS,theme:P.THEMES}[k];if(!t[s[k]])throw Error('Unknown '+k+': '+s[k]);}
 for(const[id,v]of Object.entries(input.roles||{})){if(!P.ROLES[id]||!v||typeof v!=='object')continue;const out={};if(v.face&&P.FACES[v.face])out.face=v.face;if(Number.isFinite(v.capScale))out.capScale=clamp(v.capScale,.5,1.5);if(Number.isFinite(v.trackingEm))out.trackingEm=clamp(v.trackingEm,-.01,.12);s.roles[id]=out;}
 for(const[id,v]of Object.entries(input.slots||{})){if(!P.SLOTS[id]||!v||typeof v!=='object')continue;const out={};for(const[k,limits]of Object.entries({cap:[15,100],tracking:[0,.2],rx:[100,550],ry:[150,650],y:[-300,1100]}))if(Number.isFinite(v[k]))out[k]=clamp(v[k],...limits);s.slots[id]=out;}
 for(const[k,v]of Object.entries(input.colours||{}))if(k in P.THEMES[s.theme]&&/^#[0-9a-f]{6}$/i.test(v))s.colours[k]=v;
 return s;
}
function role(id,s){return {...P.ROLES[id],...(s.roles[id]||{})};}
function slot(id,s){return {...P.SLOTS[id],...(s.slots[id]||{})};}
function effectiveCrest(s){
 if(!s.autoProfile||!s.crest.startsWith('wildlife-'))return s.crest;
 const t=slot('wildlife-lower',s),r=role(t.role,s),m=metrics(s.content.lower||'',r.face),size=46/m.cap;
 const p=curve({...t,span:t.maxSpan},46);return m.width*size>p.length*.92?'wildlife-long':'wildlife-caps';
}
function point(rx,ry,a){a*=Math.PI/180;return [CX+rx*Math.cos(a),CY+ry*Math.sin(a)];}
function curve(t,cap=t.cap,span=t.span){
 if(t.side==='flat'){const width=t.width||570,y=t.y+(cap-t.anchorCap)/2;return{d:`M ${CX-width/2} ${y} L ${CX+width/2} ${y}`,length:width,rx:0,ry:0,span:0,side:'flat'};}
 const shift=(t.side==='top'?1:-1)*(t.anchorCap-cap)/2,rx=t.rx+shift,ry=t.ry+shift;
 const mid=t.side==='top'?-90:90,dir=t.side==='top'?1:-1,start=mid-dir*span/2,end=mid+dir*span/2;
 let a=point(rx,ry,start),b=point(rx,ry,end),last=a,length=0;
 for(let i=1;i<=360;i++){const next=point(rx,ry,start+(end-start)*i/360);length+=Math.hypot(next[0]-last[0],next[1]-last[1]);last=next;}
 const y=t.y||0;
 return {d:`M ${round(a[0])} ${round(a[1]+y)} A ${round(rx)} ${round(ry)} 0 ${span>180?1:0} ${dir>0?1:0} ${round(b[0])} ${round(b[1]+y)}`,length,rx,ry,span,side:t.side,start,end};
}
function fitRun(text,slotId,s){
 const t=slot(slotId,s),r=role(t.role,s),m=metrics(text,r.face),count=Array.from(text).length;
 const preferredCap=t.cap*r.capScale;let cap=preferredCap,span=t.span,tracking=Math.max(0,t.tracking+r.trackingEm),stage='natural';
 const getWidth=(size,tr)=>m.width*size+count*tr*size;
 const edge=t.endPad||12;
 let c=curve(t,cap,span),size=cap/m.cap;
 // Keep short names naturally sized. Only reduce tracking when it would overflow.
 if(getWidth(size,tracking)>c.length-2*edge){const minTr=Math.max(0,t.minTracking+r.trackingEm);tracking=Math.max(minTr,Math.min(tracking,((c.length-2*edge)/size-m.width)/Math.max(1,count)));stage='tracking';}
 if(getWidth(size,tracking)>c.length-2*edge&&t.maxSpan>span){let lo=span,hi=t.maxSpan;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(curve(t,cap,mid).length-2*edge<getWidth(size,tracking))lo=mid;else hi=mid;}span=hi;c=curve(t,cap,span);stage='arc-expanded';}
 // The baseline moves with the ink midpoint when the font size changes. Solve
 // again after each movement rather than scaling the glyph width or entire badge.
 for(let i=0;i<12;i++){c=curve(t,cap,span);size=cap/m.cap;const width=getWidth(size,tracking),available=Math.max(1,c.length-2*edge);if(width<=available+.001)break;cap*=available/width*.999;stage='uniform-shrink';}
 c=curve(t,cap,span);size=cap/m.cap;
 return {text,widthBasis:'browser advance',slot:slotId,role:t.role,face:r.face,family:m.family,weight:m.weight,size,cap,preferredCap,tracking:tracking*size,trackingEm:tracking,width:getWidth(size,tracking),available:c.length-2*edge,curve:c,stage,tooSmall:cap<t.minCap,minimum:t.minCap,ascent:m.ascent*size,descent:m.descent*size};
}
function textAttrs(f,colour){return{'font-family':f.family,'font-weight':f.weight,'font-size':round(f.size),'font-kerning':'normal','letter-spacing':round(f.tracking),style:'font-synthesis:none;white-space:pre','xml:space':'preserve',fill:colour};}
function curved(parent,defs,text,slotId,s,colour,id,report){if(!text?.trim())return;
 const f=fitRun(text,slotId,s);const pid=id+'-baseline';defs.append(node('path',{id:pid,d:f.curve.d,'data-baseline':slotId}));
 const e=node('text',{...textAttrs(f,colour),'text-anchor':'middle','data-slot':slotId,'data-role':f.role,'data-face':f.face,'data-live-text':id});
 const tp=node('textPath',{href:'#'+pid,startOffset:'50%',method:'align',spacing:'exact'},text);tp.setAttributeNS(XL,'xlink:href','#'+pid);e.append(tp);parent.append(e);report.push(f);return f;
}
function fitPlain(text,roleId,cap,width,s,tracking=0){
 const r=role(roleId,s),m=metrics(text,r.face),n=Math.max(0,Array.from(text).length-1);
 let size=cap*r.capScale/m.cap,tr=Math.max(0,tracking+r.trackingEm),stage='natural';
 // A straight lockup is constrained by visible ink, not the invisible final
 // letter-spacing interval or side bearings. A curved run reserves its full
 // browser advance, including that final interval, so no end glyph is clipped.
 const ink=Math.max(0,m.left+m.right),inkWidth=()=>size*(ink+n*tr);
 if(inkWidth()>width&&n){tr=Math.max(0,Math.min(tr,(width/size-ink)/n));stage='tracking';}
 const factor=Math.min(1,width/(inkWidth()||1));size*=factor;if(factor<.999)stage='uniform-shrink';
 return {text,role:roleId,face:r.face,family:m.family,weight:m.weight,cap:size*m.cap,preferredCap:cap*r.capScale,size,tracking:tr*size,trackingEm:tr,width:inkWidth(),widthBasis:'visible ink',advance:(m.width+(n+1)*tr)*size,ascent:m.ascent*size,descent:m.descent*size,left:m.left*size,stage,available:width,tooSmall:size*m.cap<20};
}
function plain(parent,f,x,y,colour,id,report){if(!f.text?.trim())return;const e=node('text',{...textAttrs(f,colour),x:round(x+f.left),y:round(y),'data-role':f.role,'data-face':f.face,'data-live-text':id},f.text);parent.append(e);report.push(f);return e;}
function recolour(el,theme,scene){
 const map={'#000000':theme.ink,'#ffffff':theme.paper,'#fff':theme.paper,'#231f20':theme.ink,'#1f1a17':theme.ink,'#15864a':theme.tree,'#185192':theme.wildlife,'#478cca':theme.water,'#604b3d':theme.earth,'#70c6ea':theme.sky,'#93d0aa':theme.distant,'#008450':theme.tree,'#0091c4':theme.water,'#4b3216':theme.earth,'#6dc9ef':theme.sky};
 for(const e of [el,...el.querySelectorAll('*')])for(const attr of ['fill','stroke']){const c=e.getAttribute?.(attr);if(c&&map[c.toLowerCase()])e.setAttribute(attr,map[c.toLowerCase()]);}
}
function use(id,attrs={}){const e=node('use',{href:'#'+id,...attrs});e.setAttributeNS(XL,'xlink:href','#'+id);return e;}
function sourceShape(defs,id,xml,theme,scene){const g=node('g',{id,'data-primitive':id});g.append(fragment(xml));recolour(g,theme,scene);defs.append(g);return id;}
function ribbon(defs,t,theme){
 const id='service-ribbon-primitive',g=node('g',{id,'data-primitive':'service-ribbon'}),source=node('g');source.append(fragment(ART.sourceRibbon));const d=source.querySelector('path').getAttribute('d');const outer=(d.match(/^\s*M[\s\S]*?(?=\s+M\s|$)/)||[])[0];if(outer)g.append(node('path',{d:outer,fill:theme.paper}));g.append(source);recolour(g,theme);defs.append(g);
 const transform=`translate(${CX} ${CY+t.y}) scale(${t.width} ${t.height}) translate(${-CX} ${-CY})`+(t.side==='top'?` rotate(180 ${CX} ${CY})`:'');return use(id,{transform,'data-layer':'tab-shape'});
}
function wings(){const g=node('g',{'data-layer':'tab-shape','data-fidelity':'photo-based approximation'});const d='M 106 350 L -297 350 Q -340 350 -326 383 Q -318 408 -270 410 Q -297 440 -241 448 Q -262 478 -205 482 Q -215 511 -149 516 L 112 516 L 160 438 Z';for(const mirror of [false,true]){const x=node('g',mirror?{transform:`translate(${2*CX} 0) scale(-1 1)`}:{});x.append(node('path',{d,fill:'#e4c681',stroke:'#172747','stroke-width':12,'stroke-linejoin':'round'}));for(const[a,b]of[[-279,402],[-249,440],[-212,478]])x.append(node('path',{d:`M ${a} ${b} H 106`,fill:'none',stroke:'#172747','stroke-width':5}));g.append(x);}g.append(node('path',{d:'M 27 656 Q 338 919 650 656 L 723 736 Q 338 1103 -46 736 Z',fill:'#ead49b',stroke:'#172747','stroke-width':13}));return g;}
function drawBadge(s,defs,theme,report){const crestId=effectiveCrest(s),c=P.CRESTS[crestId],t=P.TABS[s.tab],g=node('g',{'data-layer':'badge','data-crest':crestId});
 if(t.shape==='ribbon')g.append(ribbon(defs,t,theme));
 if(t.shape==='plate')g.append(node('rect',{'data-layer':'tab-shape','data-primitive':'plate',x:20,y:805,width:637,height:130,rx:3,fill:theme.paper,stroke:theme.ink,'stroke-width':16}));
 if(t.shape==='wings')g.append(wings());
 const frame=sourceShape(defs,'frame-'+c.scene,c.scene==='wildlife'?ART.wildlifeFrame:ART.treeFrame,theme,c.scene);g.append(use(frame,{'data-layer':'frame'}));
 if(c.scene==='wildlife')defs.append(fragment(ART.wildlifeClip));
 const scene=sourceShape(defs,'scene-'+c.scene,c.scene==='wildlife'?ART.wildlifeScene:ART.treeInner,theme,c.scene);g.append(use(scene,{'data-layer':'scene'}));
 if(c.separator!=='none'){const y=c.separatorY,dx=266*Math.sqrt(Math.max(0,1-((y-CY)/369)**2)),r=c.separatorSize,marks=node('g',{'data-layer':'separators',fill:theme.text});for(const x of[CX-dx,CX+dx])marks.append(c.separator==='circle'?node('circle',{cx:x,cy:y,r}):node('path',{d:`M ${x} ${y-r} l ${r} ${r} -${r} ${r} -${r} -${r} Z`}));g.append(marks);}
 const letters=node('g',{'data-layer':'live-lettering'});curved(letters,defs,s.content.upper,c.upper,s,theme.text,'upper',report);curved(letters,defs,s.content.lower,c.lower,s,theme.text,'lower',report);if(t.slot)curved(letters,defs,s.content.service,t.slot,s,t.shape==='wings'?'#8e3d2b':theme.text,'service',report);g.append(letters);return g;
}
function badgeBox(s){const t=P.TABS[s.tab];if(t.shape==='wings')return{x:-350,y:0,w:1376,h:965};if(t.side==='top')return{x:-20,y:-145,w:716,h:989};return{x:0,y:0,w:676,h:['plate','ribbon'].includes(t.shape)?945:844};}
function blockMetrics(s,l){const c=s.content;return[[c.word,'wordmark-heavy',l.wordCap,0],[c.descriptor,'descriptor-slab',l.descCap,.012],[c.district,'district-slab',l.districtCap,.008]].filter(a=>a[0]?.trim()).map(([text,r,cap,tr])=>fitPlain(text,r,cap,l.wordWidth,s,tr));}
function blockHeight(rows,gap){return rows.reduce((h,r)=>h+r.ascent+r.descent,0)+Math.max(0,rows.length-1)*gap;}
function wordBlock(g,s,l,theme,x,top,report,center=false){const rows=blockMetrics(s,l);let y=top;rows.forEach((f,i)=>{y+=f.ascent;plain(g,f,x+(center?(l.wordWidth-f.width)/2:0),y,i===0&&s.content.word?theme.word:theme.descriptor,'word-line-'+i,report);y+=f.descent+l.lineGap;});return rows;}
function uniqueIds(svg,prefix){const map=new Map();for(const e of svg.querySelectorAll('[id]')){map.set(e.id,prefix+e.id);e.id=prefix+e.id;}for(const e of[svg,...svg.querySelectorAll('*')])for(const a of[...e.attributes]){let v=a.value.replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${map.get(id)||id})`);if(a.localName==='href'&&v.startsWith('#'))v='#'+(map.get(v.slice(1))||v.slice(1));if(a.name==='aria-labelledby')v=v.split(' ').map(x=>map.get(x)||x).join(' ');if(v!==a.value)e.setAttributeNS(a.namespaceURI,a.name,v);}}
function makeLogo(input={},options={}){
 const s=normalise(input),theme={...P.THEMES[s.theme],...s.colours},report=[],warnings=[];const l=P.LOCKUPS[s.layout],bn=badgeBox(s);
 const svg=node('svg',{xmlns:NS,version:'1.1',role:'img','aria-labelledby':'title desc'});svg.setAttributeNS('http://www.w3.org/2000/xmlns/','xmlns:xlink',XL);
 svg.append(node('title',{id:'title'},Object.values(s.content).filter(Boolean).join(' — ')));svg.append(node('desc',{id:'desc'},'Reference-based reconstruction with shared vector primitives and editable text. Substitute fonts; not an authenticated official master. Font files are not embedded.'));
 const defs=node('defs');svg.append(defs);const composition=node('g',{'data-layer':'composition'});svg.append(composition);let nominal=bn;
 if(l.kind==='wordmark'){const rows=blockMetrics(s,l),h=blockHeight(rows,l.lineGap);wordBlock(composition,s,l,theme,0,0,report);nominal={x:0,y:0,w:l.wordWidth,h};}
 else{
  const badge=drawBadge(s,defs,theme,report);
  if(l.kind==='badge')composition.append(badge);
  else if(l.kind==='strip'){composition.append(node('rect',{'data-layer':'branch-strip',x:330,y:l.barY,width:l.width-330,height:l.height,fill:theme.strip}));composition.append(badge);const f=fitPlain(s.content.branch||'','branch-condensed',l.textCap,l.width-830,s,.003);plain(composition,f,756,l.barY+(l.height-f.ascent-f.descent)/2+f.ascent,theme.stripText,'branch-label',report);nominal={x:0,y:bn.y,w:l.width,h:bn.h};}
  else if(l.kind==='words'){composition.append(badge);const lines=(s.content.lines||'').split(/\r?\n/).filter(x=>x.trim());const rows=lines.map(text=>fitPlain(text,'plain-label',l.labelCap,l.wordWidth,s)),h=blockHeight(rows,l.lineGap);let y=(844-h)/2;rows.forEach((f,i)=>{y+=f.ascent;plain(composition,f,676+l.gap,y,theme.descriptor,'stacked-line-'+i,report);y+=f.descent+l.lineGap;});nominal={x:0,y:Math.min(bn.y,(844-h)/2),w:676+l.gap+l.wordWidth,h:Math.max(bn.h,h)};}
  else if(l.kind==='stacked'){const width=Math.max(bn.w,l.wordWidth);badge.setAttribute('transform',`translate(${(width-bn.w)/2-bn.x} ${-bn.y})`);composition.append(badge);const rows=blockMetrics(s,l),h=blockHeight(rows,l.lineGap);wordBlock(composition,s,l,theme,(width-l.wordWidth)/2,bn.h+l.gap,report,true);nominal={x:0,y:0,w:width,h:bn.h+l.gap+h};}
  else{composition.append(badge);const rows=blockMetrics(s,l),h=blockHeight(rows,l.lineGap);wordBlock(composition,s,l,theme,bn.x+bn.w+l.gap,(l.centerY||422)-h/2,report);nominal={x:bn.x,y:Math.min(bn.y,(844-h)/2),w:bn.w+l.gap+l.wordWidth,h:Math.max(bn.h,h)};}
 }
 const fontIds=[...new Set(report.map(r=>r.face))];for(const id of fontIds)if(fontState.get(id)?.status!=='ready')warnings.push({code:'FONT_FALLBACK',message:P.FACES[id].family+' '+P.FACES[id].weight+' is not verified. Load the reference faces or install that exact weight.'});
 for(const r of report)if(r.tooSmall)warnings.push({code:'SMALL_TEXT',message:`${r.slot||r.role}: fitted cap height ${r.cap.toFixed(1)}. Shorten the wording for a readable mark.`});
 if(P.recipe(s.recipe).excluded)warnings.push({code:'EXCLUDED_REFERENCE',message:'Fire Control is excluded from calibration. This is only a shared-component placeholder.'});
 if(s.tab==='airtanker')warnings.push({code:'APPROXIMATION',message:'Winged geometry remains a photographic approximation.'});
 measurementRoot().append(svg);let b;try{b=composition.getBBox();}catch{b={x:nominal.x,y:nominal.y,width:nominal.w,height:nominal.h};}
 const pad=10,x=Math.min(nominal.x,b.x)-pad,y=Math.min(nominal.y,b.y)-pad,right=Math.max(nominal.x+nominal.w,b.x+b.width)+pad,bottom=Math.max(nominal.y+nominal.h,b.y+b.height)+pad;
 const viewBox={x:round(x),y:round(y),w:round(right-x),h:round(bottom-y)};svg.remove();svg.setAttribute('viewBox',`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);svg.setAttribute('width',s.outputWidth);svg.setAttribute('height',round(s.outputWidth*viewBox.h/viewBox.w));
 const summary=report.map(({curve,family,...r})=>({...r,curve:curve?{span:curve.span,rx:curve.rx,ry:curve.ry}:undefined}));svg.insertBefore(node('metadata',{'data-engine':'bc-shared-primitives','data-version':'5'},JSON.stringify({configuration:s,resolved:summary})),defs);
 uniqueIds(svg,(options.prefix||'bc'+(++seq))+'-');return{svg,state:s,report:summary,warnings,viewBox,nominal,crest:effectiveCrest(s),fontIds};
}
async function render(input={},options={}){const s=normalise(input);const ids=Object.keys(P.ROLES).map(id=>role(id,s).face);await ensureFonts(ids,options.allowNetwork===true);return makeLogo(s,options);}
function serialise(result){return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(result.svg||result)+'\n';}
function base64(buffer){const bytes=new Uint8Array(buffer);let out='';for(let i=0;i<bytes.length;i+=32768)out+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(out);}
async function png(result,width=1600){
 await document.fonts.ready;const svg=result.svg.cloneNode(true);let css='';
 // Web-font bytes are used only in this transient rasterization image, then
 // discarded. They are not included in downloadable SVGs or source packages.
 for(const id of result.fontIds){const state=fontState.get(id),face=P.FACES[id];if(state?.source==='web')for(const item of state.loaded)css+=`@font-face{font-family:"${face.family}";font-style:normal;font-weight:${face.weight};src:url(data:font/woff2;base64,${base64(item.bytes)});${item.range?'unicode-range:'+item.range+';':''}}`;
 else if(state?.source==='local')css+=`@font-face{font-family:"${face.family}";font-weight:${face.weight};src:${face.locals.map(x=>'local("'+x+'")').join(',')}}`;
 }
 if(css)svg.querySelector('defs').append(node('style',{},css));
 const w=clamp(Math.round(width),100,6000),h=Math.round(w*result.viewBox.h/result.viewBox.w);if(w*h>32000000)throw Error('PNG is too large; reduce export width.');svg.setAttribute('width',w);svg.setAttribute('height',h);
 const url=URL.createObjectURL(new Blob([serialise(svg)],{type:'image/svg+xml'}));try{const img=new Image();await new Promise((ok,bad)=>{img.onload=ok;img.onerror=()=>bad(Error('SVG rasterization failed'));img.src=url;});const c=document.createElement('canvas');c.width=w;c.height=h;const context=c.getContext('2d');context.drawImage(img,0,0,w,h);return await new Promise((ok,bad)=>c.toBlob(b=>b?ok(b):bad(Error('PNG export failed')),'image/png'));}finally{URL.revokeObjectURL(url);}
}
function recipeState(id,shared={}){return normalise({recipe:id,roles:shared.roles||{},slots:shared.slots||{}});}
function dependencies(roleId){return P.RECIPES.filter(x=>!x.excluded).filter(r=>{const s=recipeState(r.id),c=P.CRESTS[s.crest],t=P.TABS[s.tab],l=P.LOCKUPS[s.layout];return [...(l.kind!=='wordmark'?[P.SLOTS[c.upper]?.role,P.SLOTS[c.lower]?.role,P.SLOTS[t.slot]?.role]:[]),...(l.kind==='wordmark'||l.kind==='horizontal'||l.kind==='stacked'?['wordmark-heavy','descriptor-slab',...(s.content.district?['district-slab']:[])]:[]),...(l.kind==='words'?['plain-label']:[]),...(l.kind==='strip'?['branch-condensed']:[])].includes(roleId);}).map(x=>x.name);}
global.BCLogo={P,ART,normalise,recipeState,makeLogo,render,serialise,png,metrics,fitRun,fitPlain,curve,effectiveCrest,role,slot,dependencies,ensureFonts,retryFonts,fontState,invalidateMetrics,node,clone};
})(window);
