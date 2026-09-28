import layout from '../../layout.json';
import { byFile, type FamilyId, type Piece } from './data';
import { mul, S, T, type Layer, type M } from './svg';
import { tabPiece } from './tab';

// Placements are computed by extract_primitives.py (from engine.js constants)
// and written to layout.json, so the site and the generator cannot drift.
const place = (key: keyof typeof layout.separators): M[] => {
  const s = layout.separators[key];
  return s.at.map(([x, y]) => mul(T(x, y), S(s.scale)));
};
const separatorHint = (key: keyof typeof layout.separators, size: string) => {
  const s = layout.separators[key];
  return `y ${s.y}, ${size} ${s.size}`;
};
const toAirtanker = layout['airtanker-operations'].crestTransform as M;
const wingMirror = layout['airtanker-operations'].wingMirror as M;

const v5 = 'bc-ministry-v5/';
const at = 'airtanker-operations/';

const WILDLIFE_PARTS = ['sky', 'mountains', 'distant-woodland', 'river', 'river-bank', 'large-tree', 'small-tree', 'eagle', 'elk', 'fish'];
const TREE_PARTS = ['sky', 'distant-forest', 'mountains', 'conifer'];

/** The shared crest (one frame, two scenes), optionally placed by a transform. */
function crestLayers(transform?: M, withWildlife = true): Layer[] {
  const t = transform ? { instances: [transform] } : {};
  return [
    { key: 'frame', label: 'Crest frame (shared)', file: v5 + 'crest/frame.svg', ...t },
    { key: 'tree', label: 'Tree scene (shared)', file: v5 + 'scenes/tree.svg', ...t },
    ...TREE_PARTS.map((n) => ({ key: 'tree-' + n, label: 'Tree part · ' + n.replace('-', ' '), file: `${v5}scenes/tree-parts/${n}.svg`, ...t })),
    // Not in the full-colour scene: the single-colour and airtanker crests draw the range as this line.
    { key: 'tree-ridge', label: 'Tree part · mountain ridge line', file: v5 + 'scenes/tree-parts/mountain-ridge.svg', hint: 'Single-colour and airtanker crests', ...t },
    ...(withWildlife
      ? [
          { key: 'wildlife', label: 'Wildlife scene', file: v5 + 'scenes/wildlife.svg', ...t },
          ...WILDLIFE_PARTS.map((n) => ({ key: 'wl-' + n, label: 'Wildlife part · ' + n.replace('-', ' '), file: `${v5}scenes/wildlife-parts/${n}.svg`, ...t })),
        ]
      : []),
  ];
}

/** Every placeable layer per family, in back-to-front drawing order. */
export const LAYERS: Record<FamilyId, Layer[]> = {
  'bc-ministry-v5': [
    { key: 'wings', label: 'Airtanker wings (v5 engine)', file: v5 + 'tabs/airtanker-wings.svg' },
    { key: 'band', label: 'Airtanker band (v5 engine)', file: v5 + 'tabs/airtanker-band.svg' },
    { key: 'ribbon-lower', label: 'Service ribbon · lower tab', file: v5 + 'tabs/service-ribbon.svg' },
    { key: 'ribbon-upper', label: 'Service ribbon · upper tab', file: v5 + 'tabs/service-ribbon.svg', instances: [layout.upperTabTransform as M], hint: 'Same shape, upside down: rotate 180° about the crest centre' },
    { key: 'plate', label: 'Parks plate', file: v5 + 'tabs/parks-plate.svg' },
    ...crestLayers(),
    { key: 'circle-caps', label: 'Separator circles · capitals crest', file: v5 + 'marks/separator-circle.svg', instances: place('circle-caps'), hint: separatorHint('circle-caps', 'radius') },
    { key: 'circle-long', label: 'Separator circles · long ministry', file: v5 + 'marks/separator-circle.svg', instances: place('circle-long'), hint: separatorHint('circle-long', 'radius') },
    { key: 'diamond', label: 'Separator diamonds', file: v5 + 'marks/separator-diamond.svg', instances: place('diamond'), hint: separatorHint('diamond', 'half-diagonal') },
  ],
  'airtanker-operations': [
    { key: 'band', label: 'Lower band', file: at + 'lower-band.svg' },
    { key: 'wing', label: 'Wing master ×2 (mirrored)', file: at + 'wing.svg', instances: [[1, 0, 0, 1, 0, 0], wingMirror], hint: `Master + translate(${wingMirror[4]} 0) scale(-1 1)` },
    { key: 'wings', label: 'Wing pair', file: at + 'wings-pair.svg' },
    ...crestLayers(toAirtanker, false).map((l) => ({ ...l, hint: `Shared crest, scaled ×${layout['airtanker-operations'].crestScale.toFixed(3)} into this layout` })),
    {
      key: 'diamond',
      label: 'Diamond markers',
      file: at + 'diamond.svg',
      instances: layout['airtanker-operations'].diamonds.map(([x, y]) => T(x, y)),
      hint: 'On the shared crest band',
    },
  ],
};

export interface Preset {
  name: string;
  family: FamilyId;
  layers: string[];
  theme?: string;
  reference?: string;
}

const wlParts = WILDLIFE_PARTS.map((n) => 'wl-' + n);
const treeParts = TREE_PARTS.map((n) => 'tree-' + n);

export const PRESETS: Preset[] = [
  { name: 'Forests', family: 'bc-ministry-v5', layers: ['frame', 'wildlife', 'circle-caps'], theme: 'source', reference: 'bc-ministry-v5:forests' },
  { name: 'Forests · Wildfire Service', family: 'bc-ministry-v5', layers: ['ribbon-lower', 'frame', 'wildlife', 'circle-caps'], theme: 'source', reference: 'bc-ministry-v5:forests-wildfire' },
  { name: 'Long ministry · Wildfire', family: 'bc-ministry-v5', layers: ['ribbon-lower', 'frame', 'wildlife', 'circle-long'], theme: 'source', reference: 'bc-ministry-v5:long-wildfire' },
  { name: 'Wildlife crest from parts', family: 'bc-ministry-v5', layers: ['frame', ...wlParts, 'circle-caps'], theme: 'source', reference: 'bc-ministry-v5:forests' },
  { name: 'Forest Service', family: 'bc-ministry-v5', layers: ['frame', 'tree', 'diamond'], theme: 'forest', reference: 'bc-ministry-v5:forest-service' },
  { name: 'Forest Service · single colour', family: 'bc-ministry-v5', layers: ['frame', 'tree', 'tree-ridge', 'diamond'], theme: 'mono', reference: 'bc-ministry-v5:forest-service' },
  { name: 'Tree crest from parts', family: 'bc-ministry-v5', layers: ['frame', ...treeParts, 'diamond'], theme: 'forest', reference: 'bc-ministry-v5:forest-service' },
  { name: 'Wildfire Management', family: 'bc-ministry-v5', layers: ['ribbon-upper', 'frame', 'tree', 'diamond'], theme: 'forest', reference: 'bc-ministry-v5:wildfire-management' },
  { name: 'Parks', family: 'bc-ministry-v5', layers: ['plate', 'frame', 'tree'], theme: 'parks', reference: 'bc-ministry-v5:parks' },
  { name: 'Airtanker (v5 engine)', family: 'bc-ministry-v5', layers: ['wings', 'band', 'frame', 'tree', 'tree-ridge', 'diamond'], theme: 'gold', reference: 'bc-ministry-v5:airtanker' },
  { name: 'Airtanker badge', family: 'airtanker-operations', layers: ['band', 'wings', 'frame', 'tree', 'tree-ridge', 'diamond'], theme: 'airtanker', reference: 'airtanker-operations:airtanker-operations' },
  { name: 'Airtanker from parts', family: 'airtanker-operations', layers: ['band', 'wing', 'frame', ...treeParts, 'tree-ridge', 'diamond'], theme: 'airtanker', reference: 'airtanker-operations:airtanker-operations' },
];

export function resolve(family: FamilyId, keys: Iterable<string>): { layer: Layer; piece: Piece }[] {
  const wanted = new Set(keys);
  return LAYERS[family].filter((l) => wanted.has(l.key)).map((layer) => ({ layer, piece: byFile.get(layer.file)! }));
}

/** Reassembly checks: the parts, stacked, should reproduce the composite.
 *  `drawn` instead draws the part with the site's own generator. */
export const REASSEMBLY: { name: string; family: FamilyId; target: string; parts: string[]; drawn?: () => Piece }[] = [
  { name: 'Tree scene = sky + forest + mountains + conifer', family: 'bc-ministry-v5', target: v5 + 'scenes/tree.svg', parts: treeParts },
  { name: 'Wildlife scene = its 10 parts', family: 'bc-ministry-v5', target: v5 + 'scenes/wildlife.svg', parts: wlParts },
  { name: 'Tree crest = shared frame + tree scene', family: 'bc-ministry-v5', target: v5 + 'crest/tree-crest.svg', parts: ['frame', 'tree'] },
  { name: 'Wildlife crest = shared frame + wildlife scene', family: 'bc-ministry-v5', target: v5 + 'crest/wildlife-crest.svg', parts: ['frame', 'wildlife'] },
  { name: 'Airtanker wing pair = master + mirror', family: 'airtanker-operations', target: at + 'wings-pair.svg', parts: ['wing'] },
  { name: 'Service tab: site generator (tab.ts) = generated file', family: 'bc-ministry-v5', target: v5 + 'tabs/service-ribbon.svg', parts: [], drawn: () => tabPiece('lower') },
];
