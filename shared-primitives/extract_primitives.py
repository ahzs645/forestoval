#!/usr/bin/env python3
"""Isolate the shared vector building blocks into standalone SVG files.

Sources (read only, never modified):
  ../bc-ministry-primitives-v5/data/art.json        artwork master strings
  ../bc-ministry-primitives-v5/src/primitives.js    themes, crest profiles, and the
                                                    shapes the engine draws itself
  ../airtanker-operations/airtanker-operations-editable.svg
  ../airtanker-operations/generate.py               the package palette

The few v5 shapes that exist only as engine code (ribbon backing, Parks plate,
wings, separators) are drawn from the same primitives.js tables the engine
uses (SHAPES, CRESTS, RECOLOUR), so the two cannot drift. Each output keeps
its original coordinates; only the viewBox is cropped, so any piece can be
pasted back into its family's coordinate space and still line up.
Standard library only.
"""
import argparse, copy, importlib.util, json, math, re, sys
from pathlib import Path
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
V5 = ROOT / 'bc-ministry-primitives-v5'
AIR = ROOT / 'airtanker-operations'
SVG, XL, INK = 'http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xlink', 'http://www.inkscape.org/namespaces/inkscape'
ET.register_namespace('', SVG)
ET.register_namespace('xlink', XL)


# ------------------------------------------------------- v5 source tables --
def js_table(js, name):
    """The object literal `const NAME={...};` in primitives.js, as Python data.
    The tables are plain data (quoted strings, numbers, arrays, objects), so a
    light conversion to JSON is enough; anything else fails loudly."""
    m = re.search(r'\bconst %s=\{' % name, js)
    if not m: raise SystemExit('primitives.js: no table %s' % name)
    i, depth, quote, escaped = m.end() - 1, 0, None, False
    for j in range(i, len(js)):
        c = js[j]
        if quote:
            if escaped: escaped = False
            elif c == '\\': escaped = True
            elif c == quote: quote = None
        elif c in '\'"': quote = c
        elif c in '{[': depth += 1
        elif c in '}]':
            depth -= 1
            if not depth: break
    text = js[i:j + 1]
    text = re.sub(r"'([^'\\\"]*)'", r'"\1"', text)                     # 'x' -> "x"
    text = re.sub(r'([{,]\s*)([A-Za-z_$][\w$]*)\s*:', r'\1"\2":', text)  # key: -> "key":
    text = re.sub(r'(?<=[:\[,\s-])\.(\d)', r'0.\1', text)                  # .5 -> 0.5
    try: return json.loads(text)
    except ValueError as e: raise SystemExit('primitives.js: table %s is not plain data (%s)' % (name, e))


PRIMITIVES_JS = (V5 / 'src/primitives.js').read_text(encoding='utf-8')
SHAPES = js_table(PRIMITIVES_JS, 'SHAPES')
CRESTS = js_table(PRIMITIVES_JS, 'CRESTS')
# engine.js recolour(): source paint -> theme token.
SOURCE_TOKENS = js_table(PRIMITIVES_JS, 'RECOLOUR')
CX, CY = SHAPES['centre']  # v5 crest centre


def package_generator():
    """airtanker-operations/generate.py as a module (for its palette)."""
    name = 'airtanker_generate'
    if name not in sys.modules:
        spec = importlib.util.spec_from_file_location(name, AIR / 'generate.py')
        sys.modules[name] = importlib.util.module_from_spec(spec)  # dataclasses look the module up while it loads
        spec.loader.exec_module(sys.modules[name])
    return sys.modules[name]


def q(tag): return '{%s}%s' % (SVG, tag)
def local(tag): return tag.rsplit('}', 1)[-1]


# ---------------------------------------------------------------- geometry --
IDENTITY = (1, 0, 0, 1, 0, 0)
RIDGE_WIDTH = 7  # crest units: the mountain ridge line (single-colour and airtanker crests)
NUM = re.compile(r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')


def mul(a, b):
    return (a[0]*b[0] + a[2]*b[1], a[1]*b[0] + a[3]*b[1], a[0]*b[2] + a[2]*b[3],
            a[1]*b[2] + a[3]*b[3], a[0]*b[4] + a[2]*b[5] + a[4], a[1]*b[4] + a[3]*b[5] + a[5])


def parse_transform(text):
    m = IDENTITY
    for name, args in re.findall(r'(\w+)\s*\(([^)]*)\)', text or ''):
        v = [float(x) for x in NUM.findall(args)]
        if name == 'translate': t = (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0)
        elif name == 'scale': t = (v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0)
        elif name == 'matrix': t = tuple(v)
        elif name == 'rotate':
            a = math.radians(v[0]); t = (math.cos(a), math.sin(a), -math.sin(a), math.cos(a), 0, 0)
            if len(v) == 3: t = mul(mul((1, 0, 0, 1, v[1], v[2]), t), (1, 0, 0, 1, -v[1], -v[2]))
        else: raise ValueError('Unsupported transform ' + name)
        m = mul(m, t)
    return m


def apply(m, p): return (m[0]*p[0] + m[2]*p[1] + m[4], m[1]*p[0] + m[3]*p[1] + m[5])


class _Scan:
    def __init__(self, d): self.d, self.i = d, 0
    def skip(self):
        while self.i < len(self.d) and self.d[self.i] in ' \t\r\n,': self.i += 1
    def more(self):
        self.skip(); return self.i < len(self.d) and not self.d[self.i].isalpha()
    def cmd(self):
        self.skip(); self.i += 1; return self.d[self.i - 1]
    def num(self):
        self.skip(); m = NUM.match(self.d, self.i); self.i = m.end(); return float(m.group())
    def flag(self):  # arc flags may be packed: "a1 1 0 01.5.5"
        self.skip(); self.i += 1; return int(self.d[self.i - 1])


def ridge_line(d):
    """The top edge of a filled range outline, as an open polyline. The outline
    starts with straight segments (M/L/H/V); the top edge is the longest run of them
    that heads right to left (the ends climb or drop the other way)."""
    sc, pts, x, y, prev = _Scan(d), [], 0.0, 0.0, ''
    while sc.i < len(d):
        c = sc.cmd() if not sc.more() else {'M': 'L', 'm': 'l'}.get(prev, prev)
        C, rel = c.upper(), c.islower()
        if C not in 'MLHV': break
        if C == 'H': x = x * rel + sc.num()
        elif C == 'V': y = y * rel + sc.num()
        else:
            dx, dy = sc.num(), sc.num()
            x, y = (x + dx, y + dy) if rel else (dx, dy)
        pts.append((x, y)); prev = c
    best, run = (0, 0), 0
    for i in range(1, len(pts)):
        run = run + 1 if pts[i][0] < pts[i - 1][0] else 0
        if run > best[1] - best[0]: best = (i - run, i)
    r = lambda v: format(round(v, 4), 'g')
    return 'M ' + ' L '.join('%s %s' % (r(px), r(py)) for px, py in pts[best[0]:best[1] + 1])


def base_line(d):
    """The bottom edge of the same range outline, as an open path. After the top
    edge (see ridge_line) the outline drops at the left end, runs back along the
    foot of the range in straight and curved segments, and climbs at the right end
    to close. The foot is the run of segments heading right that are wider than
    they are tall; the drops at either end are taller than they are wide."""
    sc, segs, x, y, prev, ctrl = _Scan(d), [], 0.0, 0.0, '', None
    sx, sy = 0.0, 0.0
    while sc.i < len(d):
        c = sc.cmd() if not sc.more() else {'M': 'L', 'm': 'l'}.get(prev, prev)
        C, rel = c.upper(), c.islower()
        if C == 'Z':
            segs.append(('L', (x, y), [(sx, sy)])); x, y = sx, sy; prev = c; continue
        pt = lambda: (lambda dx, dy: (x + dx, y + dy) if rel else (dx, dy))(sc.num(), sc.num())
        if C == 'M':
            x, y = pt(); sx, sy = x, y; ctrl = None
        elif C in 'LHV':
            nx, ny = (x * rel + sc.num(), y) if C == 'H' else (x, y * rel + sc.num()) if C == 'V' else pt()
            segs.append(('L', (x, y), [(nx, ny)])); x, y = nx, ny; ctrl = None
        elif C == 'C':
            c1, c2, e = pt(), pt(), pt()
            segs.append(('C', (x, y), [c1, c2, e])); x, y = e; ctrl = c2
        elif C == 'S':
            c2, e = pt(), pt()
            c1 = (2 * x - ctrl[0], 2 * y - ctrl[1]) if prev.upper() in 'CS' and ctrl else (x, y)
            segs.append(('C', (x, y), [c1, c2, e])); x, y = e; ctrl = c2
        else:
            raise SystemExit('base_line: unsupported path command %s' % c)
        prev = c
    flat = lambda seg: abs(seg[2][-1][0] - seg[1][0]) >= abs(seg[2][-1][1] - seg[1][1])
    heading = lambda seg: seg[2][-1][0] > seg[1][0]
    # Skip the top edge (straight, heading left) and the drop at the left end.
    i = 0
    while i < len(segs) and not (heading(segs[i]) and flat(segs[i])): i += 1
    j = i
    while j < len(segs) and heading(segs[j]) and flat(segs[j]): j += 1
    if j - i < 2: raise SystemExit('base_line: no foot found in the range outline')
    r = lambda v: format(round(v, 4), 'g')
    out = 'M %s %s' % (r(segs[i][1][0]), r(segs[i][1][1]))
    for kind, _, pts in segs[i:j]:
        out += ' %s %s' % (kind, ' '.join('%s %s' % (r(px), r(py)) for px, py in pts))
    return out


def _arc(x1, y1, rx, ry, phi, fa, fs, x2, y2, n=48):
    rx, ry = abs(rx), abs(ry)
    if not rx or not ry: return [(x2, y2)]
    c, s = math.cos(math.radians(phi)), math.sin(math.radians(phi))
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    xp, yp = c*dx + s*dy, -s*dx + c*dy
    lam = xp*xp/(rx*rx) + yp*yp/(ry*ry)
    if lam > 1: rx, ry = rx*math.sqrt(lam), ry*math.sqrt(lam)
    den = rx*rx*yp*yp + ry*ry*xp*xp
    k = math.sqrt(max(0, (rx*rx*ry*ry - den) / den)) * (-1 if fa == fs else 1) if den else 0
    cxp, cyp = k*rx*yp/ry, -k*ry*xp/rx
    cx, cy = c*cxp - s*cyp + (x1 + x2)/2, s*cxp + c*cyp + (y1 + y2)/2
    ang = lambda ux, uy, vx, vy: math.atan2(ux*vy - uy*vx, ux*vx + uy*vy)
    ux, uy, vx, vy = (xp - cxp)/rx, (yp - cyp)/ry, (-xp - cxp)/rx, (-yp - cyp)/ry
    t1, dt = ang(1, 0, ux, uy), ang(ux, uy, vx, vy)
    if not fs and dt > 0: dt -= 2*math.pi
    elif fs and dt < 0: dt += 2*math.pi
    out = []
    for i in range(1, n + 1):
        t = t1 + dt*i/n; ex, ey = rx*math.cos(t), ry*math.sin(t)
        out.append((cx + c*ex - s*ey, cy + s*ex + c*ey))
    return out


def path_points(d, samples=12):
    """Sample every segment; enough to bound curves once padding is added."""
    sc, pts = _Scan(d), []
    x = y = sx = sy = 0.0; ctrl = None; prev = ''
    def bez(ps):
        n = len(ps) - 1
        for i in range(1, samples + 1):
            t = i/samples
            pts.append(tuple(sum(math.comb(n, j)*(1-t)**(n-j)*t**j*p[a] for j, p in enumerate(ps)) for a in (0, 1)))
    while sc.more() or sc.i < len(d):
        if not sc.more(): c = sc.cmd()
        elif prev: c = {'M': 'L', 'm': 'l'}.get(prev, prev)
        else: break
        rel, C = c.islower(), c.upper()
        ox, oy = (x, y) if rel else (0, 0)
        if C == 'Z':
            x, y = sx, sy; pts.append((x, y)); ctrl = None; prev = c; continue
        if C in 'ML':
            x, y = ox + sc.num(), oy + sc.num()
            if C == 'M': sx, sy = x, y
            pts.append((x, y)); ctrl = None
        elif C == 'H': x = ox + sc.num(); pts.append((x, y)); ctrl = None
        elif C == 'V': y = oy + sc.num(); pts.append((x, y)); ctrl = None
        elif C in 'CS':
            if C == 'C': p1 = (ox + sc.num(), oy + sc.num())
            else: p1 = (2*x - ctrl[0], 2*y - ctrl[1]) if ctrl and prev.upper() in 'CS' else (x, y)
            p2 = (ox + sc.num(), oy + sc.num()); p3 = (ox + sc.num(), oy + sc.num())
            bez([(x, y), p1, p2, p3]); ctrl = p2; x, y = p3
        elif C in 'QT':
            if C == 'Q': p1 = (ox + sc.num(), oy + sc.num())
            else: p1 = (2*x - ctrl[0], 2*y - ctrl[1]) if ctrl and prev.upper() in 'QT' else (x, y)
            p2 = (ox + sc.num(), oy + sc.num())
            bez([(x, y), p1, p2]); ctrl = p1; x, y = p2
        elif C == 'A':
            rx, ry, phi = sc.num(), sc.num(), sc.num(); fa, fs = sc.flag(), sc.flag()
            nx, ny = ox + sc.num(), oy + sc.num()
            pts.extend(_arc(x, y, rx, ry, phi, fa, fs, nx, ny)); x, y = nx, ny; ctrl = None
        else: raise ValueError('Unsupported path command ' + c)
        prev = c
    return pts


def _union(boxes):
    boxes = [b for b in boxes if b]
    if not boxes: return None
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def _intersect(a, b):
    if not a or not b: return a or b
    return (max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3]))


SKIP = ('defs', 'clipPath', 'mask', 'title', 'desc', 'metadata', 'text', 'style')


def shape_points(el, byid, m=IDENTITY, stroke=('none', '1')):
    """Sampled outline points (x, y, stroke half-width) of el, in m's space."""
    stroke = (el.get('stroke', stroke[0]), el.get('stroke-width', stroke[1]))
    m = mul(m, parse_transform(el.get('transform')))
    tag = local(el.tag)
    if tag in SKIP: return []
    if tag == 'use':
        ref = byid[(el.get('href') or el.get('{%s}href' % XL))[1:]]
        return shape_points(ref, byid, mul(m, (1, 0, 0, 1, float(el.get('x', 0)), float(el.get('y', 0)))), stroke)
    if tag in ('g', 'svg'): return [p for c in el for p in shape_points(c, byid, m, stroke)]
    if tag == 'path': pts = path_points(el.get('d'))
    elif tag == 'rect':
        x, y, w, h = (float(el.get(a, 0)) for a in ('x', 'y', 'width', 'height'))
        pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    elif tag in ('ellipse', 'circle'):
        cx, cy = float(el.get('cx', 0)), float(el.get('cy', 0))
        rx = float(el.get('rx', el.get('r', 0))); ry = float(el.get('ry', el.get('r', 0)))
        pts = [(cx + rx*math.cos(a*math.pi/128), cy + ry*math.sin(a*math.pi/128)) for a in range(256)]
    else: return []
    pad = float(stroke[1])/2*math.sqrt(abs(m[0]*m[3] - m[1]*m[2])) if stroke[0] != 'none' else 0
    return [apply(m, p) + (pad,) for p in pts]


def _inside(p, poly):
    """Even-odd ray cast against a sampled closed outline."""
    x, y, hit = p[0], p[1], False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1)*(x2 - x1)/(y2 - y1): hit = not hit
    return hit


def bbox(el, byid, m=IDENTITY, stroke=('none', '1')):
    tag = local(el.tag)
    if tag in SKIP: return None
    if tag in ('g', 'svg'):
        inner = mul(m, parse_transform(el.get('transform')))
        stroke2 = (el.get('stroke', stroke[0]), el.get('stroke-width', stroke[1]))
        box = _union(bbox(c, byid, inner, stroke2) for c in el)
    else:
        pts = shape_points(el, byid, m, stroke)
        box = (min(p[0] - p[2] for p in pts), min(p[1] - p[2] for p in pts),
               max(p[0] + p[2] for p in pts), max(p[1] + p[2] for p in pts)) if pts else None
    clip = re.match(r'url\(#([^)]+)\)', el.get('clip-path', ''))
    if clip and box:
        # Visible extent = content samples inside the clip outline, plus clip
        # outline samples inside the content's box. Tighter than intersecting
        # the two bounding boxes (which left e.g. the river 36 units too wide).
        own = mul(m, parse_transform(el.get('transform')))
        outline = [p[:2] for c in byid[clip.group(1)] for p in shape_points(c, byid, own)]
        keep = [(x - d, y - d, x + d, y + d) for x, y, d in shape_points(el, byid, m, stroke) if _inside((x, y), outline)]
        keep += [(x, y, x, y) for x, y in outline if box[0] <= x <= box[2] and box[1] <= y <= box[3]]
        # Edge crossings can fall between samples; widen by the sample spacing.
        gap = max(math.dist(a, b) for a, b in zip(outline, outline[1:] + outline[:1]))
        k = _union(keep)
        box = _intersect(box, k and (k[0] - gap, k[1] - gap, k[2] + gap, k[3] + gap))
    return box


# ----------------------------------------------------------------- sources --
class Source:
    """A parsed SVG from which elements are copied with their inherited context."""
    def __init__(self, root, label):
        self.root, self.label = root, label
        self.parent = {c: p for p in root.iter() for c in p}
        self.byid = {e.get('id'): e for e in root.iter() if e.get('id')}

    def __getitem__(self, key): return self.byid[key]

    def wrapped(self, el, **attrs):
        """Copy el inside groups repeating each ancestor's attributes (fill,
        transform, clip-path...), so it renders exactly as it did in place."""
        chain, p = [], self.parent.get(el)
        while p is not None and p is not self.root:
            if local(p.tag) != 'defs': chain.append(p)
            p = self.parent.get(p)
        node = clean(copy.deepcopy(el))
        for anc in chain:
            a = {k: v for k, v in anc.attrib.items() if k != 'id' and not k.startswith('{%s}' % INK)}
            if a:
                g = ET.Element(q('g'), a); g.append(node); node = g
        if attrs:
            g = ET.Element(q('g'), {k.replace('_', '-'): v for k, v in attrs.items()}); g.append(node); node = g
        return node

    def dependencies(self, nodes):
        need, stack = [], list(nodes)
        while stack:
            for x in stack.pop().iter():
                for k, v in x.attrib.items():
                    refs = re.findall(r'url\(#([^)]+)\)', v) + ([v[1:]] if k.endswith('href') and v.startswith('#') else [])
                    for r in refs:
                        if r in self.byid and r not in need: need.append(r); stack.append(self.byid[r])
        return [clean(copy.deepcopy(self.byid[r])) for r in need]


def clean(el):
    for x in el.iter():
        for k in [k for k in x.attrib if k.startswith('{%s}' % INK)]: del x.attrib[k]
    return el


def fragment(xml, label):
    return Source(ET.fromstring('<svg xmlns="%s">%s</svg>' % (SVG, xml)), label)


def load_themes():
    """The v5 themes, plus the airtanker package palette (generate.py defaults) as
    a crest theme, so the shared crest matches the package's wings, band and diamonds."""
    themes = js_table(PRIMITIVES_JS, 'THEMES')
    p = package_generator().Palette()
    themes['airtanker'] = {'ink': p.gold, 'paper': p.navy, 'text': p.gold, 'sky': p.navy, 'water': p.navy, 'wildlife': p.gold, 'distant': p.gold,
                           'earth': p.gold, 'tree': p.gold, 'word': p.gold, 'descriptor': p.gold, 'strip': p.navy, 'stripText': p.gold}
    return themes


def recolour_map(theme):
    return {colour: theme[token] for colour, token in SOURCE_TOKENS.items()}


def recolour(nodes, mapping):
    for n in nodes:
        for x in n.iter():
            for attr in ('fill', 'stroke'):
                c = x.get(attr)
                if c and c.lower() in mapping: x.set(attr, mapping[c.lower()])
                token = x.get('data-%s-token' % attr)
                if token and 'theme' in mapping: x.set(attr, mapping['theme'][token])


# ------------------------------------------------------------------ output --
class Writer:
    def __init__(self, out):
        self.out, self.manifest = out, []

    def emit(self, rel, title, source, nodes, defs=(), note='', pad=6, themable=False):
        svg = ET.Element(q('svg'), {'version': '1.1'})
        ET.SubElement(svg, q('title')).text = title
        ET.SubElement(svg, q('desc')).text = (note + ' ' if note else '') + 'Isolated from ' + source + \
            '. Original coordinates retained; only the viewBox is cropped. Reference-based reconstruction, not an official master.'
        if defs: ET.SubElement(svg, q('defs')).extend(defs)
        taken = {e.get('id') for n in list(nodes) + list(defs) for e in n.iter()}
        stem = Path(rel).stem
        g = ET.SubElement(svg, q('g'), {'id': stem if stem not in taken else stem + '-piece'})
        g.extend(nodes)
        byid = {e.get('id'): e for e in svg.iter() if e.get('id')}
        b = bbox(g, byid)
        x, y, w, h = b[0] - pad, b[1] - pad, b[2] - b[0] + 2*pad, b[3] - b[1] + 2*pad
        r = lambda v: format(round(v, 3), 'g')
        svg.set('viewBox', ' '.join(r(v) for v in (x, y, w, h)))
        svg.set('width', r(w)); svg.set('height', r(h))
        ET.indent(svg, '  ')
        path = self.out / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(svg, encoding='unicode') + '\n', encoding='utf-8')
        self.manifest.append({'file': rel, 'family': rel.split('/')[0] if not rel.startswith('themes/') else rel.split('/')[1],
                              'title': title, 'source': source, 'note': note, 'viewBox': svg.get('viewBox'), 'themable': themable})


def knockout(fill_nodes, hole_nodes, mask_id, box):
    """Draw fill_nodes with hole_nodes cut out (the source paints those notches
    in the sky/paper colour; isolated, they become real transparent holes)."""
    x, y, w, h = box
    mask = ET.Element(q('mask'), {'id': mask_id, 'maskUnits': 'userSpaceOnUse', 'x': str(x), 'y': str(y), 'width': str(w), 'height': str(h)})
    ET.SubElement(mask, q('rect'), {'x': str(x), 'y': str(y), 'width': str(w), 'height': str(h), 'fill': 'white'})
    for hnode in hole_nodes:
        hn = copy.deepcopy(hnode)
        for e in hn.iter():
            for attr in ('fill', 'stroke'):
                if e.get(attr) not in (None, 'none'): e.set(attr, 'black')
        mask.append(hn)
    g = ET.Element(q('g'), {'mask': 'url(#%s)' % mask_id}); g.extend(fill_nodes)
    return g, mask


# ----------------------------------------------------------- v5 primitives --
def frame_check(art):
    """Compare the tree crest's frame with the wildlife frame the crest now shares.
    Returns the largest radius difference and the tree artwork's centring offset."""
    def ellipse(el, m):
        pts = [apply(m, p) for p in path_points(el.get('d'))]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        return (min(xs) + max(xs))/2, (min(ys) + max(ys))/2, (max(xs) - min(xs))/2, (max(ys) - min(ys))/2
    tf, ti = fragment(art['treeFrame'], '').root[0], fragment(art['treeInner'], '').root[0]
    m = parse_transform(tf.get('transform'))
    half = float(tf[1].get('stroke-width'))*math.sqrt(abs(m[0]*m[3]))/2
    ocx, ocy, orx, ory = ellipse(tf[1], m)
    icx, icy, irx, iry = ellipse(ti[1], m)
    tree = {'outer-black-oval': (orx + half, ory + half), 'white-lettering-band': (orx - half, ory - half),
            'inner-black-oval': (irx + half, iry + half), 'window': (irx - half, iry - half)}
    frame = fragment(art['wildlifeFrame'], '')
    clip = ET.fromstring(art['wildlifeClip'])[0]
    wild = {k: (float(frame[k].get('rx')), float(frame[k].get('ry'))) for k in tree if k != 'window'}
    wild['window'] = (float(clip.get('rx')), float(clip.get('ry')))
    dev = max(abs(a - b) for k in tree for a, b in zip(tree[k], wild[k]))
    if dev > 0.5: raise SystemExit('Tree and wildlife frames differ by %.2f units; they cannot share one frame.' % dev)
    return {'radius_deviation': dev, 'tree_offset': (float(clip.get('cx')) - icx, float(clip.get('cy')) - icy)}


# Service tabs (the Wildfire Service ribbon and the upper tab) as a parametric
# band hugging the crest's outer oval, so a tab can grow around the oval. The
# numbers were fitted to the traced sourceRibbon in art.json (they differ only
# by slivers along its traced edges). site/src/tab.ts draws the same band; the
# site's Checks compare the two.
TAB = {
    'halfSpan': 49.7,  # degrees of the oval's parameter either side of the tab's middle
    'depth': 85.5,     # the paper face, outward from the oval's outer edge
    'border': 15,      # ink border around the face
    'inset': 8,        # the border's inner edge tucks this far under the crest's ring
    'tilt': 14,        # each end cut leans this far off square, toward the tab's middle
}


def tab_bands(oval, centre, half, tab=TAB):
    """The tab as two outlines: the ink band and the paper face on it. oval:
    (cx, cy, rx, ry) of the crest's outer oval; centre: 90 for a lower tab, 270
    for an upper one; half: the half-span in degrees (TAB['halfSpan'] by default)."""
    cx, cy, rx, ry = oval
    c, tilt = math.radians(centre), math.radians(tab['tilt'])
    def normal(t):
        nx, ny = math.cos(t)/rx, math.sin(t)/ry; n = math.hypot(nx, ny)
        return nx/n, ny/n
    def at(t, d):
        nx, ny = normal(t)
        return cx + rx*math.cos(t) + d*nx, cy + ry*math.sin(t) + d*ny
    def end(sign, shift):
        # The cut through the end of the oval edge, leaning toward the middle,
        # moved `shift` toward the middle (the face's end sits inside the border).
        t = c + sign*math.radians(half); nx, ny = normal(t); a = -sign*tilt
        dx, dy = nx*math.cos(a) - ny*math.sin(a), nx*math.sin(a) + ny*math.cos(a)
        (px, py), (sx, sy) = at(t, 0), (dy*sign, -dx*sign)
        return (px + sx*shift, py + sy*shift), (dx, dy)
    def meet(line, d, sign):
        # Where the offset curve at distance d crosses the cut (bisection on the angle).
        (qx, qy), (dx, dy) = line
        side = lambda t: (lambda o: (o[0] - qx)*dy - (o[1] - qy)*dx)(at(t, d))
        lo, hi = c, c + sign*math.radians(half + 40)
        for _ in range(60):
            mid = (lo + hi)/2
            if (side(mid) > 0) == (side(lo) > 0): lo = mid
            else: hi = mid
        return (lo + hi)/2
    def band(d0, d1, shift):
        l0, l1 = end(-1, shift), end(1, shift)
        a0, a1, b0, b1 = meet(l0, d1, -1), meet(l1, d1, 1), meet(l0, d0, -1), meet(l1, d0, 1)
        n = max(8, math.ceil(math.degrees(abs(a1 - a0))*2))
        pts = [at(a0 + (a1 - a0)*i/n, d1) for i in range(n + 1)] + [at(b1 + (b0 - b1)*i/n, d0) for i in range(n + 1)]
        return 'M ' + ' L '.join('%.2f %.2f' % p for p in pts) + ' Z'
    return band(-tab['inset'], tab['depth'] + tab['border'], 0), band(0, tab['depth'], tab['border'])


def separator_pair(y, inset=0):
    """engine.js separatorLayout reference positions: on the crest band, drawn in
    by the crest's separatorInset."""
    band = SHAPES['separatorBand']
    dx = (band['rx'] - inset)*math.sqrt(max(0, 1 - ((y - CY)/(band['ry'] - inset))**2))
    return [(CX - dx, y), (CX + dx, y)]


def crest_oval(art):
    """(cx, cy, rx, ry) of the shared frame's outer oval."""
    e = fragment(art['wildlifeFrame'], '')['outer-black-oval']
    return tuple(float(e.get(k)) for k in ('cx', 'cy', 'rx', 'ry'))


def build_v5(w, base, themes, theme_name=None):
    art = json.loads((V5 / 'data/art.json').read_text(encoding='utf-8'))
    theme = themes[theme_name] if theme_name else None
    paint = dict(recolour_map(theme), theme=theme) if theme else {}
    src = 'bc-ministry-primitives-v5/data/art.json'

    def out(rel, title, source, nodes, defs=(), **kw):
        recolour(list(nodes) + list(defs), paint)
        w.emit(base + rel, title, source, nodes, defs, themable=True, **kw)

    # Shared crest ------------------------------------------------------------
    # The wildlife and tree frames are the same oval (frame_check()), so one
    # frame and one scene window serve every crest.
    check = frame_check(art)
    window = art['wildlifeClip'].replace('landscape-clip', 'crest-window')
    frame = fragment(art['wildlifeFrame'], src)
    out('crest/frame.svg', 'Shared crest frame', src + ' → wildlifeFrame', [frame.wrapped(frame['oval-frame'])],
        note='One frame for every crest: outer ink oval, paper lettering band, inner ink oval. The tree crest\'s own frame '
             'matched it within %.2f units, so it was retired.' % check['radius_deviation'])

    # Wildlife scene (Forests, Long ministry, BCTS wildlife) ---------------------
    wl = fragment('<defs>%s</defs>%s' % (window, art['wildlifeScene'].replace('landscape-clip', 'crest-window')), src)
    out('scenes/wildlife.svg', 'Wildlife scene', src + ' → wildlifeScene', [wl.wrapped(wl['landscape'])], wl.dependencies([wl['landscape']]),
        note='Used by Forests, Long ministry and BCTS wildlife. Clipped to the shared crest window.')
    for rel, title, ids in [
        ('sky', 'Wildlife scene · sky', ['sky']),
        ('mountains', 'Wildlife scene · snow mountains', ['mountains']),
        ('distant-woodland', 'Wildlife scene · distant woodland', ['distant-woodland']),
        ('river', 'Wildlife scene · river', ['river']),
        ('river-bank', 'Wildlife scene · river bank', ['river-bank']),
        ('large-tree', 'Wildlife scene · large conifer', ['large-tree-trunk', 'large-tree-canopy']),
        ('small-tree', 'Wildlife scene · small conifer', ['small-tree-trunk', 'small-tree-canopy']),
        ('eagle', 'Wildlife scene · eagle', ['eagle']),
        ('elk', 'Wildlife scene · elk', ['elk']),
        ('fish', 'Wildlife scene · fish', ['fish'])]:
        nodes = [wl.wrapped(wl[i]) for i in ids]
        out('scenes/wildlife-parts/%s.svg' % rel, title, src + ' → wildlifeScene #' + ' #'.join(ids), nodes, wl.dependencies(nodes),
            note='Clipped by the crest window exactly as in the scene.')

    # Tree scene (every other crest) ----------------------------------------------
    # The source draws its own sky oval and inner ring, 1-2 units off centre.
    # Here the ring comes from the shared frame, the sky is the shared window,
    # and the artwork is shifted by that offset so it sits centred in the window.
    ti = fragment(art['treeInner'], src).root[0]
    parts = list(ti)
    names = ['own-sky', 'own-ring', 'distant-forest', 'mountains', 'trunk', 'canopy'] + ['canopy-notch-%d' % i for i in range(1, 7)]
    if len(parts) != len(names): raise SystemExit('art.json treeInner has %d parts; expected %d (%s)' % (len(parts), len(names), ', '.join(names)))
    for el, name in zip(parts, names):
        el.set('id', 'tree-' + name)
    ti.remove(parts[0]); ti.remove(parts[1])
    dx, dy = check['tree_offset']
    ti.set('transform', 'translate(%.5f %.5f) %s' % (dx, dy, ti.get('transform')))
    wx = ET.fromstring(window)[0]
    sky = '<ellipse id="tree-sky" cx="%s" cy="%s" rx="%s" ry="%s" fill="#6dc9ef"/>' % tuple(wx.get(a) for a in ('cx', 'cy', 'rx', 'ry'))
    tree = fragment('<defs>%s</defs><g id="tree-scene" clip-path="url(#crest-window)">%s%s</g>' % (window, sky, ET.tostring(ti, encoding='unicode')), src)
    note = 'Centred in the shared crest window (source artwork shifted %.2f, %.2f units).' % (dx, dy)
    scene = [tree.wrapped(tree['tree-scene'])]
    out('scenes/tree.svg', 'Tree scene (shared)', src + ' → treeInner', scene, tree.dependencies(scene),
        note='The one tree scene for Forest Service, Wildfire Management, Parks, Airtanker, BCTS tree, BC / Timber / Sales and the branch strip. ' + note)
    for rel, title, ids in [('sky', 'Tree scene · sky', ['tree-sky']),
                            ('distant-forest', 'Tree scene · distant forest', ['tree-distant-forest']),
                            ('mountains', 'Tree scene · mountains', ['tree-mountains'])]:
        nodes = [tree.wrapped(tree[i]) for i in ids]
        out('scenes/tree-parts/%s.svg' % rel, title, src + ' → treeInner #' + ids[0], nodes, tree.dependencies(nodes), note=note)
    # The single-colour and airtanker crests draw the range as its ridge line only
    # (the fill is sky-toned, which those themes turn to the background colour).
    ridge = tree.wrapped(tree['tree-mountains'])
    line = next(e for e in ridge.iter() if e.get('id') == 'tree-mountains')
    m = IDENTITY
    for e in ridge.iter():
        if e.get('transform'): m = mul(m, parse_transform(e.get('transform')))
    line.attrib.clear()
    line.attrib.update({'id': 'tree-mountain-ridge', 'd': ridge_line(tree['tree-mountains'].get('d')), 'fill': 'none', 'stroke': '#231f20',
                        'stroke-width': format(round(RIDGE_WIDTH / math.sqrt(abs(m[0]*m[3] - m[1]*m[2])), 4), 'g'),
                        'stroke-linejoin': 'round', 'stroke-linecap': 'round'})
    out('scenes/tree-parts/mountain-ridge.svg', 'Tree scene · mountain ridge line', src + ' → treeInner #tree-mountains (top edge)', [ridge],
        tree.dependencies([ridge]), note='The top edge of the mountains as a %g-unit line in the lettering ink, for the single-colour and airtanker crests. Not part of the full-colour scene. %s' % (RIDGE_WIDTH, note))
    # And the foot of the range (where the blue mountains meet the band below
    # them in the full-colour scene) as a second line, as both references show.
    feet = tree.wrapped(tree['tree-mountains'])
    foot = next(e for e in feet.iter() if e.get('id') == 'tree-mountains')
    foot.attrib.clear()
    foot.attrib.update({**line.attrib, 'id': 'tree-mountain-base', 'd': base_line(tree['tree-mountains'].get('d'))})
    out('scenes/tree-parts/mountain-base.svg', 'Tree scene · mountain base line', src + ' → treeInner #tree-mountains (bottom edge)', [feet],
        tree.dependencies([feet]), note='The bottom edge of the mountains as a %g-unit line in the lettering ink, under the ridge line on the single-colour and airtanker crests. Not part of the full-colour scene. %s' % (RIDGE_WIDTH, note))
    fills = [tree.wrapped(tree['tree-trunk']), tree.wrapped(tree['tree-canopy'])]
    holes = [tree.wrapped(tree['tree-canopy-notch-%d' % i]) for i in range(1, 7)]
    box = _union(bbox(n, tree.byid) for n in fills); box = (box[0] - 5, box[1] - 5, box[2] - box[0] + 10, box[3] - box[1] + 10)
    g, mask = knockout(fills, holes, 'tree-conifer-notches', box)
    out('scenes/tree-parts/conifer.svg', 'Tree scene · central conifer and trunk', src + ' → treeInner #tree-trunk #tree-canopy', [g],
        [mask] + tree.dependencies([g, mask]),
        note='The six sky-coloured branch notches are cut out as transparent holes. The source canopy path also contains the small forest cluster at lower left. ' + note)

    # Complete blank crests: the shared frame + one of the two scenes.
    out('crest/tree-crest.svg', 'Tree crest · shared frame + tree scene', 'crest/frame.svg + scenes/tree.svg',
        [frame.wrapped(frame['oval-frame'])] + scene, tree.dependencies(scene), note='No lettering.')
    out('crest/wildlife-crest.svg', 'Wildlife crest · shared frame + wildlife scene', 'crest/frame.svg + scenes/wildlife.svg',
        [frame.wrapped(frame['oval-frame']), wl.wrapped(wl['landscape'])], wl.dependencies([wl['landscape']]), note='No lettering.')

    # Separator marks (engine.js drawBadge; sizes and heights from CRESTS) --------
    wild_text = (theme or themes['wildlife'])['text']; forest_text = (theme or themes['forest'])['text']
    caps, long_, tree_heavy = CRESTS['wildlife-caps'], CRESTS['wildlife-long'], CRESTS['tree-heavy']
    r = caps['separatorSize']
    out('marks/separator-circle.svg', 'Separator · circle (wildlife crests)', 'bc-ministry-primitives-v5/src/engine.js → drawBadge',
        [ET.Element(q('circle'), {'cx': '0', 'cy': '0', 'r': '%g' % r, 'fill': wild_text, 'data-fill-token': 'text'})], pad=2,
        note='Radius %g (wildlife-caps). wildlife-long uses radius %g. Placed at y=%g / y=%g on the crest in the engine.'
             % (r, long_['separatorSize'], caps['separatorY'], long_['separatorY']))
    r = tree_heavy['separatorSize']
    out('marks/separator-diamond.svg', 'Separator · diamond (tree crest)', 'bc-ministry-primitives-v5/src/engine.js → drawBadge',
        [ET.Element(q('path'), {'d': 'M 0 %g l %g %g -%g %g -%g -%g Z' % (-r, r, r, r, r, r, r), 'fill': forest_text, 'data-fill-token': 'text'})], pad=2,
        note='Half-diagonal %g. Placed at y=%g on the tree-heavy crest.' % (r, tree_heavy['separatorY']))

    # Service components (engine.js ribbon / plate / wings) -----------------
    ink_band, face = tab_bands(crest_oval(art), 90, TAB['halfSpan'])
    ribbon = ET.Element(q('g'), {'id': 'service-ribbon'})
    ET.SubElement(ribbon, q('path'), {'id': 'service-ribbon-border', 'd': ink_band, 'fill': '#000000'})
    ET.SubElement(ribbon, q('path'), {'id': 'service-ribbon-face', 'd': face, 'fill': '#ffffff'})
    out('tabs/service-ribbon.svg', 'Service ribbon (Wildfire Service lower tab)', src + ' → sourceRibbon, redrawn as a parametric band',
        [ribbon],
        note='A band hugging the crest\'s outer oval: half-span %g°, face %g deep, border %g, ends leaning %g°, fitted to the traced source ribbon. '
             'It can grow around the oval (layout.json tab; site/src/tab.ts). The upper tab is this shape turned upside down: rotate(180) about the crest centre.'
             % (TAB['halfSpan'], TAB['depth'], TAB['border'], TAB['tilt']))
    parks, plate = theme or themes['parks'], SHAPES['plate']
    out('tabs/parks-plate.svg', 'Parks plate', 'bc-ministry-primitives-v5/src/engine.js → drawBadge plate',
        [ET.Element(q('rect'), {**{k: '%g' % plate[k] for k in ('x', 'y', 'width', 'height', 'rx')}, 'fill': parks['paper'], 'stroke': parks['ink'],
                                'stroke-width': '%g' % plate['strokeWidth'], 'data-fill-token': 'paper', 'data-stroke-token': 'ink'})])
    wd = SHAPES['wings']
    wings = ET.Element(q('g'))
    for mirror in (False, True):
        side = ET.SubElement(wings, q('g'), {'transform': 'translate(%g 0) scale(-1 1)' % (2*CX)} if mirror else {})
        ET.SubElement(side, q('path'), {'d': wd['outline'], 'fill': wd['fill'], 'stroke': wd['stroke'], 'stroke-width': '%g' % wd['strokeWidth'], 'stroke-linejoin': 'round'})
        for a, b in wd['rules']:
            ET.SubElement(side, q('path'), {'d': 'M %g %g H %g' % (a, b, wd['ruleEnd']), 'fill': 'none', 'stroke': wd['stroke'], 'stroke-width': '%g' % wd['ruleWidth']})
    w.emit(base + 'tabs/airtanker-wings.svg', 'Airtanker wings (v5 engine, mirrored pair)', 'bc-ministry-primitives-v5/src/engine.js → wings()', [wings],
           note='Photo-based approximation; colours are fixed in the engine, not themed.')
    band = ET.Element(q('path'), {'d': wd['band'], 'fill': wd['bandFill'], 'stroke': wd['stroke'], 'stroke-width': '%g' % wd['bandStrokeWidth']})
    w.emit(base + 'tabs/airtanker-band.svg', 'Airtanker lower service band (v5 engine)', 'bc-ministry-primitives-v5/src/engine.js → wings()', [band],
           note='Photo-based approximation; colours are fixed in the engine, not themed.')


# ----------------------------------------------------- airtanker primitives --
def build_airtanker(w, base, art):
    """Only the package's own parts. Its oval and landscape are replaced by the
    shared crest frame + tree scene, placed with the transform in layout.json."""
    path = AIR / 'airtanker-operations-editable.svg'
    s = Source(ET.parse(path).getroot(), 'airtanker-operations/airtanker-operations-editable.svg')
    src = s.label

    # Fit the shared crest to the package's old oval: same width, same vertical midpoint.
    pts = path_points(s['oval-master'].get('d'))
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    outer_rx = float(fragment(art['wildlifeFrame'], '')['outer-black-oval'].get('rx'))
    k = (x1 - x0)/2/outer_rx
    m = mul(mul((1, 0, 0, 1, (x0 + x1)/2, (y0 + y1)/2), (k, 0, 0, k, 0, 0)), (1, 0, 0, 1, -CX, -CY))
    diamonds = [apply(m, p) for p in separator_pair(CRESTS['tree-heavy']['separatorY'], CRESTS['tree-heavy'].get('separatorInset', 0))]
    mirror = s['right-wing'].get('transform')

    def out(rel, title, ids, note='', **attrs):
        nodes = [s.wrapped(s[i], **attrs) for i in ids]
        w.emit(base + rel, title, src + ' → #' + ' #'.join(ids), nodes, s.dependencies(nodes), note=note)

    out('lower-band.svg', 'Airtanker · lower service band', ['lower-band'])
    out('wing.svg', 'Airtanker · wing master (left)', ['wing-master'], note='The right wing is this master mirrored: %s.' % mirror)
    out('wings-pair.svg', 'Airtanker · mirrored wing pair', ['wings'])
    out('diamond.svg', 'Airtanker · diamond marker', ['diamond'], fill=package_generator().Palette().red,
        note='Master at the origin; placed on the shared crest band at (%.1f, %.1f) and (%.1f, %.1f).' % (*diamonds[0], *diamonds[1]))
    return {'crestTransform': [round(v, 6) for v in m], 'crestScale': round(k, 6),
            'crestTransformAttr': 'translate(%g %g) scale(%.6f) translate(%g %g)' % ((x0 + x1)/2, (y0 + y1)/2, k, -CX, -CY),
            'crestCentre': [round(v, 5) for v in apply(m, (CX, CY))],
            'wingMirror': [round(v, 6) for v in parse_transform(mirror)],
            'diamonds': [[round(x, 3), round(y, 3)] for x, y in diamonds],
            'replaced': 'oval-frame, landscape and its parts (hero conifer, ridges, distant forest, ground, small pine)'}


# ------------------------------------------------------------------ lettering --
def lettering_sources():
    """The v5 examples' lettering only: each example's live <text> runs, the
    baselines their text paths follow, and the branch strip's bar, in an <svg>
    with the example's viewBox. The site takes its lettering from these; the
    artwork in the examples is the primitives, so it is left out."""
    out = {}
    for path in sorted((V5 / 'examples').glob('*.svg')):
        src = ET.parse(path).getroot()
        byid = {e.get('id'): e for e in src.iter() if e.get('id')}
        texts = [e for e in src.iter(q('text'))]
        bars = [e for e in src.iter() if e.get('data-layer') == 'branch-strip']
        baselines = []
        for t in texts:
            for tp in t.iter(q('textPath')):
                ref = (tp.get('href') or tp.get('{%s}href' % XL) or '#')[1:]
                if ref not in byid: raise SystemExit('%s: text path refers to missing #%s' % (path.name, ref))
                if byid[ref] not in baselines: baselines.append(byid[ref])
        svg = ET.Element(q('svg'), {'viewBox': src.get('viewBox')})
        if baselines: ET.SubElement(svg, q('defs')).extend(copy.deepcopy(b) for b in baselines)
        svg.extend(copy.deepcopy(e) for e in bars + texts)
        out[path.stem] = ET.tostring(svg, encoding='unicode')
    return out


# --------------------------------------------------------------- contact sheet --
def contact_sheet(out, manifest):
    groups = {}
    for m in manifest: groups.setdefault(str(Path(m['file']).parent), []).append(m)
    cards = []
    for folder, items in groups.items():
        figs = ''.join('<figure><div class="art"><img src="%s" alt=""></div><figcaption>%s<small>%s</small></figcaption></figure>'
                       % (m['file'], m['title'], Path(m['file']).name) for m in items)
        cards.append('<h2>%s</h2><div class="grid">%s</div>' % (folder, figs))
    html = '''<!doctype html><meta charset="utf-8"><title>Shared primitives</title>
<style>body{font:14px system-ui,sans-serif;margin:24px;background:#f4f5f2;color:#1d2b24}h1{margin:0 0 4px}h2{margin:28px 0 10px;font-size:15px;color:#50605a}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}figure{margin:0;background:#fff;border:1px solid #dde2dc;border-radius:8px;padding:10px}
.art{height:150px;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#eef0ec 0 25%%,#fff 0 50%%) 0 0/16px 16px;border-radius:4px}
img{max-width:100%%;max-height:100%%}figcaption{margin-top:8px}small{display:block;color:#6b7a73;font-size:12px}</style>
<h1>Shared primitives</h1><p>%d isolated building blocks. Transparent backgrounds shown on a checkerboard.</p>%s''' % (len(manifest), ''.join(cards))
    (out / 'index.html').write_text(html, encoding='utf-8')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--out', type=Path, default=HERE)
    ap.add_argument('--theme', action='append', default=[], help='also write the v5 pieces recoloured with a theme: wildlife, forest, mono, parks, gold or airtanker (repeatable)')
    args = ap.parse_args()
    themes = load_themes()
    args.theme = list(dict.fromkeys(args.theme))
    for t in args.theme:
        if t not in themes: ap.error('unknown theme %r; choose from %s' % (t, ', '.join(themes)))
    w = Writer(args.out)
    build_v5(w, 'bc-ministry-v5/', themes)
    art = json.loads((V5 / 'data/art.json').read_text(encoding='utf-8'))
    airtanker = build_airtanker(w, 'airtanker-operations/', art)
    check = frame_check(art)
    # Upper tab: the lower ribbon turned upside down (rotated 180° about the crest
    # centre), same size. The lower ribbon's inner edge hugs the oval, so the upper
    # one does too. (The v5 engine also scales it 1.10 about the crest centre and
    # moves it up 7, which leaves a gap of about 38 units at the top; scaled 1.10
    # about the oval's top instead, its ends still lift about 14 units off the oval.)
    upper = mul(mul((1, 0, 0, 1, CX, CY), (-1, 0, 0, -1, 0, 0)), (1, 0, 0, 1, -CX, -CY))
    layout = {
        'crestCentre': [CX, CY],
        'frameCheck': {'radiusDeviation': round(check['radius_deviation'], 4), 'treeOffset': [round(v, 5) for v in check['tree_offset']]},
        # Each placed at the crest's separatorY; scale is relative to the master
        # mark (the circle master is the capitals crest's size).
        'separators': {key: {'at': separator_pair(c['separatorY'], c.get('separatorInset', 0)), 'scale': c['separatorSize']/master, 'y': c['separatorY'], 'size': c['separatorSize']}
                       for key, c, master in [('circle-caps', CRESTS['wildlife-caps'], CRESTS['wildlife-caps']['separatorSize']),
                                              ('circle-long', CRESTS['wildlife-long'], CRESTS['wildlife-caps']['separatorSize']),
                                              ('diamond', CRESTS['tree-heavy'], CRESTS['tree-heavy']['separatorSize'])]},
        'upperTabTransform': [round(v, 6) for v in upper],
        # The parametric tab (see TAB): the site draws grown tabs from this.
        'tab': {'oval': list(crest_oval(art)), **TAB, 'lower': 90, 'upper': 270},
        'airtanker-operations': airtanker,
    }
    (args.out / 'layout.json').write_text(json.dumps(layout, indent=1) + '\n', encoding='utf-8')
    print('Frames agree within %.3f units; tree artwork re-centred by (%.2f, %.2f).' % (check['radius_deviation'], *check['tree_offset']))
    (args.out / 'themes.json').write_text(json.dumps({'sourceTokens': SOURCE_TOKENS, 'themes': themes}, indent=1) + '\n', encoding='utf-8')
    (args.out / 'lettering.json').write_text(json.dumps(lettering_sources(), indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    write_manifest(args.out, args.out / 'manifest.json', w.manifest)
    contact_sheet(args.out, w.manifest)
    print('%d files written to %s' % (len(w.manifest), args.out))
    # Recoloured copies get their own manifest, so the site (which reads the main
    # one) is not affected by them.
    if args.theme:
        tw = Writer(args.out)
        for t in args.theme: build_v5(tw, 'themes/%s/' % t, themes, t)
        write_manifest(args.out, args.out / 'themes/manifest.json', tw.manifest)
        print('%d recoloured files written to %s' % (len(tw.manifest), args.out / 'themes'))


def write_manifest(root, path, manifest):
    """Write a manifest (file paths relative to root), first deleting files the
    previous one listed that this run no longer writes (a renamed piece would
    otherwise leave its old SVG behind)."""
    if path.exists():
        kept = {m['file'] for m in manifest}
        for m in json.loads(path.read_text(encoding='utf-8')):
            stale = root / m['file']
            if m['file'] not in kept and stale.is_file(): stale.unlink()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
