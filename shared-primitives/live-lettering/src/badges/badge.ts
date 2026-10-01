import { loadPiece } from '../pieces';
import { apply, finish, matrixAttr, parse, stack, SVG_NS, themes, type M, type Palette } from '../svg';
import type { Composition, ContentKey, LogoResult, Runtime } from '../types';

// A badge is an engine recipe's lettering drawn in other artwork, described as
// data (see airtanker.ts). The engine still fits every crest line with the
// recipe's configuration; the badge only says where things go:
//
//   artwork  generated primitives behind the crest, in the badge's coordinates
//   crest    the shared crest pieces, and the transform that places the crest
//            (and so its lettering) in the badge
//   marks    a piece put wherever the engine put the crest's separator marks
//   bands    extra curved lettering taken from a master SVG, editing one field
//   replaces the engine's own drawing the badge supersedes (its tab's slots and
//            warnings)

export interface BadgeBand {
  /** The content field these words edit; clicking them edits it too. */
  content: ContentKey;
  /** Name in the measurements and warnings, e.g. `airtanker-band`. */
  slot: string;
  label: string;
  /** A master SVG and the id of its curved <text>: the words, curve, size,
   *  spacing and colours all come from it. */
  master: string;
  text: string;
  /** Engine face to draw it in (loaded, verified and exported like the crest's). */
  face: string;
  /** Words may run `allowance` × the master's words before the word gaps close
   *  (to `minGap` × the master's), then everything shrinks evenly (to `minShrink`). */
  fit?: { allowance?: number; minGap?: number; minShrink?: number };
}

export interface BadgeDefinition {
  id: string;
  name: string;
  /** The engine recipe whose configuration, drafts and lettering it uses. */
  recipe: string;
  confidence?: string;
  /** themes.json palette used when the host passes none. */
  theme: string;
  artwork: Array<{ file: string; instances?: M[] }>;
  crest: { transform: M; pieces: string[] };
  /** `drawnFor`: the crest profile whose mark size the piece is drawn at; it is
   *  scaled with the engine's marks on other profiles. */
  marks?: { file: string; drawnFor: string };
  bands?: BadgeBand[];
  replaces?: { slots?: string[]; warnings?: string[] };
}

const FIT = { allowance: 1.04, minGap: 0.5, minShrink: 0.6 };
const BAND_STYLE = 'font-kerning:none;font-variant-ligatures:none;white-space:pre';
const SCALED = ['font-size', 'letter-spacing', 'word-spacing', 'stroke-width'];
const r3 = (v: number) => +v.toFixed(3);

/** A band's master lettering: its words, its arc and its <text> attributes. */
function readMaster(band: BadgeBand) {
  const doc = parse(band.master);
  const text = doc.querySelector(`[id="${band.text}"]`);
  const tp = text?.getElementsByTagName('textPath')[0];
  const ref = (tp?.getAttribute('href') ?? tp?.getAttribute('xlink:href') ?? '').slice(1);
  const d = doc.querySelector(`[id="${ref}"]`)?.getAttribute('d') ?? '';
  // A half ellipse across its centre: M x1 y A rx ry rot large sweep x2 y.
  const n = /^\s*M\s*([-\d.]+)[\s,]+([-\d.]+)\s*A\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+[-\d.]+[\s,]+([01])[\s,]*([01])[\s,]*([-\d.]+)[\s,]+([-\d.]+)\s*$/i.exec(d)?.slice(1).map(Number);
  if (!text || !tp || !n || Math.abs(n[1] - n[7]) > 0.01) throw new Error(`${band.label}: the master needs <text id="${band.text}"> on a half-ellipse textPath.`);
  const attrs: Record<string, string> = {};
  for (const a of Array.from(text.attributes)) if (!['id', 'font-family', 'font-weight', 'xml:space'].includes(a.name)) attrs[a.name] = a.value;
  attrs.style = BAND_STYLE;
  const num = (name: string) => parseFloat(attrs[name] ?? '0') || 0;
  return {
    words: tp.textContent ?? '',
    arc: { cx: (n[0] + n[6]) / 2, cy: n[1], rx: n[2], ry: n[3], large: n[4], sweep: n[5] },
    startOffset: tp.getAttribute('startOffset') ?? '50%',
    attrs,
    size: num('font-size'),
    wordSpacing: num('word-spacing'),
    letterSpacing: num('letter-spacing'),
  };
}
type Master = ReturnType<typeof readMaster>;

function measure(words: string, family: string, weight: string, m: Master, wordSpacing: number) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('style', 'position:absolute;left:-10000px;top:0;width:10px;height:10px;visibility:hidden');
  const t = document.createElementNS(SVG_NS, 'text');
  for (const [k, v] of Object.entries({ 'font-family': family, 'font-weight': weight, 'font-size': m.size, 'letter-spacing': m.letterSpacing, 'word-spacing': wordSpacing, style: BAND_STYLE })) t.setAttribute(k, String(v));
  t.textContent = words;
  svg.append(t);
  document.body.append(svg);
  try { return t.getComputedTextLength(); } finally { svg.remove(); }
}

/** Fit one band's words: the master's settings while they fit its stretch of
 *  band; past it the word gaps close up, then everything shrinks evenly,
 *  centred on the band. */
function fitBand(band: BadgeBand, m: Master, words: string, { P, E }: Runtime, prefix: string, doc: Document) {
  const fit = { ...FIT, ...band.fit };
  const face = P.FACES[band.face], family = `"${face.family}", ${face.fallback ?? 'sans-serif'}`, weight = String(face.weight);
  const room = measure(m.words, family, weight, m, m.wordSpacing) * fit.allowance;
  const bare = measure(words, family, weight, m, 0), gaps = words.trim().split(/\s+/).length - 1;
  let wordSpacing = m.wordSpacing, k = 1;
  if (bare + gaps * wordSpacing > room) {
    wordSpacing = Math.max(m.wordSpacing * fit.minGap, (room - bare) / gaps || 0);
    if (bare + gaps * wordSpacing > room) k = Math.max(fit.minShrink, room / (bare + gaps * wordSpacing));
  }
  const over = (bare + gaps * wordSpacing) * k - room;
  // The baseline moves toward the letters' middle as they shrink: inward on a
  // lower arc (letters stand toward the centre), outward on an upper one.
  const cap = E.metrics(words, band.face).cap * m.size;
  const shift = ((cap * (1 - k)) / 2) * (m.arc.sweep ? 1 : -1), rx = m.arc.rx + shift, ry = m.arc.ry + shift;
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('id', `${prefix}${band.slot}`);
  path.setAttribute('d', `M ${r3(m.arc.cx - rx)} ${m.arc.cy} A ${r3(rx)} ${r3(ry)} 0 ${m.arc.large} ${m.arc.sweep} ${r3(m.arc.cx + rx)} ${m.arc.cy}`);
  const text = doc.createElementNS(SVG_NS, 'text');
  for (const [name, v] of Object.entries(m.attrs)) text.setAttribute(name, SCALED.includes(name) ? String(r3((name === 'word-spacing' ? wordSpacing : parseFloat(v) || 0) * k)) : v);
  for (const [name, v] of Object.entries({ 'font-family': family, 'font-weight': weight, 'data-slot': band.slot, 'data-face': band.face, 'data-live-text': band.content })) text.setAttribute(name, v);
  const tp = doc.createElementNS(SVG_NS, 'textPath');
  tp.setAttribute('href', `#${prefix}${band.slot}`);
  tp.setAttribute('startOffset', m.startOffset);
  tp.textContent = words;
  text.append(tp);
  const stage = k < 1 ? 'shrunk-to-band' : wordSpacing < m.wordSpacing ? 'word-gaps-closed' : 'master';
  const row = { slot: band.slot, role: 'badge-band', face: band.face, cap: cap * k, trackingEm: m.letterSpacing / m.size, stage };
  const warning = over > 0.5
    ? { code: 'TEXT_FIT_OVERFLOW', message: `${band.label}: the words still run ${over.toFixed(1)} units past the band at ${Math.round(fit.minShrink * 100)}% size. Shorten the wording.` }
    : k < 1 ? { code: 'TEXT_STYLE_REDUCED', message: `${band.label}: the word gaps were closed and the words shrunk evenly to ${(k * 100).toFixed(1)}% to stay on the band.` } : null;
  return { path, text, row, warning };
}

let seq = 0;

/** The editor preset for a badge definition. */
export function defineBadge(def: BadgeDefinition): Composition {
  let masters: Master[] | undefined;
  const compose = async (result: LogoResult, runtime: Runtime, palette: Palette | null): Promise<LogoResult> => {
    const { P, E } = runtime, bands = def.bands ?? [];
    masters ??= bands.map(readMaster);
    await E.ensureFonts(bands.map((b) => b.face));
    const colours = palette ?? themes[def.theme];
    const prefix = `${def.id}-${++seq}-`;

    // Artwork behind the crest, then the crest, then the marks where the engine put them.
    const load = (files: Array<{ file: string; instances?: M[] }>) => Promise.all(files.map(async ({ file, instances }) => ({ layer: { instances }, piece: await loadPiece(file) })));
    const art = stack([...(await load(def.artwork)), ...(await load(def.crest.pieces.map((file) => ({ file, instances: [def.crest.transform] }))))], { palette: colours, idPrefix: prefix });
    let marks = { defs: '', body: '', boxes: [] as typeof art.boxes };
    const points = result.separators?.points;
    if (def.marks && points?.length) {
      const k = (P.CRESTS[result.crest]?.separatorSize ?? 1) / (P.CRESTS[def.marks.drawnFor]?.separatorSize ?? 1);
      const instances = points.map((p) => { const [x, y] = apply(def.crest.transform, p); return [k, 0, 0, k, x, y] as M; });
      marks = stack([{ layer: { instances }, piece: await loadPiece(def.marks.file) }], { palette: colours, idPrefix: prefix + 'marks-' });
    }
    const vb = finish({ defs: '', body: '', boxes: [...art.boxes, ...marks.boxes], outlines: [] }).vb;
    const viewBox = { x: r3(vb[0]), y: r3(vb[1]), w: r3(vb[2]), h: r3(vb[3]) }, width = result.state.outputWidth;

    const doc = parse(
      `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" role="img" aria-labelledby="${prefix}title ${prefix}desc"` +
        ` viewBox="${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}" width="${width}" height="${r3((width * viewBox.h) / viewBox.w)}" data-composition="${def.id}">` +
        `<title id="${prefix}title"></title><desc id="${prefix}desc">${def.name}: shared primitives with lettering fitted live by the v5 engine. Substitute fonts; not an authenticated official master. Font files are not embedded.</desc>` +
        `<defs>${art.defs}${marks.defs}</defs>` +
        `<g data-layer="composition">${art.body}<g data-layer="separators">${marks.body}</g>` +
        `<g data-layer="live-lettering" transform="${matrixAttr(def.crest.transform)}"></g><g data-layer="badge-lettering"></g></g></svg>`,
    );
    const root = doc.documentElement, defs = root.querySelector('defs')!;
    root.querySelector('title')!.textContent = Object.values(result.state.content).filter(Boolean).join(' — ');
    const meta = result.svg.querySelector('metadata');
    if (meta) root.insertBefore(doc.importNode(meta, true), defs);

    // The crest lines exactly as the engine fitted them, in the badge's colour.
    const crest = root.querySelector('[data-layer="live-lettering"]')!;
    for (const text of Array.from(result.svg.querySelectorAll('[data-layer="live-lettering"] text[data-live-text]'))) {
      if (!['upper', 'lower'].includes(text.getAttribute('data-live-text') ?? '')) continue;
      const copy = doc.importNode(text, true) as Element;
      copy.setAttribute('fill', colours.text);
      if (copy.getAttribute('stroke') && copy.getAttribute('stroke') !== 'none') copy.setAttribute('stroke', colours.text);
      const href = copy.querySelector('textPath')?.getAttribute('href')?.slice(1);
      const path = href && result.svg.querySelector(`[id="${href}"]`);
      if (path) defs.append(doc.importNode(path, true));
      crest.append(copy);
    }

    // The engine's drawing this badge replaces is left out of the measurements and warnings.
    const replaced = new Set(def.replaces?.slots ?? []);
    const report = result.report.filter((r) => !r.slot || !replaced.has(r.slot));
    const warnings = result.warnings.filter((w) => !def.replaces?.warnings?.includes(w.code) && !w.code.startsWith('FONT_') && ![...replaced].some((s) => w.message.startsWith(s + ':')));
    bands.forEach((band, i) => {
      const words = result.state.content[band.content]?.trim() ? result.state.content[band.content]! : '';
      if (!words) return;
      const f = fitBand(band, masters![i], words, runtime, prefix, doc);
      defs.append(f.path);
      root.querySelector('[data-layer="badge-lettering"]')!.append(f.text);
      report.push(f.row);
      if (f.warning) warnings.push(f.warning);
    });

    // Font checks for the faces actually drawn, as the engine reports them.
    const fontIds = [...new Set(report.map((r) => r.face).filter((f): f is string => !!f))];
    for (const id of fontIds) {
      const f = E.fontState.get(id), face = P.FACES[id];
      if (f?.status !== 'ready') warnings.push({ code: 'FONT_FALLBACK', message: `${face.family} ${face.weight} is not verified. Load the reference faces or install that exact weight.` });
      else if (f.verified === false) warnings.push({ code: 'FONT_METRICS_MISMATCH', message: `${face.family} ${face.weight} (${f.source}) measures differently from the calibration face. Its fit is not the reference fit.` });
    }
    return { ...result, svg: document.importNode(root, true) as unknown as SVGSVGElement, viewBox, report, warnings, fontIds };
  };
  return { id: def.id, name: def.name, recipe: def.recipe, confidence: def.confidence, compose };
}
