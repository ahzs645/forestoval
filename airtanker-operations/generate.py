#!/usr/bin/env python3
"""Build a layered Airtanker Operations SVG from geometric primitives.

Standard library only. No raster image is loaded or traced.
The three labels remain live SVG text on independently adjustable paths.
"""
from __future__ import annotations
import argparse
from dataclasses import dataclass
from html import escape
from math import pi, sin, cos, sqrt
from pathlib import Path

@dataclass(frozen=True)
class Palette:
    navy: str = '#002950'
    gold: str = '#FFCA05'
    cream: str = '#FFECC0'
    red: str = '#EB001B'

CX = 724.0

def n(v: float) -> str:
    return f'{v:.3f}'.rstrip('0').rstrip('.')

def oval(rx: float, top: float, bottom: float, cy: float = 470) -> str:
    """An oval with elliptical upper/lower halves sharing one centreline.

    This is intentionally NOT a circle. The upper and lower vertical radii
    are independent, matching the taller upper half in the supplied image.
    """
    return (f'M {n(CX-rx)} {n(cy)} '
            f'A {n(rx)} {n(top)} 0 0 1 {n(CX+rx)} {n(cy)} '
            f'A {n(rx)} {n(bottom)} 0 0 1 {n(CX-rx)} {n(cy)} Z')

def half_ellipse(rx: float, ry: float, cy: float, upper: bool) -> str:
    sweep = 1 if upper else 0
    return (f'M {n(CX-rx)} {n(cy)} A {n(rx)} {n(ry)} '
            f'0 0 {sweep} {n(CX+rx)} {n(cy)}')

def half_length(rx: float, ry: float) -> float:
    # Simpson's rule for the half-ellipse length; used only for path offset.
    count = 800
    h = pi / count
    total = 0.0
    for i in range(count+1):
        t = -pi/2 + i*h
        value = sqrt((rx*cos(t))**2 + (ry*sin(t))**2)
        total += value * (1 if i in (0,count) else 4 if i%2 else 2)
    return total*h/3

# Authored branch silhouette. These are designed curves, not a raster contour.
HERO_TREE = '''M724 185
C731 198 736 203 744 208 Q750 212 742 214 L738 216
Q743 222 752 228 Q757 232 751 233 L748 234
Q756 241 762 243 Q770 248 756 251 L748 252
Q757 260 774 267 Q779 269 773 272 L770 274
Q779 279 783 282 Q787 286 778 288 Q761 293 745 287
Q738 285 742 291 Q749 299 756 304 L770 318
Q779 323 770 325 L760 329 Q748 324 756 334
Q775 341 786 348 Q798 355 788 358 L781 361
Q774 361 781 369 Q787 374 781 375 L776 376
Q770 377 779 379 L793 379 Q803 379 797 386
Q793 390 800 393 Q808 395 798 399 Q780 406 767 399
Q757 394 762 402 L770 409 Q776 412 770 415
L779 423 Q783 427 772 427 Q760 428 751 423
Q742 421 750 430 Q762 443 778 447 Q784 449 777 453
L771 455 Q779 461 790 463 Q800 466 787 472
Q777 478 758 479 L758 480 Q770 488 759 490
Q751 491 739 486 L739 664
C739 674 749 678 765 680 L765 690 H690 L690 681
C709 679 718 675 718 665 L718 482
Q718 477 714 480 Q700 490 689 490 Q676 492 685 484
L688 480 Q672 480 675 475 L681 468
Q675 470 663 466 Q653 464 660 459 Q671 451 681 443
Q685 437 697 433 L703 429 Q712 425 704 423
Q701 421 704 418 Q713 410 703 411 Q690 420 679 417
Q673 416 679 410 L683 404 Q665 406 665 402
L672 394 Q653 394 651 389 Q650 387 657 382
Q668 374 680 363 Q681 361 678 359 Q676 357 681 353
L693 344 Q704 336 694 337 Q681 342 668 338
Q652 338 661 331 L671 323 Q655 316 666 312
Q677 307 686 311 Q693 313 699 309 Q707 302 700 300
Q687 302 687 297 L690 292 Q676 297 670 293
Q666 292 672 285 L681 273 Q670 271 678 266
Q690 259 704 251 Q711 246 702 244 Q690 247 693 242
L703 227 Q696 230 696 225 Q696 222 704 215 L716 199 Z
M741 356 C738 354 737 358 741 364
C746 370 751 373 756 372 Q763 369 757 366 L746 360 Z'''

SMALL_PINE = '''M0 -40 L5 -33 L3 -31 L8 -25 L5 -23
L11 -17 L8 -15 L14 -8 L10 -7 L17 0 H-17
L-10 -7 L-14 -8 L-8 -15 L-11 -17 L-5 -23
L-8 -25 L-3 -31 L-5 -33 Z'''

WING_CONTOUR = '''M400 400 H111
C65 400 22 433 22 473 C22 499 39 520 61 532
C64 565 78 585 104 595 C109 626 123 646 154 657
C160 689 177 708 199 714 C207 750 234 772 271 772 H319'''

def label(ident: str, text: str, params: tuple[float,...], color: str,
          upper: bool = False) -> tuple[str,str]:
    rx,ry,cy,size,spacing,offset,wordspace = params
    path = f'<path id="{ident}-baseline" d="{half_ellipse(rx,ry,cy,upper)}"/>'
    start = 50 + offset/half_length(rx,ry)*100
    element = f'''<text id="{ident}" xml:space="preserve" fill="{color}"
      font-family="Roboto Condensed, Arial Narrow, sans-serif" font-weight="700" stroke="{color}" stroke-width="{n(size*0.014)}" stroke-linejoin="round" paint-order="stroke fill"
      font-size="{n(size)}" letter-spacing="{n(spacing)}"
      word-spacing="{n(wordspace)}" text-anchor="middle"
      style="font-kerning:none;font-variant-ligatures:none"><textPath href="#{ident}-baseline" xlink:href="#{ident}-baseline" startOffset="{n(start)}%">{escape(text)}</textPath></text>'''
    return path,element


def build_svg(palette: Palette = Palette(), upper_text: str = 'FOREST SERVICE',
              lower_text: str = 'BRITISH COLUMBIA',
              service_text: str = 'AIRTANKER OPERATIONS') -> str:
    p = palette
    # Independent profiles keep the letters away from the oval rings.
    # Font family is an approximation, not an authenticated original face.
    labels = [
        label('forest-service',upper_text,
              (207.73,266.11,406.75,87.20,-1.11,8.04,0.00),p.gold,True),
        label('british-columbia',lower_text,
              (282.16,328.88,497.84,84.00,9.00,-1.92,43.73),p.gold,False),
        label('airtanker-operations',service_text,
              (444.74,481.37,506.36,114.54,1.80,-5.55,40.13),p.red,False),
    ]
    defs_text='\n'.join(a for a,b in labels)
    gold_text='\n'.join(b for a,b in labels[:2])
    red_text=labels[2][1]
    tree_instances=[]
    # One small-tree master, used at different sizes rather than re-drawn.
    for i,(x,height,width) in enumerate([
        (590,33,0.70),(614,44,0.82),(639,43,0.85),(665,33,0.76),
        (688,33,0.73),(704,19,0.45),(758,34,0.73),(786,48,0.85),
        (811,33,0.77),(837,38,0.81),(860,30,0.69)]):
        tree_instances.append(f'<use id="distant-tree-{i+1}" href="#small-pine" xlink:href="#small-pine" transform="translate({x} 654) scale({width} {height/40})"/>')
    trees='\n'.join(tree_instances)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="1448" height="1086" viewBox="0 0 1448 1086" role="img"
     aria-labelledby="title description">
  <title id="title">Forest Service — British Columbia — Airtanker Operations</title>
  <desc id="description">Editable vector reconstruction from the supplied image,
  assembled from geometric ovals, mirrored wing instances, hand-authored landscape
  paths, reusable conifer symbols, and live text on paths. Not an official master.
  Flat colours replace the raster shading; the lettering is an approximation.</desc>
  <metadata>Authored reconstruction; no bitmap, raster contour tracing, or embedded font.
  Geometry source: generate.py. Palette: {p.navy}, {p.gold}, {p.cream}, {p.red}.</metadata>
  <defs>
    {defs_text}
    <path id="oval-master" d="{oval(335,450,411)}"/>
    <clipPath id="scene-window"><path d="{oval(195.5,297.5,260)}"/></clipPath>
    <path id="hero-conifer" d="{HERO_TREE}" fill-rule="evenodd"/>
    <path id="small-pine" d="{SMALL_PINE}"/>
    <path id="diamond" d="M0 -26 L24.5 0 L0 26 L-24.5 0 Z"/>
    <g id="wing-master">
      <path d="{WING_CONTOUR} H455 V400 Z" fill="{p.cream}"/>
      <path d="{WING_CONTOUR}" fill="none" stroke="{p.navy}" stroke-width="20"
            stroke-linejoin="round" stroke-linecap="butt"/>
      <path d="M22 472 H365 M61 535 H364 M104 598 H257 M154 658 H273 M199 715 H297"
            fill="none" stroke="{p.navy}" stroke-width="17" stroke-linecap="butt"/>
      <path d="M314 762 H320 V773 Z" fill="{p.cream}"/>
    </g>
  </defs>
  <g id="lower-band" inkscape:groupmode="layer" inkscape:label="01 · Lower service band">
    <path id="band-outline" d="{half_ellipse(465,455,590,False)} Z" fill="{p.navy}"/>
    <path id="band-face" d="{half_ellipse(445,435,590,False)} Z" fill="{p.cream}"/>
  </g>
  <g id="wings" inkscape:groupmode="layer" inkscape:label="02 · Mirrored wings">
    <use id="left-wing" href="#wing-master" xlink:href="#wing-master"/>
    <use id="right-wing" href="#wing-master" xlink:href="#wing-master" transform="translate(1448 0) scale(-1 1)"/>
  </g>
  <g id="oval-frame" inkscape:groupmode="layer" inkscape:label="03 · Oval frame">
    <use href="#oval-master" xlink:href="#oval-master" fill="{p.navy}"/>
    <path id="outer-gold-ring" d="{oval(308,420,383)}" fill="none" stroke="{p.gold}" stroke-width="20"/>
    <path id="inner-gold-ring" d="{oval(205,307,278)}" fill="none" stroke="{p.gold}" stroke-width="18"/>
  </g>
  <g id="landscape" inkscape:groupmode="layer" inkscape:label="04 · Landscape" clip-path="url(#scene-window)" fill="{p.gold}">
    <path id="mountain-ridge" d="M554 575 L594 549 L613 564 L623 560 L634 568 L667 545 L678 551 L709 525 L730 539 L754 532 L784 565 L799 556 L823 573 L855 552 L885 575 L895 574"
      fill="none" stroke="{p.gold}" stroke-width="8" stroke-linecap="butt" stroke-linejoin="round"/>
    <path id="near-ridge" d="M568 610 C591 602 615 588 635 593 S665 607 678 602 L697 594 L728 607 L775 594 Q786 591 799 597 Q811 603 824 601 L849 599 L882 611"
      fill="none" stroke="{p.gold}" stroke-width="7" stroke-linejoin="round"/>
    <g id="distant-forest">
      <path id="forest-ground" d="M579 643 H709 V655 H579 Z M749 643 H872 V655 H749 Z"/>
      {trees}
    </g>
    <path id="foreground-ground" d="M616 688 Q630 687 636 686 Q646 689 655 685 Q665 687 677 683 L694 683 Q710 679 721 679 L740 679 Q752 682 766 682 Q774 686 783 685 Q794 687 803 686 L829 689 L852 736 H596 Z"/>
    <use id="central-tree" href="#hero-conifer" xlink:href="#hero-conifer"/>
  </g>
  <g id="side-diamonds" fill="{p.red}" inkscape:groupmode="layer" inkscape:label="05 · Shared diamond markers">
    <use href="#diamond" xlink:href="#diamond" transform="translate(468 446)"/>
    <use href="#diamond" xlink:href="#diamond" transform="translate(980 446)"/>
  </g>
  <g id="oval-lettering" inkscape:groupmode="layer" inkscape:label="06 · Editable oval text">
    {gold_text}
  </g>
  <g id="service-lettering" inkscape:groupmode="layer" inkscape:label="07 · Editable service text">
    {red_text}
  </g>
</svg>
'''

def main() -> None:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output',type=Path,default=Path(__file__).with_name('airtanker-operations-editable.svg'))
    ap.add_argument('--navy',default=Palette.navy)
    ap.add_argument('--gold',default=Palette.gold)
    ap.add_argument('--cream',default=Palette.cream)
    ap.add_argument('--red',default=Palette.red)
    ap.add_argument('--upper-text',default='FOREST SERVICE')
    ap.add_argument('--lower-text',default='BRITISH COLUMBIA')
    ap.add_argument('--service-text',default='AIRTANKER OPERATIONS')
    args=ap.parse_args()
    import re
    for name in ('navy','gold','cream','red'):
        if not re.fullmatch(r'#[0-9a-fA-F]{6}',getattr(args,name)):
            ap.error(f'--{name} must be a six-digit hexadecimal colour, e.g. #002950')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(build_svg(Palette(args.navy,args.gold,args.cream,args.red),args.upper_text,args.lower_text,args.service_text),encoding='utf-8')
    print(args.output.resolve())

if __name__=='__main__':
    main()
