import { BADGES } from './badges';
import { LetteringEditor } from './editor';
import { loadLetteringRuntime } from './runtime';
import type { EditorOptions } from './types';

// @forestoval/live-lettering: the live lettering editor, the bridge to the v5
// engine, its bundled faces, and the badge presets. The styles are a separate
// import: '@forestoval/live-lettering/editor.css'.
export { LetteringEditor, NEW_DRAFT, draftDefaults, contentKeys, type DraftDefaults } from './editor';
export { loadLetteringRuntime } from './runtime';
export { FONT_SOURCES } from './fonts';
export { loadPiece } from './pieces';
export { AIRTANKER, BADGES, defineBadge, type BadgeBand, type BadgeDefinition } from './badges';
export type * from './types';

/** The editor with the bundled engine and every badge preset; options override either. */
export function mountLiveLettering(host: HTMLElement, options: Partial<EditorOptions> = {}): LetteringEditor {
  return new LetteringEditor(host, { runtime: loadLetteringRuntime, compositions: BADGES, ...options });
}
