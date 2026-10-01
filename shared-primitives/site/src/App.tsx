import { Component, lazy, Suspense, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { PRIMITIVE_TOKENS, themes, type Palette } from './data';
import { Library } from './components/Library';

// The other tabs load when first opened.
const LiveLettering = lazy(() => import('./components/LiveLettering').then((m) => ({ default: m.LiveLettering })));
const Recreations = lazy(() => import('./components/Recreations').then((m) => ({ default: m.Recreations })));
const Compose = lazy(() => import('./components/Compose').then((m) => ({ default: m.Compose })));
const Checks = lazy(() => import('./components/Checks').then((m) => ({ default: m.Checks })));

/** Keeps a failing tab (e.g. a missing saved fit) from blanking the whole page. */
class TabBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <strong>This tab failed to render.</strong> The other tabs still work.
        <pre>{this.state.error.message}</pre>
      </div>
    );
  }
}

type Tab = 'lettering' | 'library' | 'recreations' | 'compose' | 'checks';
type Backdrop = 'checker' | 'white' | 'dark' | 'custom';

export interface ViewSettings {
  palette: Palette | null;
  surface: CSSProperties;
  themeId: string;
  setThemeId: (id: string) => void;
}

const TABS: [Tab, string][] = [
  ['lettering', 'Live lettering'],
  ['library', 'Library'],
  ['recreations', 'Recreations'],
  ['compose', 'Layer assembly'],
  ['checks', 'Checks'],
];

// The live lettering editor is the main app: it opens at the site root.
const readTab = (): Tab => {
  const t = location.hash.replace('#/', '');
  return TABS.some(([id]) => id === t) ? (t as Tab) : 'lettering';
};

function surfaceStyle(backdrop: Backdrop, colour: string): CSSProperties {
  switch (backdrop) {
    case 'white': return { background: '#ffffff' };
    case 'dark': return { background: '#1a1d1c' };
    case 'custom': return { background: colour };
    default: return { background: 'repeating-conic-gradient(#e8ebe6 0 25%, #ffffff 0 50%) 0 0 / 16px 16px' };
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readTab);
  const [themeId, setThemeId] = useState('source');
  const [custom, setCustom] = useState<Palette>({ ...themes.wildlife });
  const [backdrop, setBackdrop] = useState<Backdrop>('checker');
  const [backdropColour, setBackdropColour] = useState('#f3ecdd');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setTab(readTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (t: Tab) => { location.hash = '/' + t; setTab(t); };
  const palette = themeId === 'source' ? null : themeId === 'custom' ? custom : themes[themeId];
  const view: ViewSettings = { palette, surface: surfaceStyle(backdrop, backdropColour), themeId, setThemeId };

  const editCustom = () => {
    if (palette) setCustom({ ...palette });
    setThemeId('custom');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>Forest oval lettering</strong>
          <span>BC Ministry v5 · Airtanker package · shared primitives</span>
        </div>
        <nav className="tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => go(id)}>{label}</button>
          ))}
        </nav>
        <div className="controls">
          <label>
            Colours
            <select value={themeId} onChange={(e) => setThemeId(e.target.value)}>
              <option value="source">Source colours</option>
              {Object.keys(themes).map((t) => <option key={t} value={t}>Theme · {t}</option>)}
              <option value="custom">Custom…</option>
            </select>
          </label>
          {themeId !== 'custom' && <button className="ghost" onClick={editCustom}>Edit</button>}
          <label>
            Backdrop
            <select value={backdrop} onChange={(e) => setBackdrop(e.target.value as Backdrop)}>
              <option value="checker">Transparent</option>
              <option value="white">White</option>
              <option value="dark">Dark</option>
              <option value="custom">Colour</option>
            </select>
          </label>
          {backdrop === 'custom' && <input type="color" value={backdropColour} onChange={(e) => setBackdropColour(e.target.value)} />}
          {import.meta.env.PROD && <a className="studiolink" href="./lettering/" title="The live lettering editor on its own page">Lettering app ↗</a>}
          {import.meta.env.PROD && <a className="studiolink" href="./studio/" title="The v5 studio: live lettering engine">v5 studio ↗</a>}
        </div>
      </header>

      {themeId === 'custom' && (
        <div className="palettebar">
          <span className="muted">Custom palette. Applies to the v5 pieces the engine themes.</span>
          {PRIMITIVE_TOKENS.map((t) => (
            <label key={t} className="swatch">
              <input type="color" value={custom[t]} onChange={(e) => setCustom({ ...custom, [t]: e.target.value })} />
              {t}
            </label>
          ))}
          <select value="" onChange={(e) => e.target.value && setCustom({ ...themes[e.target.value] })}>
            <option value="">Reset from…</option>
            {Object.keys(themes).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      <main className="main">
        <TabBoundary key={tab}>
          <Suspense fallback={<p className="empty">Loading…</p>}>
            {tab === 'lettering' && <LiveLettering view={view} />}
            {tab === 'library' && <Library view={view} selected={selected} onSelect={setSelected} />}
            {tab === 'recreations' && <Recreations view={view} onOpen={(f) => { setSelected(f); go('library'); }} />}
            {tab === 'compose' && <Compose view={view} onOpen={(f) => { setSelected(f); go('library'); }} />}
            {tab === 'checks' && <Checks onOpen={(f) => { setSelected(f); go('library'); }} />}
          </Suspense>
        </TabBoundary>
      </main>
    </div>
  );
}
