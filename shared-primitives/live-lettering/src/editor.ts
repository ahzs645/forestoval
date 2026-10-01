import type { Catalogue, Composition, Configuration, ContentKey, EditorOptions, Engine, LogoResult, Runtime } from './types';

const STORAGE_KEY = 'forestoval-compose-lettering-v1';
/** A new or reset draft: calibrated fitting, and a crest that follows its wording
 * (short/long crest profile, separator marks placed from the lines, and a
 * long-crest upper line that spreads out when the lower line leaves room, and
 * every line centred in the white ring). */
export const NEW_DRAFT = { textFit: 'reference-calibrated', treeLettering: 'kabel-black', autoProfile: true, separatorPlacement: 'follow-text', fanOut: true, centreInRing: true } as const;
export type DraftDefaults = Omit<typeof NEW_DRAFT, 'treeLettering'> & { treeLettering: 'kabel-black' | 'reference-v2' };
/** New drafts use Kabel Black only when it can be used (a bundled build input, an
 * installed face, or one loaded this session); otherwise the calibrated v2
 * substitutes, rather than an Arial fallback that blocks exports. */
export async function draftDefaults(E: Engine): Promise<DraftDefaults> {
  const [kabel] = await E.ensureFonts(['kabel-black']);
  return { ...NEW_DRAFT, treeLettering: kabel?.status === 'ready' ? 'kabel-black' : 'reference-v2' };
}
const LABELS: Record<ContentKey, string> = {
  upper: 'Upper oval text', lower: 'Lower / ministry text', service: 'Service tab text',
  word: 'Acronym / wordmark', descriptor: 'Descriptor', district: 'District',
  lines: 'Stacked words (one per line)', branch: 'Branch strip text',
};
const QUICK = ['forest-service', 'forests', 'forests-wildfire', 'long-ministry', 'long-wildfire', 'airtanker-package'];
const title = (s: string) => s.replace(/-/g, ' ');
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  return el;
};
function fillSelect(select: HTMLSelectElement, values: Array<[string, string]>) {
  select.replaceChildren(...values.map(([value, label]) => {
    const option = node('option', label); option.value = value; return option;
  }));
}
export function contentKeys(P: Catalogue, s: Configuration): ContentKey[] {
  const kind = P.LOCKUPS[s.layout].kind, keys: ContentKey[] = [];
  if (kind !== 'wordmark') keys.push('upper', 'lower');
  if (kind !== 'wordmark' && P.TABS[s.tab].slot) keys.push('service');
  if (['horizontal', 'stacked', 'wordmark'].includes(kind)) keys.push('word', 'descriptor', 'district');
  if (kind === 'words') keys.push('lines');
  if (kind === 'strip') keys.push('branch');
  return keys;
}
function download(name: string, data: string | Blob, type: string) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const anchor = node('a'); anchor.download = name; anchor.href = url;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** DOM controller shared by the React wrapper and the actual-browser tests. */
export class LetteringEditor {
  private root: HTMLDivElement;
  private runtime?: Runtime;
  private state?: Configuration;
  /** The selected preset: an engine recipe id, or a composition built on one. */
  private preset?: string;
  private result?: LogoResult;
  private drafts = new Map<string, Configuration>();
  private inputs = new Map<ContentKey, HTMLInputElement | HTMLTextAreaElement>();
  private selected?: ContentKey;
  private palette: Record<string, string> | null;
  private defaults: DraftDefaults = { ...NEW_DRAFT, treeLettering: 'reference-v2' };
  private storage: Storage | null;
  private abort = new AbortController();
  private revision = 0;
  private timer?: number;
  private disposed = false;
  private working = false;
  private rendering = true;
  private composing = false;
  /** The latest render used a fallback or mismatched face; SVG/PNG need consent. */
  private unverified = false;
  private fontAck = false;

  constructor(private host: HTMLElement, private options: EditorOptions) {
    this.palette = options.palette ?? null;
    try { this.storage = options.storage === undefined ? localStorage : options.storage; }
    catch { this.storage = null; }
    this.root = node('div'); this.root.className = 'fo-editor';
    // This is a fixed UI template. Wording/imported values are assigned through
    // .value or .textContent, never interpolated as HTML.
    this.root.innerHTML = `
      <aside class="fo-sidebar">
        <p class="fo-eyebrow">LIVE LETTERING</p><h2>Type around the oval.</h2>
        <p class="fo-muted">Choose a preset, then click its lettering or edit the fields below.</p>
        <label>Current preset<select data-control="recipe" aria-label="Current preset"></select></label>
        <div class="fo-quick" data-part="quick" aria-label="Reference presets"></div>
        <div class="fo-separator"></div>
        <div data-part="fields"></div>
        <label>Lettering style<select data-control="textFit" aria-label="Lettering style"></select></label>
        <p class="fo-muted fo-small" data-part="policy-note"></p>
        <label>Tree oval lettering<select data-control="treeLettering" aria-label="Tree oval lettering">
          <option value="kabel-black">Kabel Black · supplied OTF</option><option value="reference-v2">Previous v2 substitutes</option>
        </select></label>
        <button type="button" data-action="kabel">Load Kabel-Black.otf</button>
        <input data-part="kabel-file" type="file" accept=".otf,font/otf" hidden>
        <p class="fo-muted fo-small">Kabel applies to the heavy tree oval, not Parks or wildlife lettering. Loading a file keeps it in this tab only; it is not uploaded.</p>
        <label class="fo-check"><input type="checkbox" data-control="autoProfile"> Pick the short or long crest from the wording</label>
        <label>Separator dots<select data-control="separatorPlacement" aria-label="Separator dots">
          <option value="follow-text">Follow the lettering</option><option value="reference">Keep the reference position</option>
        </select></label>
        <label class="fo-check"><input type="checkbox" data-control="fanOut"> Spread the upper line when there is room</label>
        <label class="fo-check"><input type="checkbox" data-control="centreInRing"> Centre each line in the white ring</label>
        <p class="fo-muted fo-small" data-part="profile-note"></p>
        <label>Service holder<select data-control="tabSizing" aria-label="Service holder">
          <option value="reference">Keep the reference holder</option><option value="follow-text">Grow to follow service text</option>
        </select></label>
        <label>Service backing<select data-control="tabBacking" aria-label="Service backing">
          <option value="paper">Paper (opaque)</option><option value="transparent">Transparent (background shows through)</option>
        </select></label>
        <details><summary>Change the composition</summary>
          <label>Crest profile<select data-control="crest" aria-label="Crest profile"></select></label>
          <label>Service tab<select data-control="tab" aria-label="Service tab"></select></label>
          <label>Layout<select data-control="layout" aria-label="Layout"></select></label>
        </details>
        <button type="button" data-action="reset">Reset this preset</button>
        <p class="fo-muted fo-small">Each preset keeps its own draft in this browser. Source preset definitions are never changed.</p>
      </aside>
      <section class="fo-stage">
        <header class="fo-toolbar"><div><strong data-part="name">Loading the shared engine…</strong>
          <span class="fo-muted fo-small" data-part="confidence"></span></div>
          <div class="fo-actions"><button type="button" data-action="svg" disabled>SVG</button>
            <button type="button" data-action="png" disabled>PNG</button>
            <button type="button" data-action="save" disabled>Save configuration</button>
            <button type="button" data-action="open">Open configuration</button>
            <input data-part="file" type="file" accept=".json,application/json" hidden></div>
        </header>
        <label class="fo-ack" data-part="font-ack" hidden><input type="checkbox" data-part="font-ack-input">
          Export with unverified fonts anyway (the lettering will not match the calibrated fit)</label>
        <div class="fo-canvas" data-part="canvas" aria-label="Live crest preview"><p>Loading…</p></div>
        <div class="fo-dock" data-part="dock" hidden>
          <label><span data-part="edit-label"></span><input data-part="inline-input" aria-label="Edit selected lettering" maxlength="320"></label>
          <button type="button" data-action="close" aria-label="Close inline editor">Done</button>
        </div>
        <p class="fo-status" data-part="status" role="status" aria-live="polite">Preparing live SVG…</p>
        <div class="fo-fonts"><span>Kabel is the selected tree-oval face; other families retain their substitutes. Historical font identity remains unverified.</span>
          <button type="button" data-action="fonts">Load reference fonts online</button></div>
        <p class="fo-muted fo-small">Online loading contacts Google Fonts. SVG keeps editable text and does not contain font files.</p>
        <div data-part="warnings"></div>
        <details class="fo-diagnostics"><summary>Resolved lettering measurements</summary><div data-part="metrics"></div></details>
      </section>`;
    host.replaceChildren(this.root);
    this.bind();
    this.start();
  }
  private part<T extends HTMLElement = HTMLElement>(name: string): T {
    const el = this.root.querySelector<T>(`[data-part="${name}"]`);
    if (!el) throw new Error(`Missing editor part: ${name}`); return el;
  }
  private control(name: string): HTMLSelectElement { return this.root.querySelector<HTMLSelectElement>(`[data-control="${name}"]`)!; }
  private checkbox(name: string): HTMLInputElement { return this.root.querySelector<HTMLInputElement>(`input[data-control="${name}"]`)!; }
  private get compositions(): Composition[] { return this.options.compositions ?? []; }
  private composition(id = this.preset): Composition | undefined { return this.compositions.find(c => c.id === id); }
  private baseRecipe(id: string): string { return this.composition(id)?.recipe ?? id; }
  private isPreset(id: string): boolean {
    const recipe = this.runtime!.P.RECIPES.find(r => r.id === this.baseRecipe(id));
    return !!recipe && !recipe.excluded;
  }
  private presetName(id: string): string { return this.composition(id)?.name ?? this.runtime!.P.recipe(id).name; }
  private on(target: EventTarget, event: string, fn: EventListener) { target.addEventListener(event, fn, { signal: this.abort.signal }); }
  private async start() {
    try {
      this.runtime = await this.options.runtime(); if (this.disposed) return;
      const { P, E } = this.runtime;
      if (!E.TEXT_FIT_POLICIES['reference-calibrated']) throw new Error('Apply the reference-lettering v2 patch before using this editor.');
      this.defaults = await draftDefaults(E); if (this.disposed) return;
      fillSelect(this.control('recipe'), P.RECIPES.filter(r => !r.excluded).flatMap(r => [[r.id, r.name] as [string, string],
        ...this.compositions.filter(c => c.recipe === r.id).map(c => [c.id, c.name] as [string, string])]));
      fillSelect(this.control('textFit'), Object.entries(E.TEXT_FIT_POLICIES).map(([id, p]) => [id, p.label]));
      for (const [key, table] of Object.entries({ crest: P.CRESTS, tab: P.TABS, layout: P.LOCKUPS })) {
        fillSelect(this.control(key), Object.keys(table).map(id => [id, title(id)]));
      }
      this.part('quick').replaceChildren(...QUICK.filter(id => this.isPreset(id)).map(id => {
        const b = node('button', this.presetName(id)); b.type = 'button'; b.dataset.recipe = id; return b;
      }));
      let active = 'long-wildfire';
      try {
        const saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null');
        if ([1, 2, 3, 4].includes(saved?.version) && saved.drafts && typeof saved.drafts === 'object') {
          for (const [id, draft] of Object.entries(saved.drafts)) {
            // Older drafts predate some of the dynamic controls; they take the new defaults
            // (version 1: profile and separators; 1–2: spreading the upper line; 1–3: ring centring).
            const adopt = { ...(saved.version === 1 ? { autoProfile: NEW_DRAFT.autoProfile, separatorPlacement: NEW_DRAFT.separatorPlacement } : {}),
              ...(saved.version < 3 ? { fanOut: NEW_DRAFT.fanOut } : {}), ...(saved.version < 4 ? { centreInRing: NEW_DRAFT.centreInRing } : {}) };
            const raw = draft && typeof draft === 'object' ? { ...draft, ...adopt } : draft;
            try { const s = this.validate(raw); if (this.isPreset(id) && s.recipe === this.baseRecipe(id)) this.drafts.set(id, s); } catch { /* Ignore only this invalid saved draft. */ }
          }
          if (this.drafts.has(saved.active)) active = saved.active;
        }
      } catch { /* Unavailable or corrupt storage does not prevent editing. */ }
      if (!this.isPreset(active)) active = P.RECIPES.find(r => !r.excluded)!.id;
      this.choose(active);
    } catch (error) { this.fail(error); }
  }
  private validate(raw: unknown): Configuration {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Open a v5 configuration object.');
    const value = raw as Partial<Configuration>, { P, E } = this.runtime!;
    if (value.version !== 5) throw new Error('This editor opens v5 configuration files.');
    const recipe = P.RECIPES.find(r => r.id === value.recipe);
    if (!recipe || recipe.excluded) throw new Error('Unknown or excluded preset. The current draft has not been replaced.');
    return E.normalise(value);
  }
  private remember() {
    if (!this.state || !this.preset) return;
    this.drafts.set(this.preset, this.runtime!.E.normalise(this.state));
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 4, active: this.preset, drafts: Object.fromEntries(this.drafts) })); }
    catch { /* Restricted/full storage: the live in-memory draft is still usable. */ }
  }
  private choose(id: string) {
    if (!this.runtime) return;
    this.remember();
    this.preset = id;
    this.state = this.drafts.get(id) ?? this.runtime.E.recipeState(this.baseRecipe(id), this.defaults);
    this.state = this.runtime.E.normalise(this.state);
    this.selected = undefined; this.part('dock').hidden = true;
    this.sync(); this.schedule();
  }
  private sync() {
    if (!this.state || !this.runtime) return;
    const { P } = this.runtime, s = this.state;
    for (const key of ['textFit', 'treeLettering', 'crest', 'tab', 'layout', 'tabSizing', 'tabBacking', 'separatorPlacement'] as const) this.control(key).value = s[key];
    this.control('recipe').value = this.preset ?? s.recipe;
    // A composition draws its own artwork around the crest, so its crest, tab and layout stay fixed.
    const composed = this.composition();
    for (const key of ['crest', 'tab', 'layout']) this.control(key).disabled = !!composed;
    const badge = P.LOCKUPS[s.layout].kind !== 'wordmark', ribbon = P.TABS[s.tab].shape === 'ribbon' && badge;
    this.control('tabSizing').disabled = !ribbon;
    this.control('tabBacking').disabled = !ribbon;
    this.control('treeLettering').disabled = !badge || !['tree-heavy', 'tree-long'].includes(s.crest);
    const auto = this.checkbox('autoProfile');
    const pair = P.CRESTS[s.crest];
    auto.checked = s.autoProfile; auto.disabled = !badge || !(pair.longer || pair.shorter);
    const marks = badge && P.CRESTS[s.crest].separator !== 'none';
    this.control('separatorPlacement').disabled = !marks;
    // Spreading reads the marks' position, so it needs marks that follow the lettering.
    const fan = this.checkbox('fanOut');
    fan.checked = s.fanOut; fan.disabled = !marks || s.separatorPlacement !== 'follow-text';
    const ring = this.checkbox('centreInRing');
    ring.checked = s.centreInRing; ring.disabled = !badge;
    this.part('name').textContent = this.presetName(this.preset ?? s.recipe);
    this.part('confidence').textContent = composed?.confidence ?? P.recipe(s.recipe).confidence ?? 'Reference-based reconstruction';
    this.part('policy-note').textContent = this.runtime.E.TEXT_FIT_POLICIES[s.textFit].description;
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-recipe]')) b.setAttribute('aria-pressed', String(b.dataset.recipe === this.preset));
    this.inputs.clear();
    this.part('fields').replaceChildren(...contentKeys(P, s).map(key => {
      const label = node('label', LABELS[key]);
      const input = key === 'lines' || key === 'lower' || key === 'branch' ? node('textarea') : node('input');
      input.value = s.content[key] ?? ''; input.maxLength = 320; input.dataset.content = key;
      input.setAttribute('aria-label', LABELS[key]); input.spellcheck = false;
      if (input instanceof HTMLTextAreaElement) input.rows = key === 'lines' ? 3 : 2;
      this.inputs.set(key, input); label.append(input); return label;
    }));
    if (this.selected && !this.inputs.has(this.selected)) { this.selected = undefined; this.part('dock').hidden = true; }
  }
  private bind() {
    this.on(this.root, 'change', event => {
      const target = event.target;
      if (!this.state) return;
      if (target instanceof HTMLInputElement && ['autoProfile', 'fanOut', 'centreInRing'].includes(target.dataset.control ?? '')) {
        this.state = this.runtime!.E.normalise({ ...this.state, [target.dataset.control!]: target.checked }); this.sync(); this.schedule(); return;
      }
      if (!(target instanceof HTMLSelectElement)) return;
      const key = target.dataset.control;
      if (key === 'recipe') { this.choose(target.value); return; }
      if (key && ['textFit', 'treeLettering', 'crest', 'tab', 'layout', 'tabSizing', 'tabBacking', 'separatorPlacement'].includes(key)) {
        // Choosing a crest profile by hand stops the wording from overriding it.
        const manual = key === 'crest' ? { autoProfile: false } : {};
        this.state = this.runtime!.E.normalise({ ...this.state, [key]: target.value, ...manual }); this.sync(); this.schedule();
      }
    });
    this.on(this.root, 'compositionstart', () => { this.composing = true; });
    this.on(this.root, 'compositionend', event => { this.composing = false; this.input(event); });
    this.on(this.root, 'input', event => { if (!this.composing) this.input(event); });
    this.on(this.root, 'click', event => {
      const target = event.target; if (!(target instanceof Element)) return;
      const recipe = target.closest<HTMLElement>('[data-recipe]')?.dataset.recipe;
      if (recipe) { this.choose(recipe); return; }
      const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action) { void this.action(action); return; }
      const text = target.closest<SVGElement>('[data-live-text]');
      if (text) { const key = this.keyForText(text); if (key) this.edit(key); }
    });
    this.on(this.root, 'keydown', event => {
      const e = event as KeyboardEvent, target = e.target;
      if (e.key === 'Escape') { this.close(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && target instanceof SVGElement && target.hasAttribute('data-live-text')) {
        e.preventDefault(); const key = this.keyForText(target); if (key) this.edit(key);
      }
    });
    this.on(this.part<HTMLInputElement>('file'), 'change', () => { void this.openFile(); });
    this.on(this.part<HTMLInputElement>('kabel-file'), 'change', () => { void this.openKabel(); });
    this.on(this.part<HTMLInputElement>('font-ack-input'), 'change', event => {
      this.fontAck = (event.target as HTMLInputElement).checked; this.updateButtons();
    });
  }
  private input(event: Event) {
    const input = event.target;
    if (!this.state || !(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
    const key = input.dataset.content as ContentKey | undefined;
    if (!key || !Object.hasOwn(LABELS, key)) return;
    this.state.content[key] = input.value;
    // Do not replace the focused element or reset its caret while typing.
    const field = this.inputs.get(key); if (field && field !== input) field.value = input.value;
    const inline = this.part<HTMLInputElement>('inline-input');
    if (inline !== input && inline.dataset.content === key) inline.value = input.value;
    this.schedule();
  }
  private keyForText(text: Element): ContentKey | undefined {
    const id = text.getAttribute('data-live-text');
    if (id === 'upper' || id === 'lower' || id === 'service') return id;
    const role = text.getAttribute('data-role');
    if (role === 'wordmark-heavy') return 'word';
    if (role === 'descriptor-slab') return 'descriptor';
    if (role === 'district-slab') return 'district';
    if (role === 'branch-condensed') return 'branch';
    if (id?.startsWith('stacked-line-')) return 'lines';
    return undefined;
  }
  private edit(key: ContentKey) {
    if (!this.state || !this.inputs.has(key)) return;
    // Multiline content stays in its actual textarea rather than a one-line dock.
    if (key === 'lines') { this.inputs.get(key)!.focus(); return; }
    this.selected = key;
    this.part('edit-label').textContent = LABELS[key];
    const input = this.part<HTMLInputElement>('inline-input');
    input.dataset.content = key; input.value = this.state.content[key] ?? '';
    this.part('dock').hidden = false; input.focus(); input.select();
    this.markSelected();
  }
  private close() {
    const key = this.selected; this.selected = undefined; this.part('dock').hidden = true; this.markSelected();
    if (key) this.inputs.get(key)?.focus();
  }
  private markSelected() {
    for (const text of this.part('canvas').querySelectorAll('[data-live-text]')) {
      text.classList.toggle('fo-selected-text', !!this.selected && this.keyForText(text) === this.selected);
    }
  }
  private schedule() {
    if (!this.state || this.disposed) return;
    ++this.revision; window.clearTimeout(this.timer); this.rendering = true; this.updateButtons();
    this.part('status').textContent = 'Updating lettering…';
    this.remember(); this.timer = window.setTimeout(() => { void this.render(); }, 65);
  }
  private async render(allowNetwork = false) {
    if (!this.state || !this.runtime || this.disposed) return;
    const revision = this.revision;
    try {
      const snapshot = this.runtime.E.normalise({ ...this.state, colours: { ...this.state.colours, ...this.palette } });
      const drawn = await this.runtime.E.render(snapshot, { allowNetwork });
      if (this.disposed || revision !== this.revision) return;
      const composition = this.composition();
      const result = composition ? await composition.compose(drawn, this.runtime, this.palette) : drawn;
      if (this.disposed || revision !== this.revision) return;
      this.result = result;
      // Only the preview is decorated. Exports use the untouched engine result.
      const svg = result.svg.cloneNode(true) as SVGSVGElement;
      svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', 'Editable crest lettering');
      for (const text of svg.querySelectorAll<SVGElement>('[data-live-text]')) {
        const key = this.keyForText(text);
        if (key && this.inputs.has(key)) {
          text.setAttribute('tabindex', '0'); text.setAttribute('role', 'button');
          text.setAttribute('aria-label', `Edit ${LABELS[key].toLowerCase()}`);
        }
      }
      this.part('canvas').replaceChildren(svg); this.markSelected();
      this.part('status').removeAttribute('data-error');
      this.part('warnings').replaceChildren(...result.warnings.map(w => {
        const p = node('p', w.message); p.className = 'fo-warning'; p.dataset.warning = w.code; return p;
      }));
      const { P, E } = this.runtime;
      this.part('metrics').replaceChildren(
        ...result.report.map(row => node('p', `${row.slot ?? row.role}: height ${row.cap.toFixed(1)} · tracking ${row.trackingEm.toFixed(3)} em · ${title(row.stage)}`)),
        ...result.fontIds.map(id => {
          const f = E.fontState.get(id);
          const check = f?.verified === undefined ? '' : f.verified ? ' · advances match the calibration face' : ' · advances differ from the calibration face';
          return node('p', `${P.FACES[id].family} ${P.FACES[id].weight}: ${f?.status === 'ready' ? f.source : 'fallback'}${check}`);
        }));
      this.part('profile-note').textContent = this.profileNote(result);
      const missing = result.warnings.some(w => w.code === 'FONT_FALLBACK');
      this.unverified = result.warnings.some(w => w.code === 'FONT_FALLBACK' || w.code === 'FONT_METRICS_MISMATCH');
      this.part('font-ack').hidden = !this.unverified;
      this.part('status').textContent = missing ? 'Preview is using an unverified font. Load the named reference fonts before judging fidelity.'
        : this.unverified ? 'A face differs from the calibration face; the fit is not the reference fit.'
        : `${result.report.length} editable text runs · click a line to edit`;
      this.rendering = false; this.updateButtons();
    } catch (error) { if (!this.disposed && revision === this.revision) this.fail(error); }
  }
  /** Which crest the wording chose, and where the separator marks went. */
  private profileNote(result: LogoResult): string {
    const s = result.state, notes: string[] = [];
    if (this.runtime!.P.LOCKUPS[s.layout].kind === 'wordmark') return '';
    const pair = this.runtime!.P.CRESTS[s.crest];
    if (s.autoProfile && (pair.longer || pair.shorter)) notes.push(`The wording uses the ${title(result.crest)} crest.`);
    const sep = result.separators;
    if (sep?.placement === 'follow-text') notes.push(sep.crowded ? 'The dots are crowded between the lines.'
      : sep.state === 'centred' ? 'The dots sit halfway between the upper and lower lines.'
      : sep.state === 'pushed' ? 'The lettering has pushed the dots along the band.'
      : 'The lines leave room, so the dots stay at the sides.');
    if (result.report.some(r => r.stage === 'fanned')) notes.push('The upper line is spread out to use the room.');
    if (sep?.placement === 'reference-fallback') notes.push('With one line empty the dots keep their reference position.');
    return notes.join(' ');
  }
  private updateButtons() {
    const busy = !this.result || this.rendering || this.working;
    this.root.querySelector<HTMLButtonElement>('[data-action="save"]')!.disabled = busy;
    // Verified fonts are the normal path; fallback output needs explicit consent.
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-action="svg"], [data-action="png"]')) b.disabled = busy || (this.unverified && !this.fontAck);
    this.root.querySelector<HTMLButtonElement>('[data-action="fonts"]')!.disabled = this.working || !this.runtime;
    this.root.querySelector<HTMLButtonElement>('[data-action="kabel"]')!.disabled = this.working || !this.runtime;
  }
  private fail(error: unknown) {
    if (this.disposed) return;
    this.rendering = false; this.result = undefined; this.updateButtons();
    this.part('status').textContent = error instanceof Error ? error.message : String(error);
    this.part('status').setAttribute('data-error', 'true');
  }
  private async action(action: string) {
    if (action === 'close') { this.close(); return; }
    if (action === 'open') { this.part<HTMLInputElement>('file').click(); return; }
    if (action === 'kabel') { this.part<HTMLInputElement>('kabel-file').click(); return; }
    if (!this.state || !this.runtime) return;
    if (action === 'reset') {
      this.state = this.runtime.E.recipeState(this.baseRecipe(this.preset ?? this.state.recipe), this.defaults);
      this.selected = undefined; this.part('dock').hidden = true; this.sync(); this.schedule(); return;
    }
    if (action === 'fonts') {
      if (this.working) return;
      this.working = true; this.updateButtons(); this.part('status').textContent = 'Loading named fonts from Google Fonts…';
      try {
        this.runtime.E.retryFonts();
        const s = this.runtime.E.normalise(this.state);
        await this.runtime.E.render(s, { allowNetwork: true });
        if (!this.disposed) this.schedule();
      } catch (error) { this.fail(error); }
      finally { this.working = false; if (!this.disposed) this.updateButtons(); }
      return;
    }
    if (!this.result || this.rendering || this.working) return;
    if (action !== 'save' && this.unverified && !this.fontAck) return;
    const result = this.result, name = this.preset ?? result.state.recipe; this.working = true; this.updateButtons();
    try {
      if (action === 'svg') download(`${name}-editable.svg`, this.runtime.E.serialise(result), 'image/svg+xml');
      if (action === 'save') download(`${name}-configuration.json`, JSON.stringify(result.state, null, 2) + '\n', 'application/json');
      if (action === 'png') download(`${name}.png`, await this.runtime.E.png(result, result.state.outputWidth), 'image/png');
    } catch (error) { this.part('status').textContent = `Export failed: ${error instanceof Error ? error.message : String(error)}`; }
    finally { this.working = false; if (!this.disposed) this.updateButtons(); }
  }
  private async openKabel() {
    const input = this.part<HTMLInputElement>('kabel-file'), file = input.files?.[0];
    if (!file || !this.runtime || this.working) return;
    this.working = true; this.updateButtons();
    try {
      if (file.size > 5_000_000) throw new Error('Choose a font file smaller than 5 MB.');
      await this.runtime.E.supplyFont('kabel-black', await file.arrayBuffer());
      if (this.disposed) return;
      // The face is now usable: new drafts and the current crest switch to it.
      this.defaults = { ...this.defaults, treeLettering: 'kabel-black' };
      if (this.state) this.state = this.runtime.E.normalise({ ...this.state, treeLettering: 'kabel-black' });
      this.sync(); this.schedule();
    } catch (error) { this.part('status').textContent = `Font not loaded: ${error instanceof Error ? error.message : String(error)}`; }
    finally { input.value = ''; this.working = false; if (!this.disposed) this.updateButtons(); }
  }
  private async openFile() {
    const input = this.part<HTMLInputElement>('file'), file = input.files?.[0];
    if (!file || !this.runtime) return;
    try {
      if (file.size > 1_000_000) throw new Error('Configuration exceeds the 1 MB limit.');
      const next = this.validate(JSON.parse(await file.text()));
      if (this.disposed) return;
      // A configuration for the recipe a composition is built on stays in that composition.
      this.remember(); this.state = next; this.selected = undefined; this.part('dock').hidden = true;
      if (this.composition()?.recipe !== next.recipe) this.preset = next.recipe;
      this.sync(); this.schedule();
    } catch (error) { this.part('status').textContent = `Configuration not opened: ${error instanceof Error ? error.message : String(error)}`; }
    finally { input.value = ''; }
  }
  setPalette(palette: Record<string, string> | null) {
    if (JSON.stringify(palette) === JSON.stringify(this.palette)) return;
    this.palette = palette; this.schedule();
  }
  get configuration(): Configuration | undefined { return this.state && this.runtime?.E.normalise(this.state); }
  destroy() {
    this.remember(); this.disposed = true; ++this.revision;
    window.clearTimeout(this.timer); this.abort.abort(); this.host.replaceChildren();
  }
}
