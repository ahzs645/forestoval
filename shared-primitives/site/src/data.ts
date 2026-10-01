import manifestJson from '../../manifest.json';
import layout from '../../layout.json';
import type { Palette, VB } from '@forestoval/live-lettering/svg';
export type { Palette, VB };
export { themes } from '@forestoval/live-lettering/svg';

interface ManifestEntry {
  file: string;
  family: string;
  title: string;
  source: string;
  note: string;
  viewBox: string;
  themable: boolean;
}

export interface Piece extends ManifestEntry {
  family: FamilyId;
  group: string;
  name: string;
  svg: string;
  vb: VB;
  /** For scene parts: the scene file they were cut from. */
  parent: string | null;
}

/** centre: where the shared crest's centre lands in each family's space. */
export const FAMILIES = {
  'bc-ministry-v5': { label: 'BC Ministry v5', space: '676-unit crest space', centre: layout.crestCentre as [number, number] },
  'airtanker-operations': { label: 'Airtanker package', space: '1448 × 1086 master', centre: layout['airtanker-operations'].crestCentre as [number, number] },
};
export type FamilyId = keyof typeof FAMILIES;

export const parseVB = (s: string) => s.trim().split(/[\s,]+/).map(Number) as VB;

// Generated SVGs, keyed by their path relative to this file.
const raw = import.meta.glob<string>(['../../bc-ministry-v5/**/*.svg', '../../airtanker-operations/**/*.svg'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const pieces: Piece[] = (manifestJson as ManifestEntry[]).map((m) => {
  const svg = raw['../../' + m.file];
  if (!svg) throw new Error(`Missing ${m.file}; rerun extract_primitives.py`);
  const parts = m.file.split('/');
  return {
    ...m,
    family: m.family as FamilyId,
    svg,
    vb: parseVB(m.viewBox),
    group: parts.slice(0, -1).join('/'),
    name: parts[parts.length - 1],
    parent: parts.length > 1 && parts[parts.length - 2].endsWith('-parts') ? parts.slice(0, -1).join('/').replace(/-parts$/, '.svg') : null,
  };
});

export const byFile = new Map(pieces.map((p) => [p.file, p]));
export const partsOf = (file: string) => pieces.filter((p) => p.parent === file);

/** Library sections: the building blocks you work with. Scene parts are listed
 *  under their scene rather than as sections of their own. */
export const SECTIONS: { id: string; label: string; blurb: string; match: (p: Piece) => boolean }[] = [
  { id: 'crest', label: 'Crest', blurb: 'The one shared frame, and the two finished blank crests.', match: (p) => p.group === 'bc-ministry-v5/crest' },
  { id: 'scenes', label: 'Scenes', blurb: 'What goes inside the crest window.', match: (p) => p.group === 'bc-ministry-v5/scenes' },
  { id: 'marks', label: 'Separators', blurb: 'Marks on the lettering band.', match: (p) => p.group === 'bc-ministry-v5/marks' },
  { id: 'tabs', label: 'Service tabs', blurb: 'Ribbon, plate and wings that attach to the crest.', match: (p) => p.group === 'bc-ministry-v5/tabs' },
  { id: 'airtanker', label: 'Airtanker package', blurb: 'The package’s own parts; it uses the shared crest.', match: (p) => p.family === 'airtanker-operations' },
];

// Tokens that actually paint a primitive (the rest colour wordmarks/strips).
export const PRIMITIVE_TOKENS = ['ink', 'paper', 'text', 'sky', 'water', 'wildlife', 'distant', 'earth', 'tree'];

// Full logos to overlay in Compose. Both share the primitives' coordinates.
// Loaded on demand: they are large, and only Compose shows them.
const refsLazy = import.meta.glob<string>(
  ['../../../bc-ministry-primitives-v5/examples/*.svg', '../../../airtanker-operations/airtanker-operations.svg'],
  { query: '?raw', import: 'default' },
);

export interface Reference {
  key: string;
  label: string;
  family: FamilyId;
  load: () => Promise<{ svg: string; vb: VB }>;
}

export const references: Reference[] = Object.entries(refsLazy)
  .map(([path, load]) => {
    const name = path.split('/').pop()!.replace(/\.svg$/, '');
    const family: FamilyId = path.includes('bc-ministry-primitives-v5') ? 'bc-ministry-v5' : 'airtanker-operations';
    return {
      key: `${family}:${name}`,
      label: family === 'bc-ministry-v5' ? `v5 example · ${name}` : 'Airtanker package · finished SVG',
      family,
      load: () => load().then((svg) => ({ svg, vb: parseVB(/viewBox="([^"]+)"/.exec(svg)![1]) })),
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));
