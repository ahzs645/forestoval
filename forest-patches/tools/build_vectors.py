#!/usr/bin/env python3
"""Build reference-based patch vectors. Requires lxml, fonttools, Pillow, numpy.
No fonts are embedded or copied. Choose locally licensed fonts with the CLI flags.
"""
from __future__ import annotations
import argparse, copy, json, math, re
from pathlib import Path
import numpy as np
from lxml import etree as E
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from PIL import ImageFont
NS='http://www.w3.org/2000/svg'; XL='http://www.w3.org/1999/xlink'
ROOT=Path(__file__).resolve().parents[1]
def el(tag, **attrs):
    return E.Element('{'+NS+'}'+tag, **{k.replace('_','-'):str(v) for k,v in attrs.items()})
def append_xml(parent, xml):
    wrapper=E.fromstring(('<svg xmlns="'+NS+'">'+xml+'</svg>').encode())
    for c in list(wrapper): parent.append(c)
def elem_xml(e): return E.tostring(e, encoding='unicode')
def path(d,fill,**kw): return el('path', d=d, fill=fill, **kw)
def esc(s): return str(s)
class Font:
    def __init__(self, file, name):
        self.tt=TTFont(file); self.gs=self.tt.getGlyphSet(); self.cmap=self.tt.getBestCmap(); self.up=self.tt['head'].unitsPerEm
        self.pil=ImageFont.truetype(str(file), 1000); self.name=name; self.cache={}
    def width(self,text,size): return float(self.pil.getlength(text))*size/1000
    def d(self,ch):
        name=self.cmap.get(ord(ch))
        if not name:return ''
        if name not in self.cache:
            p=SVGPathPen(self.gs); self.gs[name].draw(p); self.cache[name]=p.getCommands()
        return self.cache[name]
FONTS={}
class Renderer:
    def __init__(self,preset, outlined=False):
        self.p=preset; self.outlined=outlined; self.r=el('svg', nsmap=None) if False else E.Element('{'+NS+'}svg', nsmap={None:NS,'xlink':XL})
        self.r.set('viewBox',preset.get('viewBox','-10 -10 696 880')); self.r.set('width','1000')
        vals=list(map(float,self.r.get('viewBox').split()));self.r.set('height',str(round(1000*vals[3]/vals[2],3)))
        title=el('title');title.text=preset['label'];self.r.append(title)
        desc=el('desc');desc.text='Reference-based reconstruction. Not an official master or an embroidery stitch file. '+preset['note'];self.r.append(desc)
        self.defs=el('defs');self.r.append(self.defs);self.body=el('g',id='patch');self.r.append(self.body);self.runs=[];self.seq=0
    def text(self,text,size,colour,font='condensed', *, cx=338.36631,cy=420.96480, rx=None,ry=None,start=None,end=None,width=None,x=None,y=None,tracking=0, parent=None):
        if not text:return
        p=parent if parent is not None else self.body; f=FONTS[font];self.seq+=1
        missing=sorted({ch for ch in text if not ch.isspace() and ord(ch) not in f.cmap})
        if missing: raise ValueError(f'Unsupported glyphs in {self.p["id"]}: {missing}')
        if rx is not None:
            ang=np.linspace(math.radians(start),math.radians(end),2401);xy=np.stack([cx+rx*np.cos(ang),cy+ry*np.sin(ang)],axis=1)
            lengths=np.r_[0,np.cumsum(np.linalg.norm(np.diff(xy,axis=0),axis=1))];available=float(lengths[-1])-20
        else:available=width or 620
        base=size;tracking=max(0,tracking)
        w=lambda sz,tr: f.width(text,sz)+max(0,len(text)-1)*tr
        if w(size,tracking)>available:tracking=0
        if w(size,tracking)>available:size*=available/w(size,tracking)
        total=w(size,tracking);self.runs.append({'text':text,'font':f.name,'size':round(size,4),'preferredSize':base,'available':round(available,3),'width':round(total,3),'tracking':tracking,'shrink':round(size/base,4)})
        g=el('g',id=f'lettering-{self.seq}',**{'data-label':text});p.append(g)
        if rx is not None:
            shift=(float(lengths[-1])-total)/2
            pid=f'baseline-{self.seq}'
            large=1 if abs(end-start)>180 else 0;sweep=1 if end>start else 0
            self.defs.append(path(f'M {xy[0,0]:.5f} {xy[0,1]:.5f} A {rx} {ry} 0 {large} {sweep} {xy[-1,0]:.5f} {xy[-1,1]:.5f}','none',id=pid))
        if not self.outlined:
            t=el('text',fill=colour,font_family=f.name,font_weight='800' if font=='heavy' else ('400' if font=='thin' else '700'),font_size=f'{size:.5f}',letter_spacing=tracking,text_anchor='middle',**{'data-preferred-size':base,'data-available':available,'data-font-key':font})
            if rx is not None:
                tp=el('textPath',href='#'+pid,startOffset='50%');tp.set('{'+XL+'}href','#'+pid);tp.text=text;t.append(tp)
            else:t.set('x',str(x));t.set('y',str(y));t.text=text
            g.append(t);return
        # Measure the same locally installed typeface, then place its actual outlines.
        for i,ch in enumerate(text):
            before=f.width(text[:i],size)+i*tracking
            advance=f.width(text[:i+1],size)-f.width(text[:i],size)
            mid=before+advance/2
            if rx is not None:
                a=float(np.interp(shift+mid,lengths,ang));dir=1 if end>start else -1
                px=cx+rx*math.cos(a);py=cy+ry*math.sin(a)
                rot=math.degrees(math.atan2(ry*math.cos(a)*dir,-rx*math.sin(a)*dir))
            else:px=x-total/2+mid;py=y;rot=0
            d=f.d(ch)
            if d:
                group=el('g',transform=f'translate({px:.5f} {py:.5f}) rotate({rot:.5f}) scale({size/f.up:.8f} {-size/f.up:.8f}) translate({-advance/2*f.up/size:.5f} 0)')
                group.append(path(d,colour));g.append(group)
    def palette(self):return self.p['palette']
    def recolour(self,xml):
        p=self.palette();maps={'#000000':p['ink'],'#231f20':p['ink'],'#1f1a17':p['ink'],'#ffffff':p['snow'],'#fff':p['snow'],'#15864a':p['tree'],'#185192':p['animal'],'#478cca':p['water'],'#604b3d':p['earth'],'#70c6ea':p['sky'],'#93d0aa':p['distant'],'#008450':p['tree'],'#0091c4':p['mountain'],'#4b3216':p['earth'],'#6dc9ef':p['sky']}
        g=E.fromstring(('<svg xmlns="'+NS+'">'+xml+'</svg>').encode())
        for n in g.iter():
            for k in ['fill','stroke']:
                if n.get(k,'').lower() in maps:n.set(k,maps[n.get(k).lower()])
        return ''.join(elem_xml(c) for c in g)
    def crest(self,scene='tree',parent=None,scale=None,labels=True):
        p=self.palette();g=el('g',id='shared-crest');(parent if parent is not None else self.body).append(g)
        if scale:g.set('transform',scale)
        g.append(el('ellipse',cx=338.33727,cy=420.96942,rx=326.9275,ry=414.76718,fill=p['ink']))
        g.append(el('ellipse',cx=338.32256,cy=420.96096,rx=310.34551,ry=398.06377,fill=p['paper']))
        g.append(el('ellipse',cx=338.35305,cy=420.94316,rx=222.52573,ry=313.12995,fill=p.get('inner',p['ink'])))
        append_xml(self.defs,ART['wildlifeClip'])
        if scene=='wildlife':append_xml(g,self.recolour(ART['wildlifeScene']))
        else:
            sceneG=el('g',clip_path='url(#landscape-clip)',id='tree-scene');g.append(sceneG)
            sceneG.append(el('ellipse',cx=338.36631,cy=420.96480,rx=206.03861,ry=296.59750,fill=p['sky']))
            src=E.fromstring(('<g xmlns="'+NS+'">'+ART['treeScene']+'</g>').encode())
            # Match current forestoval: remove source sky oval; use shared window and centre offset.
            src.remove(src[0]);src.set('transform','translate(1.24881 1.62174) '+ART['treeSourceTransform'])
            append_xml(sceneG,self.recolour(elem_xml(src)))
        if labels:
            l=self.p.get('lettering',{});islong=scene=='wildlife'
            self.text(self.p.get('upper',''),l.get('upperSize',73),p['text'],font=l.get('upperFont','condensed'),rx=l.get('upperRx',242),ry=l.get('upperRy',329),start=-90-l.get('upperSpan',170)/2,end=-90+l.get('upperSpan',170)/2,parent=g,tracking=l.get('tracking',0))
            self.text(self.p.get('lower',''),l.get('lowerSize',72),p['text'],font=l.get('lowerFont','heavy'),rx=l.get('lowerRx',289),ry=l.get('lowerRy',379),start=90+l.get('lowerSpan',184)/2,end=90-l.get('lowerSpan',184)/2,parent=g,tracking=l.get('tracking',0))
            sep=self.p.get('separators','diamond' if scene=='tree' else 'circle')
            if sep!='none':
                yy=l.get('separatorY',397.65 if scene=='tree' else 215);rad=l.get('separatorRadius',11 if scene=='tree' else 9)
                dx=266*math.sqrt(max(0,1-((yy-420.9648)/369)**2))
                for xx in [338.36631-dx,338.36631+dx]:
                    g.append(el('circle',cx=xx,cy=yy,r=rad,fill=p['text']) if sep=='circle' else path(f'M {xx} {yy-rad} l {rad} {rad} -{rad} {rad} -{rad} -{rad} Z',p['text']))
        return g
    def lower_tab(self):
        p=self.palette();# parametric band around shared oval, not traced stitching
        cx,cy=338.36631,420.9648;span=52
        pts=[]
        for rxx,ryy,a,b in [(420,510,90+span,90-span),(340,411,90-span,90+span)]:
            pts.extend((cx+rxx*math.cos(math.radians(t)),cy+ryy*math.sin(math.radians(t))) for t in np.linspace(a,b,90))
        d='M '+' L '.join(f'{x:.3f} {y:.3f}' for x,y in pts)+' Z'
        self.body.append(path(d,p['paper'],stroke=p['ink'],stroke_width=17,stroke_linejoin='round',id='lower-service-tab'))
    def provincial_mark(self):
        # Supplementary editable master, with PofBC import hook. One-ink negative spaces remain transparent.
        mark=E.parse(str(ROOT/'assets/provincial-crest.svg')).getroot();vb=list(map(float,mark.get('viewBox').split()))
        mask=el('mask',id='provincial-mask',maskUnits='userSpaceOnUse',x=0,y=0,width=497.02,height=497.19)
        for c in mark:
            if E.QName(c).localname not in ['title','desc','metadata']:mask.append(copy.deepcopy(c))
        self.defs.append(mask)
        g=el('g',transform='translate(218 349) scale(.4825)',id='provincial-crest');g.append(el('rect',x=0,y=0,width=497.02,height=497.19,fill=self.palette()['text'],mask='url(#provincial-mask)'));self.body.append(g)
    def draw(self):
        p=self.palette();fam=self.p['family']
        if fam in ['tree','wildlife','parks']:
            if self.p.get('tab')=='WILDFIRE SERVICE':self.lower_tab()
            if fam=='parks':self.body.append(el('rect',x=70,y=791,width=537,height=123,rx=6,fill=p['paper'],stroke=p['ink'],stroke_width=17,id='parks-plate'))
            self.crest('wildlife' if fam=='wildlife' else 'tree')
            if self.p.get('tab')=='WILDFIRE SERVICE':self.text(self.p['tab'],69,p['text'],'heavy',rx=401,ry=481,start=139,end=41,tracking=1)
            if fam=='parks':self.text('PARKS',89,p['text'],'thin',x=338,y=890,width=480,tracking=3)
        elif fam=='shoulder':
            # This is a Forest Service shoulder rocker, NOT Airtanker Operations wings.
            self.body.append(path('M 37 419 Q 335 194 639 419 L 602 489 Q 338 321 74 489 Z',p['paper'],stroke='#19433b',stroke_width=14,stroke_linejoin='round',id='shoulder-rocker'))
            self.crest('tree',scale='translate(236 239) scale(.30)',labels=False)
            self.text('BRITISH',88,p['text'],'condensed',rx=234,ry=330,start=-171,end=-9,parent=self.body[-1])
            self.text('COLUMBIA',84,p['text'],'condensed',rx=285,ry=379,start=182,end=-2,parent=self.body[-1])
            self.text('FOREST',42,p['text'],'regular',cx=338,cy=857,rx=575,ry=458,start=-119,end=-100)
            self.text('SERVICE',42,p['text'],'regular',cx=338,cy=857,rx=575,ry=458,start=-80,end=-64)
        elif fam=='shield':
            self.body.append(path('M 70 148 Q 338 -9 606 148 L 589 224 Q 338 66 87 224 Z',p['paper'],stroke=p['ink'],stroke_width=16,stroke_linejoin='round',id='fire-control-rocker'))
            self.body.append(path('M 58 307 Q 338 157 618 307 L 554 785 Q 338 833 122 785 Z',p['paper'],stroke=p['ink'],stroke_width=18,stroke_linejoin='round',id='forest-service-shield'))
            self.text('FIRE CONTROL',58,p['text'],'regular',cx=338,cy=677,rx=410,ry=553,start=-128,end=-52)
            self.text('BRITISH COLUMBIA',47,p['text'],'regular',cx=338,cy=851,rx=460,ry=542,start=-125,end=-55)
            self.provincial_mark()
            self.text('FOREST',54,p['text'],'regular',x=338,y=688,width=415)
            self.text('SERVICE',54,p['text'],'regular',x=338,y=751,width=415)
        elif fam in ['map-tree','map-deer']:
            deer=fam=='map-deer';h=820 if deer else 676
            self.body.append(el('rect',x=25,y=25,width=626,height=h-50,rx=40 if deer else 9,fill=p['paper'],stroke=p['ink'],stroke_width=18,id='patch-base'))
            g=el('g',transform='translate(40 150) scale(.9)' if deer else 'translate(39 45) scale(.9)',id='map-emblem');self.body.append(g)
            # Deliberately schematic emblem map, not GIS boundary data or a verified original master.
            g.append(path('M 71 121 L 370 121 L 333 174 L 313 218 L 373 289 L 343 322 L 497 485 L 285 485 L 242 444 L 222 400 L 193 380 L 176 348 L 149 334 L 161 303 L 145 284 L 178 254 L 141 222 L 123 174 Z',p['map'],stroke=p.get('mapEdge','none'),stroke_width=13,stroke_linejoin='round',id='bc-map-main'))
            g.append(path('M 152 354 L 170 368 L 189 401 L 208 429 L 231 451 L 245 477 L 220 467 L 201 447 L 182 424 L 169 398 Z',p['map'],id='vancouver-island'))
            g.append(path('M 439 100 L 526 319 L 457 319 L 457 355 L 426 355 L 426 319 L 358 319 Z',p['tree'],stroke=p.get('treeEdge','none'),stroke_width=13,stroke_linejoin='round',id='triangle-tree'))
            if deer:
                g.append(path('M 213 327 Q 228 302 282 306 L 345 295 L 376 253 L 391 226 L 422 217 L 435 208 L 437 224 L 421 234 L 413 269 L 397 290 L 389 337 L 374 365 L 374 426 L 361 443 L 350 440 L 357 427 L 350 376 L 308 353 L 280 357 L 261 389 L 249 425 L 233 436 L 221 432 L 235 418 L 240 371 L 216 354 L 199 335 L 180 322 L 191 315 Z',p['deer'],id='ungulate-schematic'))
                self.text('B.C.',62,p['text'],'condensed',x=338,y=122,width=500)
                self.text('FOREST SERVICE',59,p['text'],'condensed',x=338,y=738,width=555)
        else:raise ValueError(f'Unknown family {fam}')
        meta=el('metadata');meta.text=json.dumps({'preset':self.p,'textFit':self.runs,'outlined':self.outlined,'fontFilesEmbedded':False},ensure_ascii=False);self.r.insert(2,meta)
        # Make all ids unique per SVG so multiple inline previews never collide.
        prefix=self.p['id']+'-';ids={n.get('id'):prefix+n.get('id') for n in self.r.iter() if n.get('id')}
        for n in self.r.iter():
            if n.get('id'):n.set('id',ids[n.get('id')])
            for k,v in list(n.attrib.items()):
                v=re.sub(r'url\(#([^\)]+)\)',lambda m:'url(#'+ids.get(m.group(1),m.group(1))+')',v)
                if E.QName(k).localname=='href' and v.startswith('#'):v='#'+ids.get(v[1:],v[1:])
                n.set(k,v)
        return E.tostring(self.r,encoding='utf-8',xml_declaration=True,pretty_print=True)
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--condensed',default='/usr/share/fonts/truetype/roboto/unhinted/RobotoCondensed-Bold.ttf');ap.add_argument('--heavy',default='/usr/share/fonts/truetype/open-sans/OpenSans-ExtraBold.ttf');ap.add_argument('--thin',default='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Regular.ttf');ap.add_argument('--regular',default='/usr/share/fonts/truetype/roboto/unhinted/RobotoTTF/Roboto-Bold.ttf');a=ap.parse_args()
    for k,name in [('condensed','Roboto Condensed'),('heavy','Open Sans'),('regular','Roboto'),('thin','Roboto')]:
        p=Path(getattr(a,k))
        if not p.exists():raise SystemExit(f'Missing {k} font {p}; pass --{k} /path/to/your/font.ttf')
        FONTS[k]=Font(p,name)
    global ART;ART=json.loads((ROOT/'assets/forestoval-art.json').read_text())
    presets=json.loads((ROOT/'data/presets.json').read_text())
    fits={}
    for p in presets:
        for outlined,folder in [(False,'editable'),(True,'outlined')]:
            r=Renderer(p,outlined); b=r.draw();(ROOT/'svg'/folder/(p['id']+'.svg')).write_bytes(b)
            if outlined:fits[p['id']]=r.runs
    (ROOT/'reports/text-fit.json').write_text(json.dumps(fits,indent=2))
    print(f'Built {len(presets)} editable and {len(presets)} outlined SVGs.')
if __name__=='__main__':main()
