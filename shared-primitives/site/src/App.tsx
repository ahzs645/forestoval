import { useEffect, useState, type CSSProperties } from 'react';
import { PRIMITIVE_TOKENS, themes, type Palette } from './data';
import { Library } from './components/Library';
import { Compose } from './components/Compose';
import { Checks } from './components/Checks';
import { Recreations } from './components/Recreations';

type Tab = 'library' | 'recreations' | 'compose' | 'checks';
export type Backdrop = 'checker' | 'white' | 'dark' | 'custom';

export interface ViewSettings {
  palette: Palette | null;
  surface: CSSProperties;
  themeId: string;
  setThemeId: (id: string) => void;
}

const TABS: [Tab, string][] = [
  ['library', 'Library'],
  ['recreations', 'Recreations'],
  ['compose', 'Compose'],
  ['checks', 'Checks'],
];

const readTab = (): Tab => {
  const t = location.hash.replace('#/', '');
  return t === 'recreations' || t === 'compose' || t === 'checks' ? t : 'library';
};

export function surfaceStyle(backdrop: Backdrop, colour: string): CSSProperties {
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
          <strong>Shared primitives</strong>
          <span>BC Ministry v5 · Airtanker package</span>
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
        {tab === 'library' && <Library view={view} selected={selected} onSelect={setSelected} />}
        {tab === 'recreations' && <Recreations view={view} onOpen={(f) => { setSelected(f); go('library'); }} />}
        {tab === 'compose' && <Compose view={view} onOpen={(f) => { setSelected(f); go('library'); }} />}
        {tab === 'checks' && <Checks onOpen={(f) => { setSelected(f); go('library'); }} />}
      </main>
    </div>
  );
}
