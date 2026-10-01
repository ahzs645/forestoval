import manifest from '../../manifest.json';
import type { PieceSvg, VB } from './svg';

// The generated primitives (extract_primitives.py), loaded on demand: a badge
// fetches only the pieces it names.
const sources = import.meta.glob<string>(['../../bc-ministry-v5/**/*.svg', '../../airtanker-operations/**/*.svg'], {
  query: '?raw',
  import: 'default',
});
const entries = new Map((manifest as Array<{ file: string; viewBox: string; themable: boolean }>).map((m) => [m.file, m]));
const loaded = new Map<string, Promise<PieceSvg>>();

/** A generated primitive by its path in the manifest, e.g. `bc-ministry-v5/crest/frame.svg`. */
export function loadPiece(file: string): Promise<PieceSvg> {
  let piece = loaded.get(file);
  if (!piece) {
    const entry = entries.get(file), load = sources['../../' + file];
    if (!entry || !load) return Promise.reject(new Error(`No generated primitive ${file}; rerun extract_primitives.py`));
    piece = load().then((svg) => ({ file, svg, vb: entry.viewBox.trim().split(/[\s,]+/).map(Number) as VB, themable: entry.themable }));
    loaded.set(file, piece);
    piece.catch(() => loaded.delete(file));
  }
  return piece;
}
