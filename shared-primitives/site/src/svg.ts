import { fmt, parse, serialize, type M, type VB } from '@forestoval/live-lettering/svg';

// The SVG plumbing (matrices, parsing, theming, stacking) lives in the live
// lettering package; the viewer adds rasterizing and downloads.
export * from '@forestoval/live-lettering/svg';

export const dataUrl = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

/** A Library / Layer assembly layer: a generated primitive and where it goes. */
export interface Layer {
  key: string;
  label: string;
  file: string;
  /** One transform per placed copy; defaults to a single copy in place. */
  instances?: M[];
  hint?: string;
}

// --------------------------------------------------------------- raster --
/** Render svg text at a given viewBox and pixel size. */
export async function rasterize(svg: string, width: number, height: number, viewBox?: VB): Promise<HTMLCanvasElement> {
  const doc = parse(svg);
  const root = doc.documentElement;
  if (viewBox) root.setAttribute('viewBox', fmt(viewBox));
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  const url = URL.createObjectURL(new Blob([serialize(doc)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, bad) => {
      img.onload = () => ok();
      img.onerror = () => bad(new Error('SVG failed to rasterize'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function download(name: string, data: Blob | string) {
  const blob = typeof data === 'string' ? new Blob([data], { type: 'image/svg+xml' }) : data;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  // Long enough for a slow save dialog (Safari reads the URL late).
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadPng(name: string, svg: string, vb: VB, width: number) {
  try {
    const height = Math.max(1, Math.round((width * vb[3]) / vb[2]));
    const canvas = await rasterize(svg, width, height);
    const blob = await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error('the canvas could not be encoded'))), 'image/png'));
    download(name, blob);
  } catch (e) {
    // Very large widths can exceed the browser's canvas limit.
    window.alert(`PNG export failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
