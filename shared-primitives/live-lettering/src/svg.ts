import themesJson from '../../themes.json';

// Shared SVG plumbing: matrices, parsing, theming and stacking the generated
// primitives in their shared coordinates. The viewer site re-exports these.

export type VB = [number, number, number, number];
export type Palette = Record<string, string>;
/** What stacking needs from a generated primitive (the site's Piece has more). */
export interface PieceSvg {
  file: string;
  svg: string;
  vb: VB;
  themable: boolean;
}
/** Where a piece goes: one transform per placed copy; defaults to one copy in place. */
export interface Placement {
  instances?: M[];
}
const sourceTokens: Record<string, string> = themesJson.sourceTokens;
export const themes: Record<string, Palette> = themesJson.themes;

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const XLINK_NS = 'http://www.w3.org/1999/xlink';

// ---------------------------------------------------------------- matrices --
export type M = [number, number, number, number, number, number];
const I: M = [1, 0, 0, 1, 0, 0];
export const mul = (a: M, b: M): M => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
export const T = (x: number, y: number): M => [1, 0, 0, 1, x, y];
export const S = (x: number, y = x): M => [x, 0, 0, y, 0, 0];
export const apply = (m: M, [x, y]: [number, number]): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
export const matrixAttr = (m: M) => `matrix(${m.map((v) => +v.toFixed(6)).join(' ')})`;

const corners = ([x, y, w, h]: VB): [number, number][] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

export function unionBox(boxes: VB[]): VB {
  const xs = boxes.flatMap((b) => [b[0], b[0] + b[2]]);
  const ys = boxes.flatMap((b) => [b[1], b[1] + b[3]]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
}

function transformBox(vb: VB, m: M): VB {
  const pts = corners(vb).map((p) => apply(m, p));
  return unionBox(pts.map(([x, y]) => [x, y, 0, 0] as VB));
}

const pad = ([x, y, w, h]: VB, p: number): VB => [x - p, y - p, w + 2 * p, h + 2 * p];
export const fmt = (vb: VB) => vb.map((v) => +v.toFixed(3)).join(' ');

// ----------------------------------------------------------------- parsing --
const parser = new DOMParser();
const serializer = new XMLSerializer();
export const parse = (text: string) => parser.parseFromString(text, 'image/svg+xml');
export const serialize = (node: Node) => serializer.serializeToString(node);
export const hasParseError = (doc: Document) => doc.getElementsByTagName('parsererror').length > 0;

// ------------------------------------------------------------------ themes --
const themedCache = new Map<string, string>();

/** Same rule as engine.js recolour(): source colour -> theme token. Shapes the
 *  engine paints directly carry data-fill-token / data-stroke-token instead. */
export function themedSvg(piece: PieceSvg, palette: Palette | null): string {
  if (!palette || !piece.themable) return piece.svg;
  const key = piece.file + '|' + JSON.stringify(palette);
  const hit = themedCache.get(key);
  if (hit) return hit;
  const doc = parse(piece.svg);
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    if (el.closest('mask')) continue; // knockout masks stay black/white
    for (const attr of ['fill', 'stroke']) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const token = el.getAttribute(`data-${attr}-token`) ?? sourceTokens[value.toLowerCase()];
      if (token && palette[token]) el.setAttribute(attr, palette[token]);
    }
  }
  const out = serialize(doc);
  if (themedCache.size > 2000) themedCache.clear();
  themedCache.set(key, out);
  return out;
}

// --------------------------------------------------------------- compose --
export function prefixIds(doc: Document, prefix: string) {
  const map = new Map<string, string>();
  for (const el of Array.from(doc.querySelectorAll('[id]'))) {
    map.set(el.id, prefix + el.id);
    el.id = prefix + el.id;
  }
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    for (const a of Array.from(el.attributes)) {
      let v = a.value.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${map.get(id) ?? id})`);
      if (a.localName === 'href' && v.startsWith('#')) v = '#' + (map.get(v.slice(1)) ?? v.slice(1));
      if (v !== a.value) el.setAttributeNS(a.namespaceURI, a.name, v);
    }
  }
}

export interface StackOptions {
  palette?: Palette | null;
  /** Prefix for every id, so several composites can share one HTML page. */
  idPrefix?: string;
  /** Repaint a piece's colours outright (used to paint masks for analysis):
   *  given the piece file and a paint value, return the replacement or undefined. */
  repaint?: (file: string, paint: string) => string | undefined;
}

export interface FinishOptions {
  viewBox?: VB;
  /** href: the overlay image (a URL or data URL); vb: where it goes. */
  overlay?: { href: string; vb: VB; opacity: number; blend: 'normal' | 'difference' } | null;
  centre?: [number, number] | null;
  bounds?: boolean;
}

export type CompositeOptions = StackOptions & FinishOptions;

export interface Stacked {
  defs: string;
  body: string;
  boxes: VB[];
  outlines: string[];
}

/** Stack pieces in their shared coordinate space as one standalone SVG. */
export const composite = (layers: { layer: Placement; piece: PieceSvg }[], opts: CompositeOptions = {}) => finish(stack(layers, opts), opts);

/** The pieces' shared defs and body, one copy per placed instance. The costly
 *  part of a composite; keep it when only the overlay or guides change. */
export function stack(layers: { layer: Placement; piece: PieceSvg }[], opts: StackOptions = {}): Stacked {
  let defs = '', body = '';
  const boxes: VB[] = [], outlines: string[] = [];
  layers.forEach(({ layer, piece }, i) => {
    const doc = parse(themedSvg(piece, opts.palette ?? null));
    if (opts.repaint)
      for (const el of Array.from(doc.getElementsByTagName('*'))) {
        if (el.closest('mask')) continue;
        for (const attr of ['fill', 'stroke']) {
          const v = el.getAttribute(attr);
          const next = v && v !== 'none' ? opts.repaint(piece.file, v) : undefined;
          if (next) el.setAttribute(attr, next);
        }
      }
    prefixIds(doc, `${opts.idPrefix ?? ''}L${i}-`);
    const root = doc.documentElement;
    const d = root.querySelector(':scope > defs');
    const g = root.querySelector(':scope > g');
    if (!g) return;
    if (d) defs += Array.from(d.children).map(serialize).join('');
    const content = serialize(g);
    for (const m of layer.instances ?? [I]) {
      body += m === I ? content : `<g transform="${matrixAttr(m)}">${content}</g>`;
      boxes.push(transformBox(piece.vb, m));
      outlines.push(corners(piece.vb).map((p) => apply(m, p).map((v) => v.toFixed(2)).join(',')).join(' '));
    }
  });
  return { defs, body, boxes, outlines };
}

/** A stack as a standalone SVG, with an optional overlay image and guides. */
export function finish({ defs, body, boxes: stackBoxes, outlines }: Stacked, opts: FinishOptions = {}) {
  const boxes = [...stackBoxes];
  if (opts.overlay) boxes.push(opts.overlay.vb);
  const vb = opts.viewBox ?? (boxes.length ? pad(unionBox(boxes), 16) : ([0, 0, 100, 100] as VB));
  let extra = '';
  if (opts.overlay) {
    const [x, y, w, h] = opts.overlay.vb;
    extra += `<image href="${opts.overlay.href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" opacity="${opts.overlay.opacity}" style="mix-blend-mode:${opts.overlay.blend}"/>`;
  }
  const guide = 'fill="none" vector-effect="non-scaling-stroke"';
  if (opts.bounds) for (const pts of outlines) extra += `<polygon points="${pts}" ${guide} stroke="#0a84ff" stroke-width="1" stroke-dasharray="5 4"/>`;
  if (opts.centre) {
    const [cx, cy] = opts.centre;
    extra += `<path d="M ${vb[0]} ${cy} H ${vb[0] + vb[2]} M ${cx} ${vb[1]} V ${vb[1] + vb[3]}" ${guide} stroke="#e5007e" stroke-width="1"/>`;
  }
  const svg =
    `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}" version="1.1" viewBox="${fmt(vb)}" width="${+vb[2].toFixed(3)}" height="${+vb[3].toFixed(3)}">` +
    `<defs>${defs}</defs>${body}${extra}</svg>`;
  return { svg, vb, defs, body, boxes };
}
