// Entry for fit.html, driven by ../fit_lettering.py. Fits each crest variant's
// shared lettering to all its logos' references, then every recreation's own
// lettering to its primary registered reference, and exposes the result.
import '@fontsource/open-sans/800.css';
import '@fontsource/roboto-condensed/700.css';
import '@fontsource/roboto-slab/700.css';
import '@fontsource/roboto/400.css';
import { CREST_VARIANTS, fits, RECREATIONS, referencesFor, variantMembers, type LetteringFit } from './recreations';
import { fitRecreation, fitVariant } from './fit';

declare global {
  interface Window {
    __fit?: Record<string, LetteringFit>;
    __fitDone?: boolean;
    __fitError?: string;
  }
}

const log = (line: string) => {
  document.getElementById('log')!.textContent += line + '\n';
};

(async () => {
  try {
    await document.fonts.ready;
    const only = new URLSearchParams(location.search).get('only')?.split(',').filter(Boolean);
    const known = [...CREST_VARIANTS.map((v) => v.id), ...RECREATIONS.map((r) => r.id)];
    const unknown = only?.filter((id) => !known.includes(id)) ?? [];
    if (unknown.length) throw new Error(`Unknown id(s): ${unknown.join(', ')}. Choose from: ${known.join(', ')}`);
    const out: Record<string, LetteringFit> = {};
    const primary = (id: string) => referencesFor(id).find((r) => r.role === 'primary' && r.registration);
    for (const v of CREST_VARIANTS) {
      if (only && !only.includes(v.id)) continue;
      const members = variantMembers(v.id).flatMap((rec) => { const ref = primary(rec.id); return ref ? [{ rec, ref }] : []; });
      const t0 = performance.now();
      const fit = await fitVariant(members);
      out[v.id] = fits[v.id] = fit;
      log(`${v.id}: mean overlap over ${members.length} references ${fit.before.toFixed(3)} → ${fit.after.toFixed(3)}  ${Math.round(performance.now() - t0)} ms`);
      for (const [id, m] of Object.entries(fit.members ?? {})) log(`    ${id}: ${m.before.toFixed(3)} → ${m.after.toFixed(3)}`);
    }
    // Recreations whose runs others share go first, so those use the new fit.
    const sources = new Set(RECREATIONS.flatMap((r) => r.lettering.map((l) => l.shared?.rec ?? '')));
    const order = [...RECREATIONS].sort((a, b) => +sources.has(b.id) - +sources.has(a.id));
    for (const rec of order) {
      if (only && !only.includes(rec.id)) continue;
      const ref = primary(rec.id);
      if (!ref) {
        log(`${rec.id}: no registered reference, skipped`);
        continue;
      }
      const t0 = performance.now();
      const debug = new URLSearchParams(location.search).has('debug')
        ? (png: string) => {
            const img = Object.assign(document.createElement('img'), { src: png, title: rec.id });
            img.style.cssText = 'width:480px;border:1px solid #ccc;margin:4px';
            document.body.append(img);
          }
        : undefined;
      const fit = await fitRecreation(rec, ref, debug);
      out[rec.id] = fits[rec.id] = fit;
      log(`${rec.id}: overlap ${fit.before.toFixed(3)} → ${fit.after.toFixed(3)}${fit.accepted ? '' : ' (no real gain, keeping v5)'}  ${Math.round(performance.now() - t0)} ms`);
    }
    window.__fit = out;
  } catch (e) {
    window.__fitError = e instanceof Error ? e.stack ?? e.message : String(e);
    log('ERROR ' + window.__fitError);
  }
  window.__fitDone = true;
})();
