import { useEffect, useMemo, useState } from 'react';
import { FAMILIES, references, type FamilyId, type VB } from '../data';
import { LAYERS, PRESETS, resolve, type Preset } from '../layers';
import { dataUrl, download, downloadPng, finish, stack } from '../svg';
import { MAX_HALF_SPAN, TAB, tabPiece, type TabSide } from '../tab';

const TAB_LAYERS: Record<string, TabSide> = { 'ribbon-lower': 'lower', 'ribbon-upper': 'upper' };
import type { ViewSettings } from '../App';

export function Compose({ view, onOpen }: { view: ViewSettings; onOpen: (file: string) => void }) {
  const [family, setFamily] = useState<FamilyId>('bc-ministry-v5');
  const [layers, setLayers] = useState<Set<string>>(new Set(PRESETS[1].layers));
  const [preset, setPreset] = useState<string | null>(PRESETS[1].name);
  const [refKey, setRefKey] = useState<string>(PRESETS[1].reference ?? '');
  const [opacity, setOpacity] = useState(0.5);
  const [blend, setBlend] = useState<'normal' | 'difference'>('normal');
  const [showCentre, setShowCentre] = useState(false);
  const [showBounds, setShowBounds] = useState(false);
  const [zoom, setZoom] = useState(1);

  const reference = references.find((r) => r.key === refKey && r.family === family) ?? null;
  // Tabs can grow around the oval: a span other than the default draws the band
  // from tab.ts (already in place, so the upper tab's turn is not applied again).
  const [spans, setSpans] = useState<Record<TabSide, number>>({ lower: TAB.halfSpan, upper: TAB.halfSpan });
  const chosen = useMemo(
    () =>
      resolve(family, layers).map((c) => {
        const side = TAB_LAYERS[c.layer.key];
        return side && spans[side] !== TAB.halfSpan ? { layer: { ...c.layer, instances: undefined }, piece: tabPiece(side, spans[side]) } : c;
      }),
    [family, layers, spans],
  );
  const tabsShown = (Object.keys(TAB_LAYERS) as string[]).filter((k) => family === 'bc-ministry-v5' && layers.has(k));

  // The finished logo to overlay, fetched when first picked.
  const [loaded, setLoaded] = useState<{ key: string; href: string; vb: VB } | null>(null);
  useEffect(() => {
    if (!reference || loaded?.key === reference.key) return;
    let live = true;
    reference.load().then(({ svg, vb }) => { if (live) setLoaded({ key: reference.key, href: dataUrl(svg), vb }); }, () => {});
    return () => { live = false; };
  }, [reference, loaded]);
  const overlay = reference && loaded?.key === reference.key ? loaded : null;

  // Stacking the pieces is the costly part; the overlay and guides are added on top.
  const stacked = useMemo(() => stack(chosen, { palette: view.palette }), [chosen, view.palette]);
  const clean = useMemo(() => finish(stacked), [stacked]);
  const shown = useMemo(
    () =>
      finish(stacked, {
        overlay: overlay ? { href: overlay.href, vb: overlay.vb, opacity, blend } : null,
        centre: showCentre ? FAMILIES[family].centre : null,
        bounds: showBounds,
      }),
    [stacked, overlay, opacity, blend, showCentre, showBounds, family],
  );

  const applyPreset = (p: Preset) => {
    setFamily(p.family);
    setLayers(new Set(p.layers));
    setPreset(p.name);
    setRefKey(p.reference ?? '');
    if (p.theme) view.setThemeId(p.theme);
  };
  const toggle = (key: string) => {
    const next = new Set(layers);
    next.has(key) ? next.delete(key) : next.add(key);
    setLayers(next);
    setPreset(null);
  };
  const switchFamily = (f: FamilyId) => {
    if (f === family) return;
    setFamily(f);
    setLayers(new Set());
    setPreset(null);
    setRefKey('');
  };

  return (
    <div className="compose">
      <aside className="sidebar wide">
        <div className="segmented">
          {(Object.keys(FAMILIES) as FamilyId[]).map((f) => (
            <button key={f} className={family === f ? 'active' : ''} onClick={() => switchFamily(f)}>{FAMILIES[f].label}</button>
          ))}
        </div>
        <p className="muted small">Pieces are stacked in their original coordinates ({FAMILIES[family].space}). If the isolation is right, they line up without any nudging.</p>

        <h4>Presets</h4>
        <div className="presets">
          {PRESETS.filter((p) => p.family === family).map((p) => (
            <button key={p.name} className={preset === p.name ? 'active' : ''} onClick={() => applyPreset(p)}>{p.name}</button>
          ))}
        </div>

        <h4>Layers <span className="muted">(back → front)</span></h4>
        <ul className="layers">
          {LAYERS[family].map((l) => (
            <li key={l.key}>
              <label>
                <input type="checkbox" checked={layers.has(l.key)} onChange={() => toggle(l.key)} />
                <span>
                  {l.label}
                  {l.hint && <small>{l.hint}</small>}
                </span>
              </label>
              <button className="link" title="Open in library" onClick={() => onOpen(l.file)}>↗</button>
            </li>
          ))}
        </ul>

        {tabsShown.length > 0 && (
          <>
            <h4>Tabs</h4>
            {tabsShown.map((k) => {
              const side = TAB_LAYERS[k];
              return (
                <label key={k} className="range">
                  {side === 'lower' ? 'Lower' : 'Upper'} tab span ±{spans[side].toFixed(1)}°{spans[side] === TAB.halfSpan ? ' (default)' : ''}
                  <input type="range" min={30} max={MAX_HALF_SPAN} step={0.1} value={spans[side]} onChange={(e) => setSpans({ ...spans, [side]: +e.target.value })} />
                </label>
              );
            })}
            {(spans.lower !== TAB.halfSpan || spans.upper !== TAB.halfSpan) && (
              <button className="small" onClick={() => setSpans({ lower: TAB.halfSpan, upper: TAB.halfSpan })}>Reset tabs</button>
            )}
          </>
        )}

        <h4>Compare with a finished logo</h4>
        <select value={reference?.key ?? ''} onChange={(e) => setRefKey(e.target.value)}>
          <option value="">No overlay</option>
          {references.filter((r) => r.family === family).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        {reference && (
          <>
            <label className="range">
              Overlay opacity {Math.round(opacity * 100)}%
              <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(+e.target.value)} />
            </label>
            <label className="check">
              <input type="checkbox" checked={blend === 'difference'} onChange={(e) => { setBlend(e.target.checked ? 'difference' : 'normal'); setOpacity(e.target.checked ? 1 : 0.5); }} />
              Difference blend (matching areas go dark)
            </label>
          </>
        )}

        <h4>Guides</h4>
        <label className="check"><input type="checkbox" checked={showCentre} onChange={(e) => setShowCentre(e.target.checked)} /> Crest centre crosshair</label>
        <label className="check"><input type="checkbox" checked={showBounds} onChange={(e) => setShowBounds(e.target.checked)} /> Each piece’s viewBox</label>
      </aside>

      <section className="canvaswrap">
        <div className="canvasbar">
          <span className="muted">{chosen.length} layer(s){preset ? ` · ${preset}` : ''}{reference ? ` · overlay: ${reference.label}` : ''}</span>
          <span className="row">
            {[1, 1.5, 2, 3].map((z) => (
              <button key={z} className={zoom === z ? 'active' : ''} onClick={() => setZoom(z)}>{z === 1 ? 'Fit' : `${z}×`}</button>
            ))}
            <button disabled={!chosen.length} onClick={() => download(`composite${view.palette ? '.' + view.themeId : ''}.svg`, clean.svg)}>SVG</button>
            <button disabled={!chosen.length} onClick={() => downloadPng(`composite${view.palette ? '.' + view.themeId : ''}.png`, clean.svg, clean.vb, 1600)}>PNG</button>
          </span>
        </div>
        <div className="canvas" style={view.surface}>
          {chosen.length || overlay ? (
            <img src={dataUrl(shown.svg)} alt="Composite" style={zoom === 1 ? undefined : { height: `${zoom * 100}%`, maxHeight: 'none', maxWidth: 'none' }} />
          ) : (
            <p className="empty">Pick a preset or tick some layers.</p>
          )}
        </div>
        <p className="muted small">Downloads exclude the overlay and guides.</p>
      </section>
    </div>
  );
}
