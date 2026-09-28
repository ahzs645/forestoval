/* Fit each recreation's lettering to its reference image.
 *
 * The reference's letters are found inside the zones where lettering lives
 * (the paper band, ribbon, plate or strip, and the open page for lockups).
 * Our text is laid out by the browser with the real fonts, drawn glyph by
 * glyph onto the reference's pixel grid, and compared with those letters.
 * Per run, size, letter-spacing and arc radius/rotation (or x/y for straight
 * lines) are searched to maximise the overlap. Nothing else is changed.
 * Shared runs (placed from another recreation's fit) are drawn but never
 * adjusted, so they stay identical on every logo. */
import layout from '../../layout.json';
import { themes } from './data';
import { resolve } from './layers';
import {
  CREST_RUNS,
  IDENTITY,
  letteringDoc,
  letteringRuns,
  runAttributes,
  setWords,
  type Lettering,
  type LetteringFit,
  type Recreation,
  type TabFit,
  type ReferenceImage,
  type Run,
  type RunParams,
} from './recreations';
import { apply, composite, mul, rasterize, serialize, SVG_NS, type M } from './svg';

const PAPER = '#00ff00', STRIP = '#0000ff', BAND = '#ffff00', OTHER = '#ff00ff';
// Service bands that keep their own colours (not themed): lettering sits on
// their cream face, so that face counts as a zone. Wings share the colour but
// carry no text, so only pieces named *band* are used.
const BAND_FACES = ['#ffecc0', '#ead49b'];
const SIZE = 480;

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((ok, bad) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => bad(new Error('Could not load ' + url));
    img.src = url;
  });

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function blur(src: Float32Array, W: number, H: number): Float32Array {
  // Two passes of a 3×3 box: smooths the score so small moves are rewarded.
  let a: Float32Array = Float32Array.from(src), b: Float32Array = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        b[i] = (a[i] + (x > 0 ? a[i - 1] : a[i]) + (x < W - 1 ? a[i + 1] : a[i])) / 3;
      }
    [a, b] = [b, a];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        b[i] = (a[i] + (y > 0 ? a[i - W] : a[i]) + (y < H - 1 ? a[i + W] : a[i])) / 3;
      }
    [a, b] = [b, a];
  }
  return a;
}

/** Square max filter (radius r), separable. */
function dilate(mask: Uint8Array, W: number, H: number, r: number): Uint8Array {
  const tmp = new Uint8Array(mask.length), out = new Uint8Array(mask.length);
  for (let y = 0; y < H; y++) {
    let last = -Infinity;
    for (let x = 0; x < W; x++) { if (mask[y * W + x]) last = x; if (x - last <= r) tmp[y * W + x] = 1; }
    last = Infinity;
    for (let x = W - 1; x >= 0; x--) { if (mask[y * W + x]) last = x; if (last - x <= r) tmp[y * W + x] = 1; }
  }
  for (let x = 0; x < W; x++) {
    let last = -Infinity;
    for (let y = 0; y < H; y++) { if (tmp[y * W + x]) last = y; if (y - last <= r) out[y * W + x] = 1; }
    last = Infinity;
    for (let y = H - 1; y >= 0; y--) { if (tmp[y * W + x]) last = y; if (last - y <= r) out[y * W + x] = 1; }
  }
  return out;
}

/** Keep a label only where its whole (2r+1)² neighbourhood has the same label. */
function erodeLabels(labels: Uint8Array, W: number, H: number, r: number): Uint8Array {
  const out = new Uint8Array(labels.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const l = labels[y * W + x];
      let keep = l > 0;
      for (let dy = -r; keep && dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H || labels[yy * W + xx] !== l) { keep = false; break; }
        }
      out[y * W + x] = keep ? l : 0;
    }
  return out;
}

// Search keys. Arcs are searched by how far each side of the baseline ellipse
// moves outward (eL/eR/eT/eB): one side can then move without disturbing the
// opposite one, which a centre shift or radius change alone cannot do.
// `gap:<n>` is the extra space before word n+1, `trk:<n>` word n's own tracking.
type Edge = 'eL' | 'eR' | 'eT' | 'eB';
type Key = 'scale' | 'spacing' | 'rot' | 'dx' | 'dy' | Edge | `gap:${number}` | `trk:${number}`;
type Kind = Exclude<Key, `gap:${number}` | `trk:${number}`> | 'gap' | 'trk';
const kind = (k: Key): Kind => (k.startsWith('gap:') ? 'gap' : k.startsWith('trk:') ? 'trk' : (k as Kind));
// spacing, gaps and tracks are in em (× the run's font size).
const STEP: Record<Kind, number> = { scale: 0.04, spacing: 0.03, gap: 0.08, trk: 0.02, rot: 2, dx: 6, dy: 6, eL: 4, eR: 4, eT: 4, eB: 4 };
const MIN: Record<Kind, number> = { scale: 0.003, spacing: 0.002, gap: 0.005, trk: 0.002, rot: 0.1, dx: 0.4, dy: 0.4, eL: 0.3, eR: 0.3, eT: 0.3, eB: 0.3 };
const LIMIT: Record<Kind, [number, number]> = {
  scale: [0.7, 1.45], spacing: [-0.1, 0.35], gap: [-0.3, 1], trk: [-0.08, 0.2], rot: [-20, 20], dx: [-120, 120], dy: [-120, 120],
  eL: [-45, 45], eR: [-45, 45], eT: [-45, 45], eB: [-45, 45],
};
const EM: Kind[] = ['spacing', 'gap', 'trk'];
// Ellipse sides <-> centre shift + radii (dr applies to both radii, dry adds to ry).
const edges = (p: RunParams) => ({ eL: p.dr - p.dx, eR: p.dr + p.dx, eT: p.dr + p.dry - p.dy, eB: p.dr + p.dry + p.dy });
const fromEdges = (p: RunParams, e: Record<Edge, number>): RunParams => {
  const rx = (e.eL + e.eR) / 2, ry = (e.eT + e.eB) / 2;
  return { ...p, dr: rx, dry: ry - rx, dx: (e.eR - e.eL) / 2, dy: (e.eB - e.eT) / 2 };
};
const isEdge = (k: Key): k is Edge => k === 'eL' || k === 'eR' || k === 'eT' || k === 'eB';
const get = (p: RunParams, k: Key) =>
  k.startsWith('gap:') ? p.gaps[+k.slice(4)] ?? 0
  : k.startsWith('trk:') ? p.tracks?.[+k.slice(4)] ?? 0
  : isEdge(k) ? edges(p)[k] : p[k as 'scale' | 'spacing' | 'rot' | 'dx' | 'dy'];
const put = (p: RunParams, k: Key, v: number): RunParams =>
  k.startsWith('gap:')
    ? { ...p, gaps: p.gaps.map((g, j) => (j === +k.slice(4) ? v : g)) }
    : k.startsWith('trk:')
    ? { ...p, tracks: (p.tracks ?? []).map((g, j) => (j === +k.slice(4) ? v : g)) }
    : isEdge(k)
      ? fromEdges(p, { ...edges(p), [k]: v })
      : { ...p, [k]: v };

/** Draw a laid-out <text> glyph by glyph, at the positions the browser reports. */
function paintGlyphs(ctx: CanvasRenderingContext2D, t: SVGTextElement, run: Run, size: number) {
  ctx.font = `${run.weight} ${size}px ${run.family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = run.strokeWidth;
  const str = t.textContent ?? '';
  for (let c = 0; c < t.getNumberOfChars(); c++) {
    if (str[c] === ' ') continue;
    let pos: DOMPoint, rot: number;
    try { pos = t.getStartPositionOfChar(c); rot = t.getRotationOfChar(c); } catch { continue; }
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.fillText(str[c], 0, 0);
    if (run.strokeWidth) ctx.strokeText(str[c], 0, 0);
    ctx.restore();
  }
}

interface Ellipse { cx: number; cy: number; rx: number; ry: number }

/** The angles (degrees, measured on ellipse e) that a line's letters span,
 *  from its glyphs drawn at 4 px per unit. */
function inkSpan(t: SVGTextElement, run: Run, e: Ellipse, around: number): [number, number] {
  const b = t.getBBox(), s = 4, pad = 4;
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.ceil((b.width + 2 * pad) * s), height: Math.ceil((b.height + 2 * pad) * s) });
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.setTransform(s, 0, 0, s, -(b.x - pad) * s, -(b.y - pad) * s);
  paintGlyphs(ctx, t, run, run.fontSize);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] < 128) continue;
      const ux = b.x - pad + (x + 0.5) / s, uy = b.y - pad + (y + 0.5) / s;
      let a = (Math.atan2((uy - e.cy) / e.ry, (ux - e.cx) / e.rx) * 180) / Math.PI;
      a -= 360 * Math.round((a - around) / 360);
      lo = Math.min(lo, a);
      hi = Math.max(hi, a);
    }
  return [lo, hi];
}

/** Fit an upper-tab shared run to its tab. Its letters may only cover the part
 *  of the tab that the fitted lower-tab line covers, carried through the same
 *  transform. With fillTab the letter-spacing is set so they cover exactly that
 *  stretch (it may tighten to no extra spacing). Words still too long are
 *  shrunk: size, spacing and gaps scale evenly (glyphs never squeezed). */
function upperTabFit(rec: Recreation, run: Run, host: SVGSVGElement): TabFit {
  const from = run.shared!;
  const twin = letteringRuns({ ...rec, lettering: [{ from: from.rec, only: [from.run!.split(':')[1]], shared: { rec: from.rec, run: from.run } }] })[0];
  const place = (r: Run) => {
    const doc = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}">${r.xml}</svg>`, 'image/svg+xml');
    const t = document.importNode(doc.documentElement.firstElementChild!, true) as SVGTextElement;
    const path = document.createElementNS(SVG_NS, 'path');
    path.id = 'shrink-path';
    const tp = t.getElementsByTagName('textPath')[0];
    tp.setAttribute('href', '#shrink-path');
    tp.removeAttribute('xlink:href');
    const p = r.fixed!, a = runAttributes(r, p);
    t.setAttribute('font-size', String(a.fontSize));
    t.setAttribute('letter-spacing', String(a.letterSpacing));
    t.setAttribute('word-spacing', String(a.wordSpacing));
    if ('d' in a) path.setAttribute('d', a.d);
    setWords(tp, r.text, p.gaps, p.tracks, a.letterSpacing);
    if (p.start !== undefined) { t.setAttribute('text-anchor', p.anchor ?? 'start'); tp.setAttribute('startOffset', String(p.start)); }
    host.append(path, t);
    return { t, done: () => { path.remove(); t.remove(); } };
  };
  const p = twin.fixed!, a = twin.arc!;
  const e: Ellipse = { cx: a.cx + p.dx, cy: a.cy + p.dy, rx: a.rx + p.dr, ry: a.ry + p.dr + p.dry };
  const src = place(twin), around = p.centre ?? a.mid;
  const [s0, s1] = inkSpan(src.t, twin, e, around);
  src.done();
  const T = layout.upperTabTransform as M, g = Math.hypot(T[0], T[1]), [ux, uy] = apply(T, [e.cx, e.cy]);
  const up: Ellipse = { cx: ux, cy: uy, rx: e.rx * g, ry: e.ry * g };
  const span = (fit: TabFit) => {
    const r = letteringRuns(rec, (key) => (key === run.key ? fit : { shrink: 1 })).find((q) => q.key === run.key)!;
    const placed = place(r), s = inkSpan(placed.t, r, up, around + 180);
    placed.done();
    return s;
  };
  const inside = (fit: TabFit) => { const [u0, u1] = span(fit); return u0 >= s0 + 180 && u1 <= s1 + 180; };
  const bisect = (lo: number, hi: number, ok: (v: number) => boolean) => {
    for (let n = 0; n < 18; n++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
    return lo;
  };
  let tracking = 0;
  if (run.shared!.fillTab) {
    // Widest spacing that stays within the stretch; no tighter than none at all.
    const tightest = -run.letterSpacing;
    const covers = (t: number) => { const [u0, u1] = span({ shrink: 1, tracking: t }); return u1 - u0 <= s1 - s0; };
    tracking = covers(tightest) ? bisect(tightest, run.fontSize * 2, covers) : tightest;
  }
  if (inside({ shrink: 1, tracking })) return { shrink: 1, ...(tracking ? { tracking } : {}) };
  const shrink = bisect(0.5, 1, (k) => inside({ shrink: k, tracking }));
  return { shrink, ...(tracking ? { tracking } : {}) };
}

/** One reference, prepared for scoring: our runs laid out in the browser, the
 *  reference's letters found in its lettering zones, and score(P) comparing them. */
interface Problem {
  reference: string;
  runs: Run[];
  /** Starting parameters (v5 placement, arcs re-anchored at their first letter). */
  P0: RunParams[];
  /** Runs whose letters fall mostly outside every zone: left out of the score. */
  frozen: boolean[];
  tabFits: Record<string, TabFit>;
  score: (P: RunParams[]) => number;
  centre: (i: number, P: RunParams[]) => number | undefined;
  debug: (P: RunParams[], emit: (png: string) => void) => void;
  done: () => void;
}

async function prepare(rec: Recreation, ref: ReferenceImage): Promise<Problem> {
  const r = ref.registration!;
  let runs = letteringRuns(rec, () => ({ shrink: 1 }));
  const img = await loadImage(ref.url);
  const iw = img.naturalWidth || ref.width, ih = img.naturalHeight || ref.height;
  const k = SIZE / Math.max(iw, ih);
  const W = Math.round(iw * k), H = Math.round(ih * k);
  const base: M = [W / r.w, 0, 0, H / r.h, (-r.x * W) / r.w, (-r.y * H) / r.h];

  // Zones where lettering lives, each with the background its letters sit on:
  // 1 paper regions of our artwork (band, ribbon, plate), 2 the branch strip's
  // bar, 3 fixed-colour service bands (the airtanker's cream), 4 the open page
  // around straight lockup lines. Scenes are left out: their white snow is
  // paper-coloured but never carries text.
  const theme = themes[rec.theme];
  const palette = Object.fromEntries(Object.keys(themes.wildlife).map((t) => [t, t === 'paper' ? PAPER : OTHER]));
  const chosen = resolve(rec.family, rec.layers).filter(({ layer }) => !layer.file.includes('/scenes/'));
  const fixed = new Set(chosen.filter(({ piece }) => !piece.themable).map(({ piece }) => piece.file));
  const c = chosen.length
    ? composite(chosen, {
        palette,
        idPrefix: 'probe-',
        repaint: (file, paint) =>
          !fixed.has(file) ? undefined : /band/.test(file) && BAND_FACES.includes(paint.toLowerCase()) ? BAND : OTHER,
      })
    : null;
  const bars = rec.lettering
    .filter((l) => !l.only)
    .flatMap((l) => Array.from(letteringDoc(l).querySelectorAll('[data-layer="branch-strip"]')))
    .map((b) => (b.setAttribute('fill', STRIP), serialize(b)))
    .join('');
  const probeSvg = `<svg xmlns="${SVG_NS}" viewBox="${r.x} ${r.y} ${r.w} ${r.h}" preserveAspectRatio="none"><defs>${c?.defs ?? ''}</defs>${bars}${c?.body ?? ''}</svg>`;
  const probe = (await rasterize(probeSvg, W, H)).getContext('2d')!.getImageData(0, 0, W, H).data;
  const openPage = runs.some((run) => !run.arc && !run.line);
  const near = (i: number, c: number[], tol: number) => Math.abs(probe[i * 4] - c[0]) + Math.abs(probe[i * 4 + 1] - c[1]) + Math.abs(probe[i * 4 + 2] - c[2]) <= tol;
  const paperRgb = rgb(PAPER), stripRgb = rgb(STRIP), bandRgb = rgb(BAND);
  const labels = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const A = probe[i * 4 + 3];
    if (A > 200) labels[i] = near(i, paperRgb, 120) ? 1 : near(i, stripRgb, 120) ? 2 : near(i, bandRgb, 120) ? 3 : 0;
    else if (openPage && A < 10) labels[i] = 4;
  }
  const zoneLabel = erodeLabels(labels, W, H, Math.max(1, Math.round(W / 240)));
  const zone = new Uint8Array(W * H);
  const background: Record<number, number[]> = { 1: rgb(theme.paper), 2: rgb(theme.strip ?? '#000000'), 3: rgb(BAND_FACES[0]), 4: [255, 255, 255] };

  // The reference's letters: in each zone, split its pixels into two colour
  // groups; the letters are the group farther from that zone's background.
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const rctx = canvas.getContext('2d', { willReadFrequently: true })!;
  rctx.imageSmoothingQuality = 'high';
  rctx.fillStyle = '#ffffff'; // transparent references read as if on white paper
  rctx.fillRect(0, 0, W, H);
  rctx.drawImage(img, 0, 0, W, H);
  const px = rctx.getImageData(0, 0, W, H).data;
  const col = (i: number) => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
  const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const mean = (ids: number[]) => [0, 1, 2].map((ch) => ids.reduce((s, i) => s + px[i * 4 + ch], 0) / Math.max(1, ids.length));
  const refMask = new Float32Array(W * H);
  for (const label of [1, 2, 3, 4]) {
    const idx: number[] = [];
    for (let i = 0; i < W * H; i++) if (zoneLabel[i] === label && px[i * 4 + 3] > 128) idx.push(i);
    if (idx.length < 20) continue;
    const sorted = [...idx].sort((a, b) => lum(col(a)) - lum(col(b)));
    const tenth = Math.max(1, sorted.length >> 3);
    let ca = mean(sorted.slice(0, tenth)), cb = mean(sorted.slice(-tenth));
    let A: number[] = [], B: number[] = [];
    for (let iter = 0; iter < 10; iter++) {
      A = []; B = [];
      for (const i of idx) (dist(col(i), ca) <= dist(col(i), cb) ? A : B).push(i);
      ca = mean(A);
      cb = mean(B);
    }
    const [letters, ground] = dist(ca, background[label]) > dist(cb, background[label]) ? [A, B] : [B, A];
    // Only keep the parts of our zone where the reference really shows this
    // background nearby: a longer bar, a misregistered edge or a different
    // band width in the reference would otherwise read as lettering.
    const onGround = new Uint8Array(W * H);
    for (const i of ground) onGround[i] = 1;
    const reach = dilate(onGround, W, H, Math.max(2, Math.round(W / 40)));
    for (const i of idx) if (reach[i]) zone[i] = 1;
    for (const i of letters) if (reach[i]) refMask[i] = 1;
  }
  const refB = blur(refMask, W, H);
  let refSq = 0;
  for (let i = 0; i < W * H; i++) if (zone[i]) refSq += refB[i] * refB[i];

  // Our text: laid out by the browser (real fonts, kerning, text-on-path),
  // then each glyph drawn on a canvas at the position the browser reports.
  const host = document.createElementNS(SVG_NS, 'svg');
  host.setAttribute('width', '10');
  host.setAttribute('height', '10');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;overflow:visible';
  document.body.append(host);
  const texts: SVGTextElement[] = [], paths: (SVGPathElement | null)[] = [];
  runs.forEach((run, i) => {
    const doc = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink">${run.xml}</svg>`, 'image/svg+xml');
    const t = document.importNode(doc.documentElement.firstElementChild!, true) as SVGTextElement;
    let path: SVGPathElement | null = null;
    const tp = t.getElementsByTagName('textPath')[0];
    if (tp && (run.arc || run.line)) {
      path = document.createElementNS(SVG_NS, 'path');
      path.id = `fit-path-${i}`;
      host.append(path);
      tp.setAttribute('href', '#' + path.id);
      tp.removeAttribute('xlink:href');
      if (run.arc) tp.setAttribute('startOffset', '50%');
    }
    host.append(t);
    texts.push(t);
    paths.push(path);
  });
  await Promise.all(runs.map((run) => document.fonts.load(`${run.weight} 40px ${run.family}`, run.text)));
  // Upper-tab shared runs: spaced and, if the words are too long, shrunk to fit the tab.
  const tabFits: Record<string, TabFit> = {};
  for (const run of runs) if (run.shared?.tab) tabFits[run.key] = upperTabFit(rec, run, host);
  runs = letteringRuns(rec, (key) => tabFits[key] ?? { shrink: 1 });

  const ours = document.createElement('canvas');
  ours.width = W;
  ours.height = H;
  const octx = ours.getContext('2d', { willReadFrequently: true })!;
  const set = (i: number, p: RunParams) => {
    const a = runAttributes(runs[i], p), t = texts[i];
    t.setAttribute('font-size', String(a.fontSize));
    t.setAttribute('letter-spacing', String(a.letterSpacing));
    t.setAttribute('word-spacing', String(a.wordSpacing));
    if ('d' in a) paths[i]?.setAttribute('d', a.d);
    else { t.setAttribute('x', String(a.x)); t.setAttribute('y', String(a.y)); }
    if (p.gaps.length) setWords(t.getElementsByTagName('textPath')[0] ?? t, runs[i].text, p.gaps, p.tracks, a.letterSpacing);
    if (p.start !== undefined) {
      t.setAttribute('text-anchor', p.anchor ?? 'start');
      t.getElementsByTagName('textPath')[0]?.setAttribute('startOffset', String(p.start));
    }
  };
  const frozen = runs.map(() => false);
  const draw = (P: RunParams[], only?: number) => {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, W, H);
    runs.forEach((run: Run, i) => {
      if (only === undefined ? frozen[i] : i !== only) return;
      octx.setTransform(...mul(base, run.matrix));
      paintGlyphs(octx, texts[i], run, run.fontSize * P[i].scale);
    });
    const data = octx.getImageData(0, 0, W, H).data;
    const a = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) a[i] = data[i * 4 + 3] / 255;
    return a;
  };
  const score = (P: RunParams[]) => {
    P.forEach((p, i) => set(i, p));
    const ob = blur(draw(P), W, H);
    let hit = 0, den = refSq;
    for (let i = 0; i < W * H; i++) {
      den += ob[i] * ob[i]; // letters outside the zone only cost
      if (zone[i]) hit += ob[i] * refB[i];
    }
    return den ? (2 * hit) / den : 0;
  };

  const P0: RunParams[] = runs.map((run) => {
    if (run.fixed) return { ...run.fixed };
    const words = run.text.split(' ');
    return { ...IDENTITY, gaps: words.slice(1).map(() => 0), tracks: words.length > 1 ? words.map(() => 0) : [] };
  });
  // Re-anchor arcs at their first letter (same layout as centred, see RunParams.start).
  P0.forEach((p, i) => {
    if (!runs[i].arc || !paths[i] || runs[i].fixed) return;
    set(i, p);
    p.start = paths[i]!.getTotalLength() / 2 - texts[i].getComputedTextLength() / 2;
  });
  const identity = P0.map((p) => ({ ...p }));
  // A run whose letters mostly fall outside every zone can't be judged against
  // the reference; it keeps its v5 placement and is left out of the score.
  identity.forEach((p, i) => set(i, p));
  runs.forEach((_, i) => {
    const m = draw(identity, i);
    let ink = 0, inside = 0;
    for (let j = 0; j < W * H; j++) { ink += m[j]; if (zone[j]) inside += m[j]; }
    frozen[i] = !runs[i].fixed && (!ink || inside / ink < 0.5);
  });
  const centre = (i: number, P: RunParams[]) => {
    P.forEach((p, j) => set(j, p));
    const run = runs[i], t = texts[i], n = t.getNumberOfChars(), p = P[i];
    if (!run.arc || !n) return undefined;
    const cx = run.arc.cx + p.dx, cy = run.arc.cy + p.dy, rx = run.arc.rx + p.dr, ry = run.arc.ry + p.dr + p.dry;
    const around = run.arc.mid + p.rot;
    const angle = (q: DOMPoint) => {
      const a = (Math.atan2((q.y - cy) / ry, (q.x - cx) / rx) * 180) / Math.PI;
      return a - 360 * Math.round((a - around) / 360);
    };
    return (angle(t.getStartPositionOfChar(0)) + angle(t.getEndPositionOfChar(n - 1))) / 2;
  };
  const debug = (P: RunParams[], emit: (png: string) => void) => {
    // Two panels: reference letters in black with our text in red (before)
    // and in blue (after), translucent so the overlap reads as dark.
    const panel = (mask: Float32Array, tint: number[]) => {
      const out = rctx.createImageData(W, H);
      for (let i = 0; i < W * H; i++) {
        const base = refMask[i] ? 20 : zone[i] ? 238 : 255, a = mask[i] * 0.55;
        out.data.set([base * (1 - a) + tint[0] * a, base * (1 - a) + tint[1] * a, base * (1 - a) + tint[2] * a, 255], i * 4);
      }
      rctx.putImageData(out, 0, 0);
      return canvas.toDataURL();
    };
    identity.forEach((p, i) => set(i, p));
    emit(panel(draw(identity), [230, 30, 30]));
    P.forEach((p, i) => set(i, p));
    const after = draw(P);
    emit(panel(after, [20, 90, 240]));
    const solo = rctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) { const v = 255 - 255 * after[i]; solo.data.set([v, v, v, 255], i * 4); }
    rctx.putImageData(solo, 0, 0);
    emit(canvas.toDataURL());
  };
  return { reference: ref.original, runs, P0, frozen, tabFits, score, centre, debug, done: () => host.remove() };
}

/** Search one set of parameters for the runs, scored as the mean over the
 *  problems (one per reference; their runs correspond index by index). */
function search(problems: Problem[]) {
  const runs = problems[0].runs;
  const frozen = runs.map((_, i) => problems.every((q) => q.frozen[i]));
  const score = (P: RunParams[]) => problems.reduce((sum, q) => sum + q.score(P), 0) / problems.length;
  const P = problems[0].P0.map((p) => ({ ...p }));
  const before = score(P);
  let best = before;
  const tryAt = (i: number, p: RunParams) => {
    const trial = P.map((q, j) => (j === i ? p : q));
    const s = score(trial);
    if (s > best + 1e-5) { best = s; P[i] = p; return true; }
    return false;
  };

  // Coarse scan per run, then a pattern search on all parameters.
  // Rotation, size and letter-spacing are searched jointly: moving the text
  // along the arc can fake a match at one end that only tracking fixes properly.
  runs.forEach((run, i) => {
    if (frozen[i] || run.fixed) return;
    const f = run.fontSize;
    if (run.arc) {
      for (let rot = -10; rot <= 10; rot += 1)
        for (let sc = 0.85; sc <= 1.251; sc += 0.05)
          for (let sp = -0.02; sp <= 0.121; sp += 0.02) tryAt(i, { ...P[i], rot, scale: sc, spacing: sp * f });
    } else {
      // Straight lines: size, tracking and position searched together (a
      // wordmark can match in width at the wrong size), then refined.
      const reach = run.line ? 40 : 60;
      const start = { ...P[i] };
      let bestHere = { p: start, s: -1 };
      for (let sc = 0.8; sc <= 1.301; sc += 0.1)
        for (let sp = -0.08; sp <= 0.121; sp += 0.04)
          for (let dx = -reach; dx <= reach; dx += 12)
            for (let dy = -reach; dy <= reach; dy += 12) {
              const trial = { ...start, scale: sc, spacing: sp * f, dx, dy };
              const sco = score(P.map((q, j) => (j === i ? trial : q)));
              if (sco > bestHere.s) bestHere = { p: trial, s: sco };
            }
      if (bestHere.s > best) { best = bestHere.s; P[i] = bestHere.p; }
    }
  });
  const keys = (i: number): Key[] => frozen[i] || runs[i].fixed ? [] : [
    ...(runs[i].arc ? (['scale', 'spacing', 'rot', 'eL', 'eR', 'eT', 'eB'] as Key[]) : (['scale', 'spacing', 'dx', 'dy'] as Key[])),
    ...P[i].gaps.map((_, n) => `gap:${n}` as Key),
    ...(P[i].tracks ?? []).map((_, n) => `trk:${n}` as Key),
  ];
  const em = (key: Key, run: Run, v: number) => (EM.includes(kind(key)) ? v * run.fontSize : v);
  const steps = runs.map((run, i) => Object.fromEntries(keys(i).map((key) => [key, em(key, run, STEP[kind(key)])])) as Record<Key, number>);
  for (let round = 0; round < 80; round++) {
    let improved = false;
    runs.forEach((run, i) => {
      for (const key of keys(i)) {
        const lim = LIMIT[kind(key)].map((v) => em(key, run, v));
        for (const sign of [1, -1]) {
          const v = Math.min(lim[1], Math.max(lim[0], get(P[i], key) + sign * steps[i][key]));
          if (v !== get(P[i], key) && tryAt(i, put(P[i], key, v))) { improved = true; break; }
        }
      }
    });
    if (!improved) {
      let done = true;
      runs.forEach((run, i) => keys(i).forEach((key) => {
        steps[i][key] /= 2;
        if (steps[i][key] > em(key, run, MIN[kind(key)])) done = false;
      }));
      if (done) break;
    }
  }
  return { P, before, after: best, frozen };
}

const round = (v: number, d: number) => +v.toFixed(d);
const saveRun = (p: RunParams, centre?: number): RunParams => ({
  scale: round(p.scale, 4), spacing: round(p.spacing, 3), gaps: p.gaps.map((g) => round(g, 2)),
  tracks: (p.tracks ?? []).map((g) => round(g, 3)),
  dr: round(p.dr, 2), dry: round(p.dry, 2), rot: round(p.rot, 3), dx: round(p.dx, 2), dy: round(p.dy, 2),
  ...(p.start !== undefined ? { start: round(p.start, 3) } : {}),
  ...(centre !== undefined ? { centre: round(centre, 3) } : {}),
});

/** debug: when given, receives an image of the letters found in the reference
 *  (grey), our text before the fit (red) and after it (blue). */
export async function fitRecreation(rec: Recreation, ref: ReferenceImage, debug?: (png: string) => void): Promise<LetteringFit> {
  const q = await prepare(rec, ref);
  const { P, before, after, frozen } = search([q]);
  if (debug) q.debug(P, debug);
  const runs = q.runs, tabFits = q.tabFits;
  const centres = runs.map((_, i) => q.centre(i, P));
  q.done();
  return {
    reference: ref.original,
    before: round(before, 4),
    after: round(after, 4),
    accepted: after > before + 0.01,
    frozen: runs.filter((_, i) => frozen[i]).map((run) => run.key),
    runs: Object.fromEntries(runs.flatMap((run, i) => (run.fixed ? [] : [[run.key, saveRun(P[i], centres[i])]]))),
    ...(runs.some((run) => run.shared)
      ? {
          shared: Object.fromEntries(
            runs.filter((run) => run.shared).map((run) => [
              run.key,
              {
                from: run.shared!.rec + (run.shared!.run ? ' ' + run.shared!.run : ''),
                shrink: round(tabFits[run.key]?.shrink ?? 1, 4),
                ...(tabFits[run.key]?.tracking ? { tracking: round(tabFits[run.key].tracking!, 3) } : {}),
              },
            ]),
          ),
        }
      : {}),
  };
}

/** One fit for a crest variant's lettering, scored against every member
 *  logo's reference at once. Each is judged only on the crest's lettering band
 *  (the frame's paper), so a logo's wordmark or tab doesn't weigh in, and each
 *  counts equally. */
export async function fitVariant(members: { rec: Recreation; ref: ReferenceImage }[]): Promise<LetteringFit> {
  const problems: Problem[] = [];
  for (const { rec, ref } of members) {
    const spec = rec.lettering.find((l) => l.shared && !l.shared.tab && CREST_RUNS.every((id) => l.only?.includes(id)))!;
    const own: Lettering = { ...spec, shared: undefined };
    problems.push(await prepare({ ...rec, layers: ['frame'], lettering: [own] }, ref));
  }
  const { P, before, after } = search(problems);
  const q = problems[0];
  const centres = q.runs.map((_, i) => q.centre(i, P));
  const members_ = Object.fromEntries(
    problems.map((pr, n) => [members[n].rec.id, { reference: pr.reference, before: round(pr.score(pr.P0), 4), after: round(pr.score(P), 4) }]),
  );
  problems.forEach((pr) => pr.done());
  return {
    reference: problems.map((pr) => pr.reference).join(', '),
    before: round(before, 4),
    after: round(after, 4),
    accepted: true,
    runs: Object.fromEntries(q.runs.map((run, i) => [run.key, saveRun(P[i], centres[i])])),
    members: members_,
  };
}
