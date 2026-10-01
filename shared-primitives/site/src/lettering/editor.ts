import type { Catalogue, Configuration, ContentKey, EditorOptions, LogoResult, Runtime } from './types';

const STORAGE_KEY = 'forestoval-compose-lettering-v1';
const LABELS: Record<ContentKey, string> = {
  upper: 'Upper oval text', lower: 'Lower / ministry text', service: 'Service tab text',
  word: 'Acronym / wordmark', descriptor: 'Descriptor', district: 'District',
  lines: 'Stacked words (one per line)', branch: 'Branch strip text',
};
const QUICK = ['forests', 'forests-wildfire', 'long-ministry', 'long-wildfire'];
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
  private result?: LogoResult;
  private drafts = new Map<string, Configuration>();
  private inputs = new Map<ContentKey, HTMLInputElement | HTMLTextAreaElement>();
  private selected?: ContentKey;
  private palette: Record<string, string> | null;
  private storage: Storage | null;
  private abort = new AbortController();
  private revision = 0;
  private timer?: number;
  private disposed = false;
  private working = false;
  private rendering = true;
  private composing = false;

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
        <label>Service holder<select data-control="tabSizing" aria-label="Service holder">
          <option value="reference">Keep the reference holder</option><option value="follow-text">Grow to follow service text</option>
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
        <div class="fo-canvas" data-part="canvas" aria-label="Live crest preview"><p>Loading…</p></div>
        <div class="fo-dock" data-part="dock" hidden>
          <label><span data-part="edit-label"></span><input data-part="inline-input" aria-label="Edit selected lettering" maxlength="320"></label>
          <button type="button" data-action="close" aria-label="Close inline editor">Done</button>
        </div>
        <p class="fo-status" data-part="status" role="status" aria-live="polite">Preparing live SVG…</p>
        <div class="fo-fonts"><span>Reference fonts are substitutes, not authenticated originals.</span>
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
  private on(target: EventTarget, event: string, fn: EventListener) { target.addEventListener(event, fn, { signal: this.abort.signal }); }
  private async start() {
    try {
      this.runtime = await this.options.runtime(); if (this.disposed) return;
      const { P, E } = this.runtime;
      if (!E.TEXT_FIT_POLICIES['reference-calibrated']) throw new Error('Apply the reference-lettering v2 patch before using this editor.');
      fillSelect(this.control('recipe'), P.RECIPES.filter(r => !r.excluded).map(r => [r.id, r.name]));
      fillSelect(this.control('textFit'), Object.entries(E.TEXT_FIT_POLICIES).map(([id, p]) => [id, p.label]));
      for (const [key, table] of Object.entries({ crest: P.CRESTS, tab: P.TABS, layout: P.LOCKUPS })) {
        fillSelect(this.control(key), Object.keys(table).map(id => [id, title(id)]));
      }
      this.part('quick').replaceChildren(...QUICK.filter(id => P.RECIPES.some(r => r.id === id && !r.excluded)).map(id => {
        const b = node('button', P.recipe(id).name); b.type = 'button'; b.dataset.recipe = id; return b;
      }));
      let active = 'long-wildfire';
      try {
        const saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? 'null');
        if (saved?.version === 1 && saved.drafts && typeof saved.drafts === 'object') {
          for (const [id, draft] of Object.entries(saved.drafts)) {
            try { const s = this.validate(draft); if (s.recipe === id) this.drafts.set(id, s); } catch { /* Ignore only this invalid saved draft. */ }
          }
          if (this.drafts.has(saved.active)) active = saved.active;
        }
      } catch { /* Unavailable or corrupt storage does not prevent editing. */ }
      if (!P.RECIPES.some(r => r.id === active && !r.excluded)) active = P.RECIPES.find(r => !r.excluded)!.id;
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
    if (!this.state) return;
    this.drafts.set(this.state.recipe, this.runtime!.E.normalise(this.state));
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, active: this.state.recipe, drafts: Object.fromEntries(this.drafts) })); }
    catch { /* Restricted/full storage: the live in-memory draft is still usable. */ }
  }
  private choose(id: string) {
    if (!this.runtime) return;
    this.remember();
    this.state = this.drafts.get(id) ?? this.runtime.E.recipeState(id, { textFit: 'reference-calibrated' });
    this.state = this.runtime.E.normalise(this.state);
    this.selected = undefined; this.part('dock').hidden = true;
    this.sync(); this.schedule();
  }
  private sync() {
    if (!this.state || !this.runtime) return;
    const { P } = this.runtime, s = this.state;
    for (const key of ['recipe', 'textFit', 'crest', 'tab', 'layout', 'tabSizing'] as const) this.control(key).value = s[key];
    this.control('tabSizing').disabled = P.TABS[s.tab].shape !== 'ribbon' || P.LOCKUPS[s.layout].kind === 'wordmark';
    this.part('name').textContent = P.recipe(s.recipe).name;
    this.part('confidence').textContent = P.recipe(s.recipe).confidence ?? 'Reference-based reconstruction';
    this.part('policy-note').textContent = this.runtime.E.TEXT_FIT_POLICIES[s.textFit].description;
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-recipe]')) b.setAttribute('aria-pressed', String(b.dataset.recipe === s.recipe));
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
      if (!(target instanceof HTMLSelectElement) || !this.state) return;
      const key = target.dataset.control;
      if (key === 'recipe') { this.choose(target.value); return; }
      if (key && ['textFit', 'crest', 'tab', 'layout', 'tabSizing'].includes(key)) {
        this.state = this.runtime!.E.normalise({ ...this.state, [key]: target.value }); this.sync(); this.schedule();
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
      const result = await this.runtime.E.render(snapshot, { allowNetwork });
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
      this.part('metrics').replaceChildren(...result.report.map(row => node('p', `${row.slot ?? row.role}: height ${row.cap.toFixed(1)} · tracking ${row.trackingEm.toFixed(3)} em · ${title(row.stage)}`)));
      const missing = result.warnings.some(w => w.code === 'FONT_FALLBACK');
      this.part('status').textContent = missing ? 'Preview is using an unverified font. Load the named reference fonts before judging fidelity.' : `${result.report.length} editable text runs · click a line to edit`;
      this.rendering = false; this.updateButtons();
    } catch (error) { if (!this.disposed && revision === this.revision) this.fail(error); }
  }
  private updateButtons() {
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-action="svg"], [data-action="png"], [data-action="save"]')) b.disabled = !this.result || this.rendering || this.working;
    this.root.querySelector<HTMLButtonElement>('[data-action="fonts"]')!.disabled = this.working || !this.runtime;
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
    if (!this.state || !this.runtime) return;
    if (action === 'reset') {
      this.state = this.runtime.E.recipeState(this.state.recipe, { textFit: 'reference-calibrated' });
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
    const result = this.result; this.working = true; this.updateButtons();
    try {
      if (action === 'svg') download(`${result.state.recipe}-editable.svg`, this.runtime.E.serialise(result), 'image/svg+xml');
      if (action === 'save') download(`${result.state.recipe}-configuration.json`, JSON.stringify(result.state, null, 2) + '\n', 'application/json');
      if (action === 'png') download(`${result.state.recipe}.png`, await this.runtime.E.png(result, result.state.outputWidth), 'image/png');
    } catch (error) { this.part('status').textContent = `Export failed: ${error instanceof Error ? error.message : String(error)}`; }
    finally { this.working = false; if (!this.disposed) this.updateButtons(); }
  }
  private async openFile() {
    const input = this.part<HTMLInputElement>('file'), file = input.files?.[0];
    if (!file || !this.runtime) return;
    try {
      if (file.size > 1_000_000) throw new Error('Configuration exceeds the 1 MB limit.');
      const next = this.validate(JSON.parse(await file.text()));
      if (this.disposed) return;
      this.remember(); this.state = next; this.selected = undefined; this.part('dock').hidden = true;
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
