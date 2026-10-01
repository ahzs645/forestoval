import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  build,
  buildLive,
  CREST_VARIANTS,
  fits,
  letteringRuns,
  liveRecipes,
  RECREATIONS,
  referencesFor,
  variantMembers,
  type Built,
  type LetteringFit,
  type LiveLettering,
  type Recreation,
  type ReferenceImage,
} from '../recreations';
import type { ViewSettings } from '../App';
import { NEW_DRAFT } from '../lettering/editor';
import { loadLetteringRuntime } from '../lettering/runtime';

type Mode = 'side' | 'wipe' | 'overlay' | 'difference';
type Source = 'live' | 'fitted' | 'v5';
const SOURCES: [Source, string, string][] = [
  ['live', 'Live engine', 'Drawn now by the v5 engine, configured as Compose → Live lettering (reference-calibrated).'],
  ['fitted', 'Saved reference fit · legacy', 'The saved v5 examples with the fits in lettering-fit.json applied.'],
  ['v5', 'Saved v5 examples · legacy', 'The lettering in the saved v5 examples, as generated.'],
];

// Rendered once per page load: the engine's lettering for every recipe used here.
let livePending: Promise<LiveLettering> | undefined;
function loadLive(): Promise<LiveLettering> {
  livePending ??= (async () => {
    const { E } = await loadLetteringRuntime();
    const live: LiveLettering = { svgs: {}, backing: {}, warnings: {} };
    for (const id of liveRecipes()) {
      const r = await E.render(E.recipeState(id, NEW_DRAFT));
      live.svgs[id] = new XMLSerializer().serializeToString(r.svg);
      live.backing[id] = r.state.tabBacking;
      live.warnings[id] = r.warnings.filter((w) => w.code.startsWith('FONT_') || w.code === 'REFERENCE_PROFILE_UNAVAILABLE').map((w) => w.message);
    }
    return live;
  })();
  livePending.catch(() => { livePending = undefined; });
  return livePending;
}
function useLive(enabled: boolean) {
  const [state, setState] = useState<{ live?: LiveLettering; error?: string }>({});
  useEffect(() => {
    if (!enabled || state.live) return;
    let alive = true;
    loadLive().then((live) => alive && setState({ live }), (e: unknown) => alive && setState({ error: e instanceof Error ? e.message : String(e) }));
    return () => { alive = false; };
  }, [enabled, state.live]);
  return state;
}

const MODES: [Mode, string][] = [
  ['side', 'Side by side'],
  ['wipe', 'Wipe'],
  ['overlay', 'Overlay'],
  ['difference', 'Difference'],
];

export function Recreations({ view, onOpen }: { view: ViewSettings; onOpen: (file: string) => void }) {
  const [mode, setMode] = useState<Mode>('side');
  const [source, setSource] = useState<Source>('live');
  const live = useLive(source === 'live');
  const [showHidden, setShowHidden] = useState(false);
  const hiddenCount = RECREATIONS.filter((r) => r.hidden).length;
  const shown = RECREATIONS.filter((r) => showHidden || !r.hidden);
  return (
    <div className="recreations">
      <div className="rechead">
        <div>
          <h2>Recreations</h2>
          <p className="muted">
            Each supplied reference next to the same logo rebuilt from the shared primitives. The artwork is our pieces; the lettering is drawn by the live v5 engine with
            the same recipe and configuration as Compose → Live lettering. The two saved-lettering modes are kept as legacy evidence of the earlier pipeline.
            The references are the supplied images, kept in <code>shared-primitives/references/</code>.
          </p>
        </div>
        <div className="recswitches">
          <div className="segmented modes">
            {MODES.map(([m, label]) => (
              <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>{label}</button>
            ))}
          </div>
          <div className="segmented modes" title="Lettering only; the artwork is the same pieces in every mode.">
            {SOURCES.map(([s, label, hint]) => (
              <button key={s} className={source === s ? 'active' : ''} title={hint} onClick={() => setSource(s)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      {hiddenCount > 0 && (
        <label className="check small">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          Show hidden logos ({hiddenCount}: the BCTS wordmark beside the crest)
        </label>
      )}
      {source === 'live' && live.error && <p className="crash">The live engine failed to load: {live.error}</p>}
      <CrestVariants showHidden={showHidden} />
      <div className="recgrid">
        {shown.map((r) => <RecreationCard key={r.id} rec={r} mode={mode} source={source} live={live.live} view={view} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

/** The lettering around the oval: one shared fit per crest variant. */
function CrestVariants({ showHidden }: { showHidden: boolean }) {
  const name = (id: string) => RECREATIONS.find((r) => r.id === id)?.name ?? id;
  // Parsing each variant's lettering is not free; it never changes.
  const lines = useMemo(() => Object.fromEntries(CREST_VARIANTS.map((v) => {
    const members = variantMembers(v.id);
    return [v.id, members.length ? letteringRuns(members[0]).filter((r) => r.shared?.rec === v.id) : []];
  })), []);
  return (
    <section className="variants">
      <h3>Saved lettering fits (legacy)</h3>
      <p className="muted small">
        These saved fits apply only to the “Saved reference fit” mode; the live engine has its own reference calibration.
        Each crest variant's lettering is fitted once, to every reference that uses it at the same time, and then used unchanged on each of those logos.
        The scores are the overlap with each reference's letters on the crest band: v5 placement → shared fit. Parks has its own face and is fitted alone.
      </p>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Variant</th><th>Lettering</th><th>Logos (overlap on the crest band)</th><th>Mean</th></tr></thead>
          <tbody>
            {CREST_VARIANTS.map((v) => {
              const fit = fits[v.id], members = variantMembers(v.id);
              return (
                <tr key={v.id}>
                  <td>{v.name[0].toUpperCase() + v.name.slice(1)}</td>
                  <td>{lines[v.id].map((r) => <div key={r.key}>{r.text} <span className="muted small">· {r.family.split(',')[0].replace(/"/g, '')} {r.weight}</span></div>)}</td>
                  <td>
                    {members.filter((m) => showHidden || !m.hidden).map((m) => {
                      const s = fit?.members?.[m.id];
                      return <div key={m.id}>{name(m.id)} <span className="muted small">{!s ? 'no registered reference' : s.before || s.after ? `${s.before.toFixed(2)} → ${s.after.toFixed(2)}` : 'crest too small in its reference to judge'}</span></div>;
                    })}
                  </td>
                  <td>{fit ? `${fit.before.toFixed(2)} → ${fit.after.toFixed(2)}` : <span className="muted">not fitted</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface CardProps {
  rec: Recreation;
  mode: Mode;
  source: Source;
  live?: LiveLettering;
  view: ViewSettings;
  onOpen: (file: string) => void;
}

function RecreationCard({ rec, mode, source, live, view, onOpen }: CardProps) {
  const refs = useMemo(() => referencesFor(rec.id), [rec.id]);
  const [active, setActive] = useState<ReferenceImage | undefined>(() => refs.find((r) => r.role === 'primary'));
  const built = useMemo(() => (source === 'live' ? (live ? buildLive(rec, live) : null) : build(rec, source === 'fitted')), [rec, source, live]);
  const fitted = source === 'fitted';
  const [t, setT] = useState(0.5);
  const others = refs.filter((r) => r !== active);

  if (!built) {
    return (
      <article className="reccard">
        <header><h3>{rec.name}</h3></header>
        <p className="muted">Rendering with the live engine…</p>
      </article>
    );
  }

  return (
    <article className="reccard">
      <header>
        <h3>{rec.name}</h3>
        {rec.note && <p className="muted small">{rec.note}</p>}
      </header>

      {mode === 'side' || !active?.registration ? (
        <div className="panes">
          <figure>
            <div className="pane" style={view.surface}>{active ? <img src={active.url} alt={active.original} /> : <span className="muted">No reference</span>}</div>
            <figcaption>Reference</figcaption>
          </figure>
          <figure>
            <div className="pane" style={view.surface}>
              <svg viewBox={built.vb.join(' ')} dangerouslySetInnerHTML={{ __html: built.inner }} />
            </div>
            <figcaption>Rebuilt from primitives</figcaption>
          </figure>
        </div>
      ) : (
        <Stage rec={rec} built={built} reference={active} mode={mode} t={t} setT={setT} surface={view.surface} />
      )}
      {mode !== 'side' && active?.registration && mode !== 'difference' && (
        <label className="range inline">
          {mode === 'wipe' ? 'Rebuilt ◀ ▶ reference' : `Rebuilt opacity ${Math.round(t * 100)}%`}
          <input type="range" min={0} max={1} step={0.01} value={t} onChange={(e) => setT(+e.target.value)} />
        </label>
      )}
      {mode !== 'side' && active && !active.registration && <p className="muted small">This reference has no registration, so it can only be shown side by side.</p>}

      <dl className="recmeta">
        <dt>Built from</dt>
        <dd className="chips">
          {built.parts.length === 0 && <span className="muted">no artwork</span>}
          {built.parts.map((p) => (
            <button key={p.key} className="chip" onClick={() => onOpen(p.file)}>{p.label}</button>
          ))}
          <span className="chip plain">theme · {rec.theme}</span>
        </dd>
        <dt>Lettering</dt>
        <dd>
          {built.letteringFrom.join(' + ')}
          <br />
          {source === 'live' ? (
            <span className="muted">
              Same recipe and configuration as Compose → Live lettering; no saved corrections applied.
              {built.warnings?.map((w) => <span key={w} className="recwarn"><br />⚠ {w}</span>)}
            </span>
          ) : built.fit ? (
            <span className="muted" title={fitSummary(built.fit)}>
              Fitted to {built.fit.reference}: overlap with its letters {built.fit.before.toFixed(2)} → {built.fit.after.toFixed(2)}
              {built.fit.frozen?.length ? ` · ${built.fit.frozen.length} run(s) too small to fit, left as v5` : ''}
            </span>
          ) : (
            <span className="muted">{fitted ? 'No fit saved for this reference; v5 placement.' : 'v5 placement, as generated by the studio.'}</span>
          )}
        </dd>
        {active && (
          <>
            <dt>Reference</dt>
            <dd>
              {active.original} <span className="muted">({active.width} × {active.height})</span>
              <br />
              <span className="muted">{active.method}{active.note ? ` · ${active.note}` : ''}</span>
            </dd>
          </>
        )}
      </dl>

      {others.length > 0 && (
        <div className="alts">
          <span className="muted small">Also in the folder:</span>
          {others.map((r) => (
            <button key={r.url} className="alt" title={`${r.original}${r.note ? ' · ' + r.note : ''}`} onClick={() => setActive(r)}>
              <img src={r.url} alt="" />
              <small>{r.role === 'context' ? 'in use' : r.registration ? 'alternate' : 'alternate · side only'}</small>
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function Stage({ rec, built, reference, mode, t, setT, surface }: {
  rec: Recreation;
  built: Built;
  reference: ReferenceImage;
  mode: Mode;
  t: number;
  setT: (t: number) => void;
  surface: CSSProperties;
}) {
  const [x, y, w, h] = built.vb;
  const r = reference.registration!;
  const svg = useRef<SVGSVGElement>(null);
  const split = x + w * t;
  const id = `wipe-${rec.id}`;

  const drag = (e: PointerEvent<SVGSVGElement>) => {
    if (mode !== 'wipe' || !(e.buttons & 1) || !svg.current) return;
    // Keep following the pointer when it leaves the picture mid-drag.
    if (e.type === 'pointerdown') svg.current.setPointerCapture(e.pointerId);
    const m = svg.current.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    setT(Math.min(1, Math.max(0, (p.x - x) / w)));
  };

  return (
    <div className="stage-lg" style={surface}>
      <svg ref={svg} viewBox={built.vb.join(' ')} style={{ isolation: 'isolate', cursor: mode === 'wipe' ? 'ew-resize' : undefined, touchAction: mode === 'wipe' ? 'none' : undefined }} onPointerDown={drag} onPointerMove={drag}>
        <defs>
          <clipPath id={id + '-l'}><rect x={x} y={y} width={split - x} height={h} /></clipPath>
          <clipPath id={id + '-r'}><rect x={split} y={y} width={x + w - split} height={h} /></clipPath>
        </defs>
        <image href={reference.url} x={r.x} y={r.y} width={r.w} height={r.h} preserveAspectRatio="none" clipPath={mode === 'wipe' ? `url(#${id}-r)` : undefined} />
        <g
          clipPath={mode === 'wipe' ? `url(#${id}-l)` : undefined}
          opacity={mode === 'overlay' ? t : 1}
          style={mode === 'difference' ? { mixBlendMode: 'difference' } : undefined}
          dangerouslySetInnerHTML={{ __html: built.inner }}
        />
        {mode === 'wipe' && <line x1={split} x2={split} y1={y} y2={y + h} stroke="#e5007e" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
      </svg>
      {mode === 'wipe' && (
        <div className="stagelabels">
          <span>Rebuilt</span>
          <span>Reference</span>
        </div>
      )}
    </div>
  );
}

/** Per-run adjustments, for the tooltip. */
function fitSummary(fit: LetteringFit) {
  return Object.entries(fit.runs)
    .map(([key, p]) => {
      const bits = [`size ×${p.scale.toFixed(3)}`, `tracking ${p.spacing >= 0 ? '+' : ''}${p.spacing.toFixed(2)}`];
      if (p.rot) bits.push(`rotated ${p.rot.toFixed(2)}°`);
      if (p.dx || p.dy) bits.push(`moved ${p.dx.toFixed(1)}, ${p.dy.toFixed(1)}`);
      if (p.dr || p.dry) bits.push(`radius ${p.dr.toFixed(1)} / ${(p.dr + p.dry).toFixed(1)}`);
      if (p.gaps?.some(Boolean)) bits.push(`word gaps ${p.gaps.map((g) => g.toFixed(1)).join(', ')}`);
      return `${key.split(':')[1]}: ${bits.join(', ')}`;
    })
    .join('\n');
}
