import artwork from '../../../bc-ministry-primitives-v5/data/art.json';
import layout from '../../layout.json';
import primitiveScript from '../../../bc-ministry-primitives-v5/src/primitives.js?url';
import tabScript from '../../tab-layout.js?url';
import engineScript from '../../../bc-ministry-primitives-v5/src/engine.js?url';
import { FONT_SOURCES } from './fonts';
import type { Catalogue, Engine, Runtime } from './types';

// These are asset URLs emitted by Vite, not fetched GitHub copies, eval(), or
// a second fitting implementation. The classic IIFEs need this load order.
interface Host extends Window {
  BC_ART?: unknown;
  BCTabProfile?: unknown;
  BC_FONT_SOURCES?: typeof FONT_SOURCES;
  BCPrimitives?: Catalogue;
  BCLogo?: Engine;
}
const host = window as Host;
let pending: Promise<Runtime> | undefined;
const scripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const existing = scripts.get(src);
  if (existing) return existing;
  const task = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    // Module assets are local to this build; no network font permission here.
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); reject(new Error(`Could not load lettering asset: ${src}`)); };
    document.head.append(script);
  });
  scripts.set(src, task);
  task.catch(() => scripts.delete(src));
  return task;
}

export function loadLetteringRuntime(): Promise<Runtime> {
  if (!pending) {
    pending = (async () => {
      host.BC_ART = artwork;
      host.BCTabProfile = layout.tab;
      host.BC_FONT_SOURCES = FONT_SOURCES;
      await loadScript(primitiveScript);
      await loadScript(tabScript);
      await loadScript(engineScript);
      const P = host.BCPrimitives, E = host.BCLogo;
      if (!P?.REFERENCE_LETTERING || !E?.TEXT_FIT_POLICIES?.['reference-calibrated']) {
        throw new Error('The reference-lettering v2 engine is not in this build. Apply v2 to the source files and rebuild; copying only the demo or patch file is not enough.');
      }
      return { P, E };
    })();
    pending.catch(() => { pending = undefined; });
  }
  return pending;
}
