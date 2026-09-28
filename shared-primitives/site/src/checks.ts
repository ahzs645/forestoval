import { byFile, parseVB, themes, type Piece, type VB } from './data';
import { REASSEMBLY, resolve } from './layers';
import { composite, hasParseError, parse, rasterize, themedSvg } from './svg';

export type Status = 'pass' | 'warn' | 'fail' | 'info';
export interface Check {
  status: Status;
  detail: string;
}
export const COLUMNS = [
  ['parse', 'Parses'],
  ['viewbox', 'viewBox'],
  ['contained', 'Self-contained'],
  ['refs', 'References'],
  ['ids', 'Unique ids'],
  ['theme', 'Theme mapping'],
  ['clip', 'Nothing cut off'],
  ['padding', 'Padding'],
] as const;
export type CheckId = (typeof COLUMNS)[number][0];
export type PieceReport = Partial<Record<CheckId, Check>>;

const FORBIDDEN = ['image', 'script', 'foreignObject', 'text', 'style', 'iframe'];

export function staticChecks(piece: Piece): PieceReport {
  const doc = parse(piece.svg);
  if (hasParseError(doc)) return { parse: { status: 'fail', detail: doc.getElementsByTagName('parsererror')[0].textContent ?? 'XML error' } };
  const r: PieceReport = { parse: { status: 'pass', detail: 'Well-formed SVG' } };
  const root = doc.documentElement;
  const all = Array.from(doc.getElementsByTagName('*'));

  const vbText = root.getAttribute('viewBox') ?? '';
  const vb = parseVB(vbText);
  const w = Number(root.getAttribute('width')), h = Number(root.getAttribute('height'));
  const problems: string[] = [];
  if (vb.length !== 4 || !vb.every(Number.isFinite) || vb[2] <= 0 || vb[3] <= 0) problems.push('invalid viewBox');
  else if (Math.abs(w - vb[2]) > 0.01 || Math.abs(h - vb[3]) > 0.01) problems.push(`width/height ${w}×${h} differ from viewBox`);
  if (vbText !== piece.viewBox) problems.push('manifest viewBox is stale');
  r.viewbox = problems.length ? { status: 'fail', detail: problems.join('; ') } : { status: 'pass', detail: `${vbText} (${Math.round(vb[2])} × ${Math.round(vb[3])})` };

  const bad = [...new Set(all.map((e) => e.localName).filter((n) => FORBIDDEN.includes(n)))];
  const external = all.flatMap((e) => Array.from(e.attributes).filter((a) => a.localName === 'href' && !a.value.startsWith('#')).map((a) => a.value));
  r.contained = bad.length || external.length
    ? { status: 'fail', detail: [bad.length && `contains <${bad.join('>, <')}>`, external.length && `external href ${external[0]}`].filter(Boolean).join('; ') }
    : { status: 'pass', detail: 'Vector only: no raster, fonts, scripts or external links' };

  const ids = all.map((e) => e.getAttribute('id')).filter((x): x is string => !!x);
  const idSet = new Set(ids);
  const refs = all.flatMap((e) =>
    Array.from(e.attributes).flatMap((a) => [
      ...[...a.value.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]),
      ...(a.localName === 'href' && a.value.startsWith('#') ? [a.value.slice(1)] : []),
    ]),
  );
  const missing = [...new Set(refs.filter((x) => !idSet.has(x)))];
  r.refs = missing.length ? { status: 'fail', detail: 'Missing #' + missing.join(', #') } : { status: 'pass', detail: refs.length ? `${refs.length} internal reference(s) resolve` : 'No references' };

  const dupes = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
  r.ids = dupes.length ? { status: 'fail', detail: 'Duplicate #' + dupes.join(', #') } : { status: 'pass', detail: `${ids.length} unique id(s)` };

  if (!piece.themable) r.theme = { status: 'info', detail: 'Fixed colours: the engine does not theme this piece' };
  else {
    // Paint every token a unique probe colour; anything left over was not mapped.
    const probe = Object.fromEntries(Object.keys(themes.wildlife).map((k, i) => [k, `#0${(i + 1).toString(16)}0f0f`]));
    const probeValues = new Set(Object.values(probe));
    const themed = parse(themedSvg(piece, probe));
    const leftover = new Set<string>();
    for (const el of Array.from(themed.getElementsByTagName('*'))) {
      if (el.closest('mask')) continue;
      for (const attr of ['fill', 'stroke']) {
        const v = el.getAttribute(attr);
        if (v && v !== 'none' && !probeValues.has(v)) leftover.add(v);
      }
    }
    r.theme = leftover.size ? { status: 'warn', detail: 'Unmapped colour(s): ' + [...leftover].join(', ') } : { status: 'pass', detail: 'Every colour follows the theme' };
  }
  return r;
}

/** Render with a 25% margin around the viewBox and look for ink outside it. */
export async function pixelChecks(piece: Piece): Promise<PieceReport> {
  const [x, y, w, h] = piece.vb;
  const m = Math.max(w, h) * 0.25;
  const big: VB = [x - m, y - m, w + 2 * m, h + 2 * m];
  const scale = 520 / Math.max(big[2], big[3]);
  const W = Math.round(big[2] * scale), H = Math.round(big[3] * scale);
  const canvas = await rasterize(piece.svg, W, H, big);
  const data = canvas.getContext('2d')!.getImageData(0, 0, W, H).data;
  const ix0 = m * scale, iy0 = m * scale, ix1 = (m + w) * scale, iy1 = (m + h) * scale;
  let outside = 0, minX = W, minY = H, maxX = -1, maxY = -1;
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      if (data[(py * W + px) * 4 + 3] < 16) continue;
      if (px < ix0 - 1.5 || px > ix1 + 0.5 || py < iy0 - 1.5 || py > iy1 + 0.5) outside++;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
  if (maxX < 0) return { clip: { status: 'fail', detail: 'Nothing renders' }, padding: { status: 'fail', detail: 'Empty' } };
  const slack = [(minX - ix0) / scale, (minY - iy0) / scale, (ix1 - maxX - 1) / scale, (iy1 - maxY - 1) / scale];
  const unit = 1 / scale;
  return {
    clip: outside > 4 ? { status: 'fail', detail: `${outside} px of artwork fall outside the viewBox` } : { status: 'pass', detail: 'All artwork is inside the viewBox' },
    padding: {
      status: slack.every((s) => s > -unit * 2 && s < 30) ? 'pass' : 'warn',
      detail: `L ${slack[0].toFixed(1)} · T ${slack[1].toFixed(1)} · R ${slack[2].toFixed(1)} · B ${slack[3].toFixed(1)} units (±${unit.toFixed(1)})`,
    },
  };
}

export interface ReassemblyResult {
  name: string;
  status: Status;
  mismatch: number;
  target: string;
  rebuilt: string;
  diff: string;
}

export async function reassembly(test: (typeof REASSEMBLY)[number]): Promise<ReassemblyResult> {
  const target = byFile.get(test.target)!;
  const rebuilt = composite(resolve(test.family, test.parts), { viewBox: target.vb }).svg;
  const W = 360, H = Math.round((W * target.vb[3]) / target.vb[2]);
  const [a, b] = await Promise.all([rasterize(target.svg, W, H), rasterize(rebuilt, W, H)]);
  const da = a.getContext('2d')!.getImageData(0, 0, W, H).data;
  const db = b.getContext('2d')!.getImageData(0, 0, W, H).data;
  const diff = document.createElement('canvas');
  diff.width = W; diff.height = H;
  const ctx = diff.getContext('2d')!;
  const out = ctx.createImageData(W, H);
  let painted = 0, differ = 0;
  for (let i = 0; i < da.length; i += 4) {
    const aa = da[i + 3] / 255, ab = db[i + 3] / 255;
    if (aa === 0 && ab === 0) continue;
    painted++;
    let d = Math.abs(aa - ab) * 255;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(da[i + c] * aa - db[i + c] * ab));
    const on = d > 48;
    if (on) differ++;
    out.data.set(on ? [229, 0, 126, 255] : [0, 0, 0, 28], i);
  }
  ctx.putImageData(out, 0, 0);
  const mismatch = painted ? differ / painted : 1;
  return {
    name: test.name,
    status: mismatch < 0.005 ? 'pass' : mismatch < 0.02 ? 'warn' : 'fail',
    mismatch,
    target: a.toDataURL(),
    rebuilt: b.toDataURL(),
    diff: diff.toDataURL(),
  };
}
