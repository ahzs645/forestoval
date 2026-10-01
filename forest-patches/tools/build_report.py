#!/usr/bin/env python3
"""Create the visual review PDF from the generated PNGs and original source crops."""
from pathlib import Path
import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from PIL import Image
from xml.sax.saxutils import escape
ROOT=Path(__file__).resolve().parents[1]
PS=json.loads((ROOT/'data/presets.json').read_text());SOURCES=json.loads((ROOT/'data/source-inventory.json').read_text());SM={s['sourceId']:s for s in SOURCES}
W,H=595.276,841.89;M=38;INK='#173f33';MUTED='#566b60';BG='#f0f4ee';GOLD='#a77925'
ST=ParagraphStyle('body',fontName='Helvetica',fontSize=10.4,leading=14.2,textColor=HexColor(INK))
SMALL=ParagraphStyle('small',parent=ST,fontSize=9.1,leading=12)
def paragraph(c,txt,x,top,w,style=ST):
 p=Paragraph(txt,style);_,h=p.wrap(w,1000);p.drawOn(c,x,top-h);return top-h

def image(c,f,x,y,w,h):
 im=Image.open(f);scale=min(w/im.width,h/im.height);dw=im.width*scale;dh=im.height*scale
 c.drawImage(ImageReader(im),x+(w-dw)/2,y+(h-dh)/2,dw,dh,mask='auto')
def footer(c,n):
 c.setStrokeColor(HexColor('#d2ddd4'));c.line(M,31,W-M,31);c.setFont('Helvetica',8);c.setFillColor(HexColor(MUTED));c.drawString(M,19,'BC forestry patch survey  /  Reference-based reconstruction drafts');c.drawRightString(W-M,19,str(n))
def head(c,kicker,title):
 c.setFillColor(HexColor(INK));c.setFont('Helvetica-Bold',8.5);c.drawString(M,H-40,kicker.upper());c.setFont('Helvetica-Bold',22);c.drawString(M,H-71,title)
def panel(c,p,top):
 x=M;w=W-2*M;c.setFillColor(HexColor(INK));c.setFont('Helvetica-Bold',13)
 short={'F08-long-wildfire':'Long ministry + Wildfire Service','F05-fire-control':'Forest Service shield + Fire Control'}
 title=p['id'][:3]+'  '+short.get(p['id'],p['label'].replace(' — ',' / '))
 top=paragraph(c,escape(title),x,top,w,ParagraphStyle('t',parent=ST,fontName='Helvetica-Bold',fontSize=13,leading=16))
 top-=5;c.setFillColor(HexColor(MUTED));c.setFont('Helvetica',9);c.drawString(x,top-9,p['group']+'  |  '+p['status']);top-=20
 boxy=top-207;c.setFillColor(HexColor(BG));c.roundRect(x,boxy,w,207,6,fill=1,stroke=0)
 col=(w-32)/2;image(c,ROOT/p['sourceCrop'],x+10,boxy+9,col,183);image(c,ROOT/'previews'/f'{p["id"]}.png',x+22+col,boxy+9,col,183)
 ids=['S'+str(i).zfill(2) for i in p.get('sourceIndices',[])];ids+=([p['pdfSource']['sourceId']] if p.get('pdfSource') else [])
 c.setFont('Helvetica',8);c.setFillColor(HexColor(MUTED));c.drawCentredString(x+10+col/2,boxy+3,'REFERENCE  '+', '.join(ids)+('  /  physical page 75' if p.get('pdfSource') else ''));c.drawCentredString(x+22+1.5*col,boxy+3,'VECTOR DRAFT')
 y=paragraph(c,escape(p['note']),x,boxy-8,w,SMALL)
 for sid in ids:
  url=SM[sid]['driveUrl'];c.setFont('Helvetica',8);c.setFillColor(HexColor('#286747'));c.drawString(x,y-13,sid+'  Open source in Drive');c.linkURL(url,(x,y-16,x+145,y-3),relative=0);x+=160
 return y-18

def build():
 out=ROOT/'forest-patches-review.pdf';c=canvas.Canvas(str(out),pagesize=(W,H));c.setTitle('British Columbia forestry patches — source survey and vector drafts');c.setAuthor('Prepared for Ahmad Jalil');c.setSubject('59-file survey, 10 source-linked vector drafts; not official identity masters.')
 head(c,'Source inventory + vector workshop','British Columbia forestry patches')
 y=paragraph(c,'<b>59 files reviewed · 57 images · 2 PDFs · 109 PDF pages</b><br/>Ten editable reconstruction entries, with source photographs kept beside the drafts.',M,H-92,W-2*M)
 y=paragraph(c,'Six Forestry cloth designs, one related Parks cloth design, one unconfirmed cloth design and two non-patch emblems. The ten entries are not ten verified Ministry-issued patches.',M,y-13,W-2*M)
 y=paragraph(c,'The supplied folder was reviewed at file level. All PDF pages were visually screened; the large crest on physical page 75 of the FOI package was examined at full source resolution. Tiny, blurred collector-board fragments are not confidently identifiable.',M,y-12,W-2*M)
 # Compact overview, all 10 proof exports.
 gridtop=y-22;cw=(W-2*M)/5;ch=145
 for i,p in enumerate(PS):
  x=M+(i%5)*cw;yy=gridtop-(i//5+1)*ch
  image(c,ROOT/'previews'/f'{p["id"]}.png',x+6,yy+23,cw-12,ch-36);c.setFillColor(HexColor(MUTED));c.setFont('Helvetica-Bold',9);c.drawCentredString(x+cw/2,yy+8,p['id'][:3])
 y=gridtop-2*ch-20
 y=paragraph(c,'<b>Use the companion catalogue.</b> Open <b>index.html</b> for all comparisons, the searchable 59-file register, SVG downloads and custom live-lettering controls. Outlined SVGs are font-independent; editable text requires the chosen local typefaces.',M,y,W-2*M)
 y=paragraph(c,'<b>Important limits.</b> Historical tree scenery still needs its own primitives. The map/animal and shoulder drafts are exploratory. Colours are visual estimates, not verified thread specifications. No patch adoption dates are inferred from the source filenames.',M,y-14,W-2*M)
 footer(c,1);c.showPage()
 for k in range(5):
  head(c,'Reference on left / reconstruction on right',f'Comparison sheet {k+1} of 5')
  panel(c,PS[2*k],H-91);panel(c,PS[2*k+1],H-447)
  footer(c,k+2);c.showPage()
 head(c,'Evidence, reuse and next steps','What the survey establishes')
 y=H-96
 blocks=[
 ('The clean Ministry of Forests crest','Physical page 75 of Response_Package_FOR-2023-32179.pdf provides a large wildlife crest with “British Columbia” above and “Ministry of Forests” below. It is valuable artwork evidence, but it does not establish a cloth patch issue or adoption date.'),
 ('Different shapes need different renderers','The shoulder rocker is not the Airtanker winged badge. The Fire Control example uses a tapered shield, a provincial crest and a separate upper tab. The map/animal rectangle and unlabelled map/tree square cannot be recreated by changing oval text alone.'),
 ('What was actually reused','All 11 forestoval ART strings were checked against its current hash manifest at commit 244276dcf0b55e14b694b5cee569c78a978cc734. Its shared frame and scenes are used in these drafts. The PofBC adapter targets the PROVINCIAL_MARK export; the delivered shield currently uses supplementary original editable provincial artwork, not a claimed byte-identical PofBC asset.'),
 ('Items deliberately kept separate','The inventory includes numerous Parks patches and metal badges, Forestry metal badges, decals, posters, vessel markings and other archival material. S15/S16 are an exact duplicate. S50 remains unresolved; the blurred wording has not been invented. S32 identification-card imagery is not reproduced.'),
 ('Before a production-quality reconstruction','Add historic tree/mountain/water variants; fit lettering to each specimen; obtain clearer images for the map/animal and unresolved oval; confirm dates independently; and specify physical dimensions, thread colours, borders and stitch construction with the maker. These SVGs are not stitch files.'),
 ('Validation performed','Twenty SVGs passed XML, internal-reference, unique-ID, raster-free and text-fit checks. The self-contained catalogue was exercised in headless Chromium at desktop and mobile widths, including filtering and live text editing. These checks establish technical usability, not photographic fidelity or official approval.')]
 for title,body in blocks:
  y=paragraph(c,'<b>'+escape(title)+'</b>',M,y,W-2*M);y=paragraph(c,escape(body),M,y-4,W-2*M);y-=15
 footer(c,7);c.save();print(out)
if __name__=='__main__':build()
