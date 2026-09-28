import layout from '../../layout.json';
import { parseVB, type Piece, type VB } from './data';

/* Service tabs as a parametric band around the crest's outer oval, so a tab can
 * grow. The same drawing as tab_bands() in extract_primitives.py, which writes
 * the default lower tab (tabs/service-ribbon.svg); Checks compares the two. */

export const TAB = layout.tab;
export type TabSide = 'lower' | 'upper';

/** The largest half-span a tab may grow to (degrees): the ends then sit well
 *  clear of the separators on the band. */
export const MAX_HALF_SPAN = 80;

/** The ink band and the paper face on it, as path data. */
export function tabBands(side: TabSide, half: number = TAB.halfSpan): { border: string; face: string; points: [number, number][] } {
  const [cx, cy, rx, ry] = TAB.oval;
  const c = (TAB[side] * Math.PI) / 180, tilt = (TAB.tilt * Math.PI) / 180;
  const normal = (t: number): [number, number] => {
    const nx = Math.cos(t) / rx, ny = Math.sin(t) / ry, n = Math.hypot(nx, ny);
    return [nx / n, ny / n];
  };
  const at = (t: number, d: number): [number, number] => {
    const [nx, ny] = normal(t);
    return [cx + rx * Math.cos(t) + d * nx, cy + ry * Math.sin(t) + d * ny];
  };
  // The cut through the end of the oval edge, leaning toward the middle, moved
  // `shift` toward the middle (the face's end sits inside the border).
  const end = (sign: number, shift: number) => {
    const t = c + (sign * half * Math.PI) / 180, [nx, ny] = normal(t), a = -sign * tilt;
    const dx = nx * Math.cos(a) - ny * Math.sin(a), dy = nx * Math.sin(a) + ny * Math.cos(a);
    const [px, py] = at(t, 0);
    return { q: [px + dy * sign * shift, py - dx * sign * shift], d: [dx, dy] };
  };
  // Where the offset curve at distance d crosses the cut (bisection on the angle).
  const meet = (line: ReturnType<typeof end>, d: number, sign: number) => {
    const side = (t: number) => { const o = at(t, d); return (o[0] - line.q[0]) * line.d[1] - (o[1] - line.q[1]) * line.d[0]; };
    let lo = c, hi = c + (sign * (half + 40) * Math.PI) / 180;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (side(mid) > 0 === side(lo) > 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const all: [number, number][] = [];
  const band = (d0: number, d1: number, shift: number) => {
    const l0 = end(-1, shift), l1 = end(1, shift);
    const a0 = meet(l0, d1, -1), a1 = meet(l1, d1, 1), b0 = meet(l0, d0, -1), b1 = meet(l1, d0, 1);
    const n = Math.max(8, Math.ceil((Math.abs(a1 - a0) * 180) / Math.PI * 2));
    const pts = [
      ...Array.from({ length: n + 1 }, (_, i) => at(a0 + ((a1 - a0) * i) / n, d1)),
      ...Array.from({ length: n + 1 }, (_, i) => at(b1 + ((b0 - b1) * i) / n, d0)),
    ];
    all.push(...pts);
    return 'M ' + pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L ') + ' Z';
  };
  return { border: band(-TAB.inset, TAB.depth + TAB.border, 0), face: band(0, TAB.depth, TAB.border), points: all };
}

/** A tab as a piece that composite() can stack like the generated files. */
export function tabPiece(side: TabSide, half: number = TAB.halfSpan): Piece {
  const { border, face, points } = tabBands(side, half);
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]), pad = 6;
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  const vb: VB = [x, y, Math.max(...xs) + pad - x, Math.max(...ys) + pad - y].map((v) => +v.toFixed(3)) as VB;
  const viewBox = vb.join(' ');
  const file = `bc-ministry-v5/tabs/service-ribbon.svg`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="${viewBox}" width="${vb[2]}" height="${vb[3]}">` +
    `<g id="service-ribbon-piece"><g id="service-ribbon"><path id="service-ribbon-border" d="${border}" fill="#000000"/>` +
    `<path id="service-ribbon-face" d="${face}" fill="#ffffff"/></g></g></svg>`;
  return {
    file,
    family: 'bc-ministry-v5',
    title: `Service tab · ${side}, half-span ${half.toFixed(1)}°`,
    source: 'site/src/tab.ts',
    note: '',
    viewBox,
    themable: true,
    svg,
    vb: parseVB(viewBox),
    group: 'bc-ministry-v5/tabs',
    name: 'service-ribbon.svg',
    parent: null,
  };
}
