/** The public surface used by the editor; the v5 engine remains the renderer. */
export type ContentKey = 'upper' | 'lower' | 'service' | 'word' | 'descriptor' | 'district' | 'lines' | 'branch';
export interface Configuration {
  version: number;
  recipe: string;
  crest: string;
  tab: string;
  layout: string;
  theme: string;
  textFit: string;
  tabSizing: string;
  tabBacking: string;
  separatorPlacement: string;
  fanOut: boolean;
  centreInRing: boolean;
  autoProfile: boolean;
  referenceModelVersion?: number;
  outputWidth: number;
  content: Partial<Record<ContentKey, string>>;
  roles: Record<string, unknown>;
  slots: Record<string, unknown>;
  colours: Record<string, string>;
}
export interface Recipe {
  id: string;
  name: string;
  excluded?: boolean;
  confidence?: string;
  reference?: string;
}
export interface Catalogue {
  RECIPES: Recipe[];
  CRESTS: Record<string, { upper: string; lower: string; separator: string }>;
  TABS: Record<string, { slot?: string; shape?: string }>;
  LOCKUPS: Record<string, { kind: string }>;
  FACES: Record<string, { family: string; weight: number; advance?: number }>;
  REFERENCE_LETTERING?: { version: number };
  recipe(id: string): Recipe;
}
export interface LogoResult {
  svg: SVGSVGElement;
  state: Configuration;
  report: Array<{ slot?: string; role: string; cap: number; trackingEm: number; stage: string; referenceProfile?: string }>;
  warnings: Array<{ code: string; message: string }>;
  fontIds: string[];
  /** The crest profile actually drawn (autoProfile can differ from state.crest). */
  crest: string;
  separators: { placement: string; state: string; y: number; angle: number; crowded: boolean } | null;
  viewBox: { x: number; y: number; w: number; h: number };
}
export interface Engine {
  TEXT_FIT_POLICIES: Record<string, { label: string; description: string }>;
  normalise(input: unknown): Configuration;
  recipeState(id: string, shared?: Partial<Configuration>): Configuration;
  render(input: Configuration, options?: { allowNetwork?: boolean }): Promise<LogoResult>;
  serialise(result: LogoResult): string;
  png(result: LogoResult, width: number): Promise<Blob>;
  retryFonts(): void;
  fontState: Map<string, { status: string; source: string; verified?: boolean; advance?: number }>;
}
export interface Runtime { P: Catalogue; E: Engine }
export interface EditorOptions {
  palette?: Record<string, string> | null;
  storage?: Storage | null;
  /** Dependency injection is for the browser tests, not a second renderer. */
  runtime: () => Promise<Runtime>;
}
