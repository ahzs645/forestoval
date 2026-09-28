import manifestJson from '../../manifest.json';
import themesJson from '../../themes.json';

export type VB = [number, number, number, number];
export type Palette = Record<string, string>;

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

export const FAMILIES = {
  'bc-ministry-v5': { label: 'BC Ministry v5', space: '676-unit crest space', centre: [338.36631, 420.9648] as [number, number] },
  'airtanker-operations': { label: 'Airtanker package', space: '1448 × 1086 master', centre: [724, 470] as [number, number] },
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

export const sourceTokens: Record<string, string> = themesJson.sourceTokens;
export const themes: Record<string, Palette> = themesJson.themes;
// Tokens that actually paint a primitive (the rest colour wordmarks/strips).
export const PRIMITIVE_TOKENS = ['ink', 'paper', 'text', 'sky', 'water', 'wildlife', 'distant', 'earth', 'tree'];

// Full logos to overlay in Compose. Both share the primitives' coordinates.
const refsRaw = import.meta.glob<string>(
  ['../../../bc-ministry-primitives-v5/examples/*.svg', '../../../airtanker-operations/airtanker-operations.svg'],
  { query: '?raw', import: 'default', eager: true },
);

export interface Reference {
  key: string;
  label: string;
  family: FamilyId;
  svg: string;
  vb: VB;
}

export const references: Reference[] = Object.entries(refsRaw)
  .map(([path, svg]) => {
    const name = path.split('/').pop()!.replace(/\.svg$/, '');
    const family: FamilyId = path.includes('bc-ministry-primitives-v5') ? 'bc-ministry-v5' : 'airtanker-operations';
    return {
      key: `${family}:${name}`,
      label: family === 'bc-ministry-v5' ? `v5 example · ${name}` : 'Airtanker package · finished SVG',
      family,
      svg,
      vb: parseVB(/viewBox="([^"]+)"/.exec(svg)![1]),
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));
