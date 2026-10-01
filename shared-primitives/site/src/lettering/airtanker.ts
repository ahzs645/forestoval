import layout from '../../../layout.json';
import packageSvg from '../../../../airtanker-operations/airtanker-operations-editable.svg?raw';
import { themes } from '../data';
import { resolve } from '../layers';
import { apply, finish, parse, stack, SVG_NS, T, type M } from '../svg';
import type { Composition, LogoResult, Runtime } from './types';

// The Airtanker Operations badge as the Recreations tab rebuilds it: the
// package's band and wings and the shared crest (scaled into this layout),
// lettered live. The engine fits the crest lines with the airtanker recipe's
// configuration; they are carried into the layout with the crest transform.
// The band words keep the package master's curve, face and spacing.

const CREST = layout['airtanker-operations'].crestTransform as M;
const FAMILY = 'airtanker-operations' as const;
const ARTWORK = ['band', 'wings', 'frame', 'tree', 'tree-ridge'];
const BAND_FACE = 'condensed-bold';
/** Roboto Condensed's cap height (em): shrunk words stay centred on the band. */
const CAP = 1456 / 2048;
/** Longer words may run this much past the reference phrase before shrinking. */
const ALLOWANCE = 1.04;
/** Then the master's wide word gaps close up to half, then the letters shrink. */
const MIN_GAP = 0.5;
const MIN_SHRINK = 0.6;
/** The package's diamonds are drawn for the tree-heavy crest's marks. */
const HOME_MARK = 16.76;

/** The package master's band lettering: words, curve and type settings. */
const BAND = (() => {
  const doc = parse(packageSvg);
  const text = doc.querySelector('[id="airtanker-operations"]');
  const tp = text?.getElementsByTagName('textPath')[0];
  const ref = (tp?.getAttribute('href') ?? '').slice(1);
  const d = doc.querySelector(`[id="${ref}"]`)?.getAttribute('d') ?? '';
  const n = d.match(/-?[\d.]+/g)?.map(Number) ?? [];
  if (!text || !tp || n.length < 9) throw new Error('The airtanker package master has no band lettering to draw from.');
  const num = (name: string) => parseFloat(text.getAttribute(name) ?? '0');
  return {
    words: tp.textContent ?? '',
    cx: (n[0] + n[7]) / 2,
    cy: n[1],
    rx: n[2],
    ry: n[3],
    startOffset: tp.getAttribute('startOffset') ?? '50%',
    fill: text.getAttribute('fill') ?? '#EB001B',
    size: num('font-size'),
    letterSpacing: num('letter-spacing'),
    wordSpacing: num('word-spacing'),
    strokeWidth: num('stroke-width'),
  };
})();
const BAND_STYLE = 'font-kerning:none;font-variant-ligatures:none;white-space:pre';

function measure(words: string, family: string, weight: string, wordSpacing = BAND.wordSpacing) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('style', 'position:absolute;left:-10000px;top:0;width:10px;height:10px;visibility:hidden');
  const t = document.createElementNS(SVG_NS, 'text');
  for (const [k, v] of Object.entries({ 'font-family': family, 'font-weight': weight, 'font-size': BAND.size, 'letter-spacing': BAND.letterSpacing, 'word-spacing': wordSpacing, style: BAND_STYLE })) t.setAttribute(k, String(v));
  t.textContent = words;
  svg.append(t);
  document.body.append(svg);
  try { return t.getComputedTextLength(); } finally { svg.remove(); }
}

const r3 = (v: number) => +v.toFixed(3);
const matrix = (m: M) => `matrix(${m.map((v) => +v.toFixed(6)).join(' ')})`;
let seq = 0;

async function compose(result: LogoResult, { P, E }: Runtime, palette: Record<string, string> | null): Promise<LogoResult> {
  await E.ensureFonts([BAND_FACE]);
  const colours = palette ?? themes.airtanker;
  const prefix = `atk${++seq}-`;
  const face = P.FACES[BAND_FACE];
  const family = `"${face.family}", "Arial Narrow", sans-serif`, weight = String(face.weight);

  // Artwork, then the package's diamonds wherever the engine put the crest's marks.
  const art = stack(resolve(FAMILY, ARTWORK), { palette: colours, idPrefix: prefix });
  const [diamond] = resolve(FAMILY, ['diamond']);
  const sep = result.separators;
  const mark = P.CRESTS[result.crest]?.separatorSize ?? HOME_MARK;
  const instances = sep?.points?.length
    ? sep.points.map((p) => { const [x, y] = apply(CREST, p), k = mark / HOME_MARK; return [k, 0, 0, k, x, y] as M; })
    : diamond.layer.instances;
  const marks = stack([{ layer: { ...diamond.layer, instances }, piece: diamond.piece }], { palette: colours, idPrefix: prefix + 'd-' });
  const vb = finish({ defs: art.defs + marks.defs, body: '', boxes: [...art.boxes, ...marks.boxes], outlines: [] }).vb;

  // The band words: the master's settings while they fit the reference
  // phrase's stretch of band; past it the word gaps close up (to half), then
  // everything shrinks evenly, kept centred on the band.
  const words = (result.state.content.service ?? '').trim() ? result.state.content.service! : '';
  const room = measure(BAND.words, family, weight) * ALLOWANCE;
  const bare = words ? measure(words, family, weight, 0) : 0, gaps = words.trim().split(/\s+/).length - 1;
  let wordSpacing = BAND.wordSpacing, k = 1;
  if (bare + gaps * wordSpacing > room) {
    wordSpacing = Math.max(BAND.wordSpacing * MIN_GAP, (room - bare) / gaps || 0);
    if (bare + gaps * wordSpacing > room) k = Math.max(MIN_SHRINK, room / (bare + gaps * wordSpacing));
  }
  const need = bare + gaps * wordSpacing;
  const inset = (CAP * BAND.size * (1 - k)) / 2, rx = BAND.rx - inset, ry = BAND.ry - inset;

  const viewBox = { x: r3(vb[0]), y: r3(vb[1]), w: r3(vb[2]), h: r3(vb[3]) };
  const width = result.state.outputWidth;
  const doc = parse(
    `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" role="img" aria-labelledby="${prefix}title ${prefix}desc"` +
      ` viewBox="${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}" width="${width}" height="${r3((width * viewBox.h) / viewBox.w)}" data-composition="airtanker-package">` +
      `<title id="${prefix}title"></title><desc id="${prefix}desc">Airtanker Operations package artwork (shared primitives) with lettering fitted live by the v5 engine. Substitute fonts; not an authenticated official master. Font files are not embedded.</desc>` +
      `<defs>${art.defs}${marks.defs}<path id="${prefix}band" d="M ${r3(BAND.cx - rx)} ${BAND.cy} A ${r3(rx)} ${r3(ry)} 0 0 0 ${r3(BAND.cx + rx)} ${BAND.cy}"/></defs>` +
      `<g data-layer="composition">${art.body}<g data-layer="separators">${marks.body}</g>` +
      `<g data-layer="live-lettering" transform="${matrix(CREST)}"></g><g data-layer="service-lettering"></g></g></svg>`,
  );
  const root = doc.documentElement;
  root.querySelector('title')!.textContent = Object.values(result.state.content).filter(Boolean).join(' — ');
  const meta = result.svg.querySelector('metadata');
  if (meta) root.insertBefore(doc.importNode(meta, true), root.querySelector('defs'));

  // The crest lines exactly as the engine fitted them, in this layout's colour.
  const defs = root.querySelector('defs')!, crest = root.querySelector('[data-layer="live-lettering"]')!;
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

  if (words) {
    const t = doc.createElementNS(SVG_NS, 'text');
    for (const [name, v] of Object.entries({
      fill: BAND.fill, stroke: BAND.fill, 'stroke-width': r3(BAND.strokeWidth * k), 'stroke-linejoin': 'round', 'paint-order': 'stroke fill',
      'font-family': family, 'font-weight': weight, 'font-size': r3(BAND.size * k), 'letter-spacing': r3(BAND.letterSpacing * k), 'word-spacing': r3(wordSpacing * k),
      'text-anchor': 'middle', style: BAND_STYLE, 'data-slot': 'airtanker-band', 'data-face': BAND_FACE, 'data-live-text': 'service',
    })) t.setAttribute(name, String(v));
    const tp = doc.createElementNS(SVG_NS, 'textPath');
    tp.setAttribute('href', `#${prefix}band`);
    tp.setAttribute('startOffset', BAND.startOffset);
    tp.textContent = words;
    t.append(tp);
    root.querySelector('[data-layer="service-lettering"]')!.append(t);
  }

  // The engine's own tab (the photo-approximated wings and their label) is not drawn.
  const report = result.report.filter((r) => r.slot !== 'wings-label');
  if (words) report.push({ slot: 'airtanker-band', role: 'service-band', face: BAND_FACE, cap: CAP * BAND.size * k, trackingEm: BAND.letterSpacing / BAND.size, stage: k < 1 ? 'shrunk-to-band' : wordSpacing < BAND.wordSpacing ? 'word-gaps-closed' : 'package-master' });
  const fontIds = [...new Set(report.map((r) => r.face).filter((f): f is string => !!f))];
  const warnings = result.warnings.filter((w) => w.code !== 'APPROXIMATION' && !w.code.startsWith('FONT_') && !w.message.startsWith('wings-label:'));
  for (const id of fontIds) {
    const f = E.fontState.get(id), fc = P.FACES[id];
    if (f?.status !== 'ready') warnings.push({ code: 'FONT_FALLBACK', message: `${fc.family} ${fc.weight} is not verified. Load the reference faces or install that exact weight.` });
    else if (f.verified === false) warnings.push({ code: 'FONT_METRICS_MISMATCH', message: `${fc.family} ${fc.weight} (${f.source}) measures differently from the calibration face. Its fit is not the reference fit.` });
  }
  if (need * k > room + 0.5) warnings.push({ code: 'TEXT_FIT_OVERFLOW', message: `Airtanker band: the words still run ${(need * k - room).toFixed(1)} units past the band at ${Math.round(MIN_SHRINK * 100)}% size. Shorten the wording.` });
  else if (k < 1) warnings.push({ code: 'TEXT_STYLE_REDUCED', message: `Airtanker band: the word gaps were halved and the words shrunk evenly to ${(k * 100).toFixed(1)}% to stay on the band.` });

  return { ...result, svg: document.importNode(root, true) as unknown as SVGSVGElement, viewBox, report, warnings, fontIds };
}

/** Live lettering preset: the airtanker recipe's lettering on the package artwork. */
export const AIRTANKER_PACKAGE: Composition = {
  id: 'airtanker-package',
  name: 'Airtanker Operations · package',
  recipe: 'airtanker',
  confidence: 'Rebuilt from the shared primitives and the airtanker package master',
  compose,
};
