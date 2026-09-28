import galleryJson from '../../gallery.json';
import letteringJson from '../../lettering.json';
import fitJson from '../../lettering-fit.json';
import layout from '../../layout.json';
import packageSvg from '../../../airtanker-operations/airtanker-operations-editable.svg?raw';
import { parseVB, themes, type FamilyId, type VB } from './data';
import { resolve } from './layers';
import { apply, composite, parse, prefixIds, serialize, SVG_NS, unionBox, type M } from './svg';

// Lettering is live text from the v5 studio's generated examples: the engine
// fitted it to exactly this crest geometry. The artwork is our primitives, so
// extract_primitives.py keeps only each example's lettering (lettering.json).
const examples = letteringJson as Record<string, string>;
const example = (name: string) => {
  const svg = examples[name];
  if (!svg) throw new Error(`Missing lettering for v5 example ${name}; rerun extract_primitives.py`);
  return svg;
};
const refUrls = import.meta.glob<string>('../../references/*', { query: '?url', import: 'default', eager: true });

export interface Lettering {
  /** v5 example to take the text from, or the airtanker package master. */
  from: string;
  /** Keep only these runs (data-live-text / element id); default: all. */
  only?: string[];
  /** Leave out these runs. */
  skip?: string[];
  fill?: string;
  replace?: Record<string, string>;
  transform?: M;
  /** Shared lettering: the run is not fitted here but placed exactly as in
   *  another saved fit (`rec`: a recreation or a crest variant; `run`: its run
   *  key, by default the same run id at index 0), so it is identical on every
   *  logo that uses it. `tab: 'upper'` carries it through the upper-tab
   *  transform, turned to read upright along the top (see sharedRun). There,
   *  `face` swaps the typeface (capitals kept the same height) and `fillTab`
   *  sets the letter-spacing so the words cover the same stretch of tab as the
   *  source line, as on patches whose top tab is lettered end to end. */
  shared?: { rec: string; run?: string; tab?: 'upper'; face?: { family: string; weight: string }; fillTab?: boolean };
}

export interface Recreation {
  id: string;
  name: string;
  family: FamilyId;
  layers: string[];
  theme: string;
  lettering: Lettering[];
  /** What the v5 studio drew, for the v5 switch, when `lettering` differs. */
  studio?: Lettering[];
  note?: string;
  /** Left off the Recreations page unless "show hidden" is on. Still fitted,
   *  and still counted in its crest variant's shared fit. */
  hidden?: boolean;
}

const toAirtanker = layout['airtanker-operations'].crestTransform as M;

// Lettering around the oval: one fit per crest variant, fitted to every
// reference of that variant at once (fit.ts fitVariant) and used unchanged by
// each logo with that crest. Parks has its own face and stays fitted alone.
export const CREST_VARIANTS = [
  { id: 'crest-wildlife-caps', name: 'wildlife crest, capitals' },
  { id: 'crest-wildlife-long', name: 'wildlife crest, long ministry' },
  { id: 'crest-tree', name: 'tree crest' },
] as const;
type Variant = (typeof CREST_VARIANTS)[number]['id'];
export const CREST_RUNS = ['upper', 'lower'];
const otherRuns = (from: string) =>
  Array.from(parse(example(from)).getElementsByTagName('text')).some((t) => !CREST_RUNS.includes(t.getAttribute('data-live-text') ?? t.getAttribute('id') ?? ''));
/** A logo's lettering from its v5 example: the crest lines shared with its
 *  variant, and any other lines (tab, wordmark...) fitted to its own reference. */
const crest = (from: string, variant: Variant, extra: Partial<Lettering> = {}): Lettering[] => [
  { from, only: CREST_RUNS, shared: { rec: variant }, ...extra },
  ...(otherRuns(from) ? [{ from, skip: CREST_RUNS, ...extra }] : []),
];

// The upper-tab lettering is the Forests · Wildfire Service lower tab as fitted
// ("WILDFIRE SERVICE"), carried through the upper-tab transform with only the
// words changed, in the colour of the crest it sits on.
const SERVICE: Lettering = { from: 'forests-wildfire', only: ['service'], shared: { rec: 'forests-wildfire', run: '1:service' } };
const inkOf = (from: string) => parse(example(from)).querySelector('text')?.getAttribute('fill') ?? undefined;
const upperService = (words: string, crest: string, look: Pick<NonNullable<Lettering['shared']>, 'face' | 'fillTab'> = {}): Lettering => ({
  ...SERVICE,
  replace: { 'WILDFIRE SERVICE': words },
  fill: inkOf(crest),
  shared: { ...SERVICE.shared!, tab: 'upper', ...look },
});
// The Wildfire Management patch letters its top tab in a condensed bold face,
// end to end: the v5 studio's condensed face for that tab.
const CONDENSED = { family: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif', weight: '700' };

export const RECREATIONS: Recreation[] = [
  { id: 'forests', name: 'Forests', family: 'bc-ministry-v5', layers: ['frame', 'wildlife', 'circle-caps'], theme: 'wildlife', lettering: crest('forests', 'crest-wildlife-caps') },
  { id: 'forests-wildfire', name: 'Forests · Wildfire Service', family: 'bc-ministry-v5', layers: ['ribbon-lower', 'frame', 'wildlife', 'circle-caps'], theme: 'wildlife', lettering: crest('forests-wildfire', 'crest-wildlife-caps') },
  { id: 'long-ministry', name: 'Long ministry', family: 'bc-ministry-v5', layers: ['frame', 'wildlife', 'circle-long'], theme: 'wildlife', lettering: crest('long-ministry', 'crest-wildlife-long') },
  { id: 'long-wildfire', name: 'Long ministry · Wildfire Service', family: 'bc-ministry-v5', layers: ['ribbon-lower', 'frame', 'wildlife', 'circle-long'], theme: 'wildlife', lettering: crest('long-wildfire', 'crest-wildlife-long') },
  { id: 'forest-service-mono', name: 'Forest Service · single colour', family: 'bc-ministry-v5', layers: ['frame', 'tree', 'tree-ridge', 'diamond'], theme: 'mono', lettering: crest('forest-service', 'crest-tree', { fill: '#000000' }) },
  {
    id: 'wildfire-management',
    name: 'Wildfire Management',
    family: 'bc-ministry-v5',
    layers: ['ribbon-upper', 'frame', 'tree', 'diamond'],
    theme: 'forest',
    lettering: [crest('wildfire-management', 'crest-tree')[0], upperService('WILDFIRE MANAGEMENT', 'wildfire-management', { face: CONDENSED, fillTab: true })],
    studio: [{ from: 'wildfire-management' }],
    note: 'The tab lettering sits where the Forests · Wildfire Service lower tab lettering lands when flipped onto the upper tab, in a condensed face spaced to fill the tab like the patch.',
  },
  {
    id: 'fire-control',
    name: 'Fire Control',
    family: 'bc-ministry-v5',
    layers: ['ribbon-upper', 'frame', 'tree', 'diamond'],
    theme: 'forest',
    lettering: [crest('wildfire-management', 'crest-tree')[0], upperService('FIRE CONTROL', 'wildfire-management')],
    studio: [{ from: 'wildfire-management', replace: { 'WILDFIRE MANAGEMENT': 'FIRE CONTROL' } }],
    note: 'The v5 studio excluded this one. The tab lettering is the Forests · Wildfire Service lower tab as fitted, flipped onto the upper tab (upright, words changed).',
  },
  { id: 'parks', name: 'Forest Service · Parks', family: 'bc-ministry-v5', layers: ['plate', 'frame', 'tree'], theme: 'parks', lettering: [{ from: 'parks' }] },
  {
    id: 'airtanker',
    name: 'Airtanker Operations',
    family: 'airtanker-operations',
    layers: ['band', 'wings', 'frame', 'tree', 'tree-ridge', 'diamond'],
    theme: 'airtanker',
    lettering: [
      { from: 'airtanker', only: CREST_RUNS, shared: { rec: 'crest-tree' }, transform: toAirtanker, fill: themes.airtanker.text },
      { from: 'package', only: ['airtanker-operations'] },
    ],
    note: 'Crest lettering is the shared tree-crest fit, scaled with the crest into this layout. The band lettering comes from the airtanker package master.',
  },
  { id: 'bcts-wildlife', name: 'BCTS · wildlife crest', family: 'bc-ministry-v5', layers: ['frame', 'wildlife', 'circle-long'], theme: 'wildlife', lettering: crest('bcts-wildlife', 'crest-wildlife-long'), hidden: true },
  { id: 'bcts-tree', name: 'BCTS · Forest Service', family: 'bc-ministry-v5', layers: ['frame', 'tree', 'diamond'], theme: 'forest', lettering: crest('bcts-tree', 'crest-tree'), hidden: true },
  { id: 'bcts-district', name: 'BCTS · district', family: 'bc-ministry-v5', layers: ['frame', 'tree', 'diamond'], theme: 'forest', lettering: crest('bcts-district', 'crest-tree'), hidden: true },
  { id: 'bcts-stacked-words', name: 'BC / Timber / Sales', family: 'bc-ministry-v5', layers: ['frame', 'tree', 'diamond'], theme: 'forest', lettering: crest('bcts-stacked-words', 'crest-tree') },
  { id: 'branch-strip', name: 'Forest Analysis & Inventory', family: 'bc-ministry-v5', layers: ['frame', 'tree', 'diamond'], theme: 'mono', lettering: crest('branch-strip', 'crest-tree') },
];

/** The logos whose crest lettering a variant fit is shared by. */
export const variantMembers = (variant: string) => RECREATIONS.filter((r) => r.lettering.some((l) => l.shared?.rec === variant && !l.shared.tab));

// ------------------------------------------------------------- references --
export interface ReferenceImage {
  id: string;
  role: 'primary' | 'alternate' | 'context';
  url: string;
  original: string;
  width: number;
  height: number;
  registration: { x: number; y: number; w: number; h: number } | null;
  method: string;
  note: string;
}

export const referencesFor = (id: string): ReferenceImage[] =>
  galleryJson.references
    .filter((r) => r.id === id)
    .map((r) => ({ ...r, role: r.role as ReferenceImage['role'], url: refUrls['../../' + r.file] }));


// -------------------------------------------------------- lettering runs --
/** A curved baseline as an ellipse arc: centre, radii, the angle (degrees) the
 *  text is centred on, the half-span drawn either side, and the sweep flag. */
export interface Arc { cx: number; cy: number; rx: number; ry: number; mid: number; half: number; sweep: 0 | 1 }

/** Adjustments to one run: size ×scale, letter-spacing +spacing (units), extra
 *  space before each word after the first (gaps, units), a shift dx, dy (for
 *  an arc: of its centre), and for arcs the radius +dr (both radii), +dry
 *  (vertical radius only) and rotation +rot (degrees) along the arc. */
export interface RunParams {
  scale: number; spacing: number; gaps: number[]; dr: number; dry: number; rot: number; dx: number; dy: number;
  /** Extra letter-spacing per word (units): each word's own tracking. */
  tracks?: number[];
  /** Arcs: anchor the line at its first letter, this far along the path, so a
   *  gap only moves the words after it (instead of centring on the path). */
  start?: number;
  /** With 'middle', `start` is where the middle of the line goes instead. */
  anchor?: 'middle';
  /** Measured by the fitter, arcs only: the angle (degrees) on the fitted
   *  baseline ellipse at the middle of the line, so a shared run can be moved. */
  centre?: number;
}
export const IDENTITY: RunParams = { scale: 1, spacing: 0, gaps: [], dr: 0, dry: 0, rot: 0, dx: 0, dy: 0 };

/** Put each word in a tspan: dx is the extra gap before it (words after the
 *  first) and letter-spacing its own tracking. On a text path, dx moves the
 *  rest of the line along the path. The text stays live, glyphs unstretched. */
export function setWords(holder: Element, text: string, gaps: number[], tracks: number[] = [], spacing = 0) {
  holder.textContent = '';
  text.split(' ').forEach((word, i) => {
    const span = holder.ownerDocument.createElementNS(SVG_NS, 'tspan');
    if (i > 0 && gaps[i - 1]) span.setAttribute('dx', gaps[i - 1].toFixed(3));
    if (tracks[i]) span.setAttribute('letter-spacing', (spacing + tracks[i]).toFixed(3));
    span.textContent = (i > 0 ? ' ' : '') + word;
    holder.append(span);
  });
}

export interface Run {
  key: string;
  text: string;
  /** The original <text> element, serialized (attributes kept for layout). */
  xml: string;
  family: string;
  weight: string;
  fontSize: number;
  letterSpacing: number;
  wordSpacing: number;
  strokeWidth: number;
  /** Maps the run's coordinates into the recreation's coordinates. */
  matrix: M;
  arc: Arc | null;
  /** Text on a straight path (e.g. the Parks plate): the path's endpoints. */
  line: [number, number, number, number] | null;
  x: number;
  y: number;
  /** Shared runs: where the placement comes from, and the placement itself.
   *  The fitter draws these but never adjusts them. */
  shared?: Lettering['shared'];
  fixed?: RunParams;
}

/** SVG endpoint arc -> centre parameterisation (no x-axis rotation). */
function arcFromPath(d: string, startOffset: number): Arc | null {
  const n = d.match(/-?[\d.]+(?:e-?\d+)?/gi)?.map(Number);
  if (!/A/i.test(d) || !n || n.length < 9) return null;
  const [x1, y1, rx0, ry0, , fa, fs, x2, y2] = n;
  let rx = Math.abs(rx0), ry = Math.abs(ry0);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const lam = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx;
  const k = Math.sqrt(Math.max(0, num / (rx * rx * dy * dy + ry * ry * dx * dx))) * (fa === fs ? -1 : 1);
  const cx = (k * rx * dy) / ry + (x1 + x2) / 2, cy = (-k * ry * dx) / rx + (y1 + y2) / 2;
  const ang = (x: number, y: number) => (Math.atan2((y - cy) / ry, (x - cx) / rx) * 180) / Math.PI;
  let a1 = ang(x1, y1), a2 = ang(x2, y2);
  if (fs) while (a2 <= a1) a2 += 360;
  else while (a2 >= a1) a2 -= 360;
  // The text is centred at startOffset along the path's length: find that angle.
  const steps = 720, pts: number[] = [0];
  let prev = [cx + rx * Math.cos((a1 * Math.PI) / 180), cy + ry * Math.sin((a1 * Math.PI) / 180)];
  for (let i = 1; i <= steps; i++) {
    const a = ((a1 + ((a2 - a1) * i) / steps) * Math.PI) / 180, q = [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    pts.push(pts[i - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1]));
    prev = q;
  }
  const target = pts[steps] * startOffset;
  const i = pts.findIndex((v) => v >= target);
  const mid = a1 + ((a2 - a1) * Math.max(0, i)) / steps;
  return { cx, cy, rx, ry, mid, half: Math.min(170, Math.max(110, Math.abs(a2 - a1) / 2 + 25)), sweep: fs ? 1 : 0 };
}

/** Length of an ellipse arc between two angles (degrees). */
function arcLength(a: Arc, from: number, to: number) {
  const steps = 720, pt = (deg: number) => [a.rx * Math.cos((deg * Math.PI) / 180), a.ry * Math.sin((deg * Math.PI) / 180)];
  let length = 0, prev = pt(from);
  for (let i = 1; i <= steps; i++) {
    const q = pt(from + ((to - from) * i) / steps);
    length += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
    prev = q;
  }
  return length;
}

/** The baseline for a run after adjustment: symmetric about the (rotated) centre angle. */
function arcPath(a: Arc, dr: number, rot: number, dry = 0, dx = 0, dy = 0) {
  const s = a.sweep ? 1 : -1, rx = a.rx + dr, ry = a.ry + dr + dry;
  const at = (deg: number) => [a.cx + dx + rx * Math.cos((deg * Math.PI) / 180), a.cy + dy + ry * Math.sin((deg * Math.PI) / 180)].map((v) => +v.toFixed(4));
  const [x1, y1] = at(a.mid + rot - s * a.half), [x2, y2] = at(a.mid + rot + s * a.half);
  return `M ${x1} ${y1} A ${+rx.toFixed(4)} ${+ry.toFixed(4)} 0 ${a.half * 2 > 180 ? 1 : 0} ${a.sweep} ${x2} ${y2}`;
}

export const letteringDoc = (spec: Lettering) => parse(spec.from === 'package' ? packageSvg : example(spec.from));
const runId = (t: Element) => t.getAttribute('data-live-text') ?? t.getAttribute('id') ?? '';
const num = (v: string | null, d = 0) => (v === null || v === '' ? d : parseFloat(v));

/** How an upper-tab shared run was fitted to its tab (see sharedRun). */
export interface TabFit { shrink: number; tracking?: number }

/** The text runs one lettering spec contributes (keys `${index}:${id}`).
 *  Shared runs come back with their fixed placement, adjusted to their tab by
 *  `tabFit` (see sharedRun). */
function specRuns(spec: Lettering, index: number, tabFit: (key: string) => TabFit = () => ({ shrink: 1 })): Run[] {
  const runs: Run[] = [];
  const doc = letteringDoc(spec);
  for (const t of Array.from(doc.getElementsByTagName('text'))) {
    const id = runId(t);
    if ((spec.only && !spec.only.includes(id)) || spec.skip?.includes(id)) continue;
    const tp = t.getElementsByTagName('textPath')[0];
    const holder = tp ?? t;
    if (spec.replace?.[holder.textContent ?? '']) holder.textContent = spec.replace[holder.textContent ?? ''];
    let arc: Arc | null = null, line: Run['line'] = null;
    if (tp) {
      const ref = (tp.getAttribute('href') ?? tp.getAttribute('xlink:href') ?? '#').slice(1);
      const d = doc.querySelector(`[id="${ref}"]`)?.getAttribute('d') ?? '';
      arc = arcFromPath(d, num(tp.getAttribute('startOffset'), 50) / 100);
      const n = d.match(/-?[\d.]+(?:e-?\d+)?/gi)?.map(Number) ?? [];
      if (!arc && /L/i.test(d) && n.length >= 4) line = [n[0], n[1], n[2], n[3]];
    }
    const run: Run = {
      key: `${index}:${id}`,
      text: holder.textContent ?? '',
      xml: serialize(t),
      family: t.getAttribute('font-family') ?? 'sans-serif',
      weight: t.getAttribute('font-weight') ?? '400',
      fontSize: num(t.getAttribute('font-size'), 16),
      letterSpacing: num(t.getAttribute('letter-spacing')),
      wordSpacing: num(t.getAttribute('word-spacing')),
      strokeWidth: t.getAttribute('stroke') && t.getAttribute('stroke') !== 'none' ? num(t.getAttribute('stroke-width'), 1) : 0,
      matrix: spec.transform ?? [1, 0, 0, 1, 0, 0],
      arc,
      line,
      x: num(t.getAttribute('x')),
      y: num(t.getAttribute('y')),
    };
    runs.push(spec.shared ? sharedRun(run, spec.shared, tabFit(run.key)) : run);
  }
  return runs;
}

/** Every text run of a recreation, as the fitter needs it. */
export const letteringRuns = (rec: Recreation, tabFit?: (key: string) => TabFit): Run[] =>
  rec.lettering.flatMap((spec, i) => specRuns(spec, i, tabFit ?? savedTabFit(rec.id)));
const savedTabFit = (id: string) => (key: string): TabFit => fits[id]?.shared?.[key] ?? { shrink: 1 };

// Cap heights (em): how far the capitals reach from the baseline.
const capHeight = (family: string) => (/Roboto Condensed/.test(family) ? 1456 / 2048 : 1462 / 2048);

/** A shared run, placed exactly as in the recreation it was fitted on.
 *
 *  On the upper tab the ribbon is the lower one through layout.upperTabTransform
 *  (turned upside down: rotate 180° about the crest centre). The fitted baseline
 *  ellipse, size, letter-spacing, word gaps and tracking all go through that
 *  transform unchanged. Rotated, the letters would hang upside down from the
 *  baseline; to read upright the baseline runs the other way and moves to the
 *  inner edge of the same band of letters. The line stays centred where the
 *  fitted line's middle lands, so other words sit on the tab the same way.
 *  With `from.face` the letters change face at the same cap height. The fitter
 *  sets `fit`: tracking is added letter-spacing (units), and shrink < 1 scales
 *  letters, spacing and gaps evenly about the middle of the band when the words
 *  are too long for the tab. */
function sharedRun(run: Run, from: NonNullable<Lettering['shared']>, fit: TabFit = { shrink: 1 }): Run {
  const key = from.run ?? `0:${run.key.split(':')[1]}`, src = fits[from.rec]?.runs[key];
  if (!src) throw new Error(`No saved fit for ${from.rec} ${key}: run fit_lettering.py ${from.rec}`);
  if (!from.tab) return { ...run, shared: from, fixed: src };
  if (!run.arc || src.centre === undefined) throw new Error(`${from.rec} ${key}: shared on the upper tab needs an arc fitted with its centre measured`);
  const { shrink, tracking = 0 } = fit;
  const T = layout.upperTabTransform as M, g = Math.hypot(T[0], T[1]), k = g * shrink;
  // The fitted baseline ellipse, then through the transform (a point at angle a lands at a + 180°).
  const cx = run.arc.cx + src.dx, cy = run.arc.cy + src.dy, rx = run.arc.rx + src.dr, ry = run.arc.ry + src.dr + src.dry;
  const [ux, uy] = apply(T, [cx, cy]);
  const size = run.fontSize * src.scale, family = from.face?.family ?? run.family;
  const band = capHeight(run.family) * size * g, inward = (band + band * shrink) / 2;
  const faceSize = (size * capHeight(run.family)) / capHeight(family);
  const arc: Arc = { cx: ux, cy: uy, rx: rx * g - inward, ry: ry * g - inward, mid: src.centre + 180, half: run.arc.half, sweep: run.arc.sweep ? 0 : 1 };
  const words = run.text.split(' ').length;
  const pad = (v: number[], n: number) => Array.from({ length: n }, (_, i) => (v[i] ?? 0) * k);
  const weight = from.face?.weight ?? run.weight;
  let xml = run.xml;
  if (from.face) {
    const el = parse(run.xml).documentElement;
    el.setAttribute('font-family', family);
    el.setAttribute('font-weight', weight);
    xml = serialize(el);
  }
  return {
    ...run,
    xml,
    family,
    weight,
    fontSize: faceSize * k,
    letterSpacing: (run.letterSpacing * src.scale + src.spacing) * k + tracking * shrink,
    wordSpacing: run.wordSpacing * src.scale * k,
    strokeWidth: run.strokeWidth * k,
    arc,
    shared: from,
    fixed: {
      ...IDENTITY,
      gaps: pad(src.gaps, words - 1),
      tracks: words > 1 ? pad(src.tracks ?? [], words) : [],
      start: arcLength(arc, arc.mid - (arc.sweep ? 1 : -1) * arc.half, arc.mid),
      anchor: 'middle',
    },
  };
}

export type RunAttributes =
  | { fontSize: number; letterSpacing: number; wordSpacing: number; d: string }
  | { fontSize: number; letterSpacing: number; wordSpacing: number; x: number; y: number };

/** The attributes a run gets for a given adjustment. */
export function runAttributes(run: Run, p: RunParams): RunAttributes {
  const fontSize = run.fontSize * p.scale;
  const letterSpacing = run.letterSpacing * p.scale + p.spacing;
  const wordSpacing = run.wordSpacing * p.scale;
  if (run.arc) return { fontSize, letterSpacing, wordSpacing, d: arcPath(run.arc, p.dr, p.rot, p.dry ?? 0, p.dx, p.dy) };
  if (run.line) {
    const [x1, y1, x2, y2] = run.line;
    return { fontSize, letterSpacing, wordSpacing, d: `M ${x1 + p.dx} ${y1 + p.dy} L ${x2 + p.dx} ${y2 + p.dy}` };
  }
  return { fontSize, letterSpacing, wordSpacing, x: run.x + p.dx, y: run.y + p.dy };
}

// ------------------------------------------------------------- saved fits --
export interface LetteringFit {
  reference: string;
  before: number;
  after: number;
  accepted: boolean;
  /** Runs left at their v5 placement (not over any lettering zone). */
  frozen?: string[];
  runs: Record<string, RunParams>;
  /** Shared runs (placed from another fit, not fitted here) and how much an
   *  upper-tab one was shrunk to fit its tab (1 = same size). */
  shared?: Record<string, { from: string } & TabFit>;
  /** Crest variants: how each logo's reference scores with the shared fit. */
  members?: Record<string, { reference: string; before: number; after: number }>;
}
export const fits = fitJson as Record<string, LetteringFit>;

// ----------------------------------------------------------------- build --
function lettering(rec: Recreation, spec: Lettering, index: number, prefix: string, adjust: Record<string, RunParams> | null, fitted: boolean) {
  const doc = letteringDoc(spec);
  const runs = (spec.shared && fitted) || adjust ? specRuns(spec, index, savedTabFit(rec.id)) : [];
  prefixIds(doc, prefix);
  const find = (id: string) => doc.querySelector(`[id="${id}"]`);
  let defs = '', under = '', over = '';
  for (const t of Array.from(doc.getElementsByTagName('text'))) {
    const id = t.getAttribute('data-live-text') ?? t.getAttribute('id')?.slice(prefix.length) ?? '';
    if ((spec.only && !spec.only.includes(id)) || spec.skip?.includes(id)) continue;
    const tp = t.getElementsByTagName('textPath')[0];
    const baseline = tp ? find((tp.getAttribute('href') ?? tp.getAttribute('xlink:href') ?? '#').slice(1)) : null;
    const holder = tp ?? t;
    if (spec.replace?.[holder.textContent ?? '']) holder.textContent = spec.replace[holder.textContent ?? ''];
    const run = runs.find((r) => r.key === `${index}:${id}`);
    const p = run?.fixed ?? adjust?.[`${index}:${id}`];
    if (p) {
      if (run) {
        const a = runAttributes(run, p);
        t.setAttribute('font-size', a.fontSize.toFixed(3));
        t.setAttribute('letter-spacing', a.letterSpacing.toFixed(3));
        t.setAttribute('word-spacing', a.wordSpacing.toFixed(3));
        if (run.strokeWidth) t.setAttribute('stroke-width', run.strokeWidth.toFixed(3));
        if (run.shared) { t.setAttribute('font-family', run.family); t.setAttribute('font-weight', run.weight); }
        if ('d' in a && baseline && tp) {
          baseline.setAttribute('d', a.d);
          if (p.start === undefined) tp.setAttribute('startOffset', '50%');
          else { t.setAttribute('text-anchor', p.anchor ?? 'start'); tp.setAttribute('startOffset', p.start.toFixed(3)); }
        }
        if ('x' in a) { t.setAttribute('x', a.x.toFixed(3)); t.setAttribute('y', a.y.toFixed(3)); }
        if (p.gaps?.some(Boolean) || p.tracks?.some(Boolean)) setWords(holder, holder.textContent ?? '', p.gaps ?? [], p.tracks ?? [], a.letterSpacing);
      }
    }
    if (baseline) defs += serialize(baseline);
    if (spec.fill) {
      t.setAttribute('fill', spec.fill);
      const stroke = t.getAttribute('stroke');
      if (stroke && stroke !== 'none') t.setAttribute('stroke', spec.fill);
    }
    over += serialize(t);
  }
  // The branch strip's bar is drawn by the engine behind the crest.
  if (!spec.only) for (const bar of Array.from(doc.querySelectorAll('[data-layer="branch-strip"]'))) under += serialize(bar);
  if (spec.transform) over = `<g transform="matrix(${spec.transform.join(' ')})">${over}</g>`;
  const vb = spec.transform || spec.from === 'package' ? null : parseVB(doc.documentElement.getAttribute('viewBox') ?? '');
  return { defs, under, over, vb };
}

export interface Built {
  inner: string;
  vb: VB;
  parts: { key: string; label: string; file: string }[];
  letteringFrom: string[];
  fit: LetteringFit | null;
}

const cache = new Map<string, Built>();

/** Where a lettering spec's text comes from, for the card. */
function source(l: Lettering, fit?: TabFit) {
  if (l.from === 'package') return 'airtanker-operations-editable.svg';
  const variant = CREST_VARIANTS.find((v) => v.id === l.shared?.rec);
  if (variant) {
    const fit = fits[variant.id];
    return `${l.only?.join(', ')} as fitted across the ${variant.name} logos${fit?.members ? ` (${Object.keys(fit.members).length} references)` : ''}`;
  }
  if (l.shared) {
    const name = RECREATIONS.find((r) => r.id === l.shared!.rec)?.name ?? l.shared.rec;
    const words = Object.values(l.replace ?? {})[0];
    const face = l.shared.face ? ` in ${l.shared.face.family.split(',')[0].replace(/"/g, '')} ${l.shared.face.weight}` : '';
    const filled = l.shared.fillTab ? ', spaced to fill the tab' : '';
    const smaller = fit && fit.shrink < 1 ? `, shrunk evenly to ${(fit.shrink * 100).toFixed(1)}% to fit the tab` : '';
    return `${(l.shared.run ?? '').split(':')[1] ?? l.only?.join(', ')} as fitted on ${name}${l.shared.tab ? ', on the upper tab' : ''}${words ? ` as “${words}”` : ''}${face}${filled}${smaller}`;
  }
  return `v5 examples/${l.from}.svg${l.only ? ` (${l.only.join(', ')})` : l.skip ? ` (all but ${l.skip.join(', ')})` : ''}`;
}

/** fitted: apply the lettering fit saved for this recreation's reference, if
 *  any, and shared runs; otherwise show the lettering the v5 studio drew. */
export function build(rec: Recreation, fitted = true, adjust?: Record<string, RunParams>): Built {
  const fit = fitted && !adjust ? fits[rec.id] ?? null : null;
  const use = adjust ?? (fit?.accepted ? fit.runs : null);
  const specs = fitted || adjust ? rec.lettering : rec.studio ?? rec.lettering;
  const key = rec.id + (adjust ? '|' + JSON.stringify(adjust) : use ? '|fit' : fitted ? '|shared' : '|v5');
  const hit = cache.get(key);
  if (hit) return hit;
  const prefix = `r-${rec.id}-${use ? 'f' : fitted ? 's' : 'v'}-`;
  const chosen = resolve(rec.family, rec.layers);
  const c = chosen.length ? composite(chosen, { palette: themes[rec.theme] ?? null, idPrefix: prefix }) : null;
  let defs = c?.defs ?? '', under = '', over = '';
  const boxes: VB[] = c ? [c.vb] : [];
  specs.forEach((spec, i) => {
    const l = lettering(rec, spec, i, `${prefix}t${i}-`, use, fitted || !!adjust);
    defs += l.defs;
    under += l.under;
    over += l.over;
    if (l.vb) boxes.push(l.vb);
  });
  const built: Built = {
    inner: `<defs>${defs}</defs>${under}${c?.body ?? ''}${over}`,
    vb: unionBox(boxes),
    parts: chosen.map(({ layer }) => ({ key: layer.key, label: layer.label, file: layer.file })),
    letteringFrom: specs.map((l, i) => source(l, fits[rec.id]?.shared?.[`${i}:${l.only?.[0]}`])),
    fit: use ? fit : null,
  };
  cache.set(key, built);
  return built;
}
