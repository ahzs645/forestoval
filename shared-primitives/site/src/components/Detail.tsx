import { useMemo, useState } from 'react';
import { byFile, FAMILIES, partsOf, type Piece } from '../data';
import { dataUrl, download, downloadPng, themedSvg } from '../svg';
import type { ViewSettings } from '../App';

interface Props {
  piece: Piece;
  view: ViewSettings;
  onClose: () => void;
  onSelect: (file: string) => void;
}

export function Detail({ piece, view, onClose, onSelect }: Props) {
  const [zoom, setZoom] = useState(0); // 0 = fit
  const [pngWidth, setPngWidth] = useState(1200);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState('');
  const svg = useMemo(() => themedSvg(piece, view.palette), [piece, view.palette]);
  const src = useMemo(() => dataUrl(svg), [svg]);
  const themed = view.palette && piece.themable;
  const suffix = themed ? `.${view.themeId}` : '';
  const base = piece.name.replace(/\.svg$/, '') + suffix;
  const [, , w, h] = piece.vb;
  const parts = partsOf(piece.file);
  const parent = piece.parent ? byFile.get(piece.parent) : null;

  const flash = (label: string) => {
    setCopied(label);
    setTimeout(() => setCopied(''), 1400);
  };
  // Clipboard access can be refused (permissions, insecure origin): say so.
  const copy = (label: string, text: string) =>
    navigator.clipboard.writeText(text).then(() => flash(label), () => flash(label + '-failed'));

  return (
    <aside className="detail">
      <div className="detailhead">
        <div>
          <h3>{piece.title}</h3>
          <code>{piece.file}</code>
        </div>
        <button className="ghost close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="stage" style={view.surface}>
        <img src={src} alt={piece.title} style={zoom ? { width: w * zoom, maxWidth: 'none', maxHeight: 'none' } : undefined} />
      </div>
      <div className="row">
        <button className={zoom === 0 ? 'active' : ''} onClick={() => setZoom(0)}>Fit</button>
        {[0.5, 1, 2, 4].map((z) => (
          <button key={z} className={zoom === z ? 'active' : ''} onClick={() => setZoom(z)}>{z * 100}%</button>
        ))}
      </div>

      {parent && (
        <button className="link backlink" onClick={() => onSelect(parent.file)}>← Part of {parent.title}</button>
      )}
      {parts.length > 0 && (
        <div className="parts">
          <h4>Parts <span className="muted">({parts.length}, stack back to this scene exactly)</span></h4>
          <div className="partstrip">
            {parts.map((p) => (
              <PartThumb key={p.file} piece={p} view={view} onClick={() => onSelect(p.file)} />
            ))}
          </div>
        </div>
      )}

      <dl className="meta">
        <dt>Family</dt>
        <dd>{FAMILIES[piece.family].label} <span className="muted">({FAMILIES[piece.family].space})</span></dd>
        <dt>Source</dt>
        <dd>{piece.source}</dd>
        <dt>viewBox</dt>
        <dd><code>{piece.viewBox}</code></dd>
        <dt>Size</dt>
        <dd>{w.toFixed(1)} × {h.toFixed(1)} units · {(piece.svg.length / 1024).toFixed(1)} KB</dd>
        <dt>Colours</dt>
        <dd>{piece.themable ? (themed ? `Theme “${view.themeId}” applied` : 'Source colours (themable)') : 'Fixed; not themed by the engine'}</dd>
        {piece.note && (<><dt>Note</dt><dd>{piece.note}</dd></>)}
      </dl>

      <div className="actions">
        <button onClick={() => download(base + '.svg', svg)}>Download SVG</button>
        <span className="pngrow">
          <button onClick={() => downloadPng(base + '.png', svg, piece.vb, pngWidth)}>Download PNG</button>
          <input type="number" min={64} max={6000} step={100} value={pngWidth} onChange={(e) => setPngWidth(Math.max(64, Math.min(6000, +e.target.value || 1200)))} />
          <span className="muted">px wide</span>
        </span>
        <button className="ghost" onClick={() => copy('svg', svg)}>{copied === 'svg' ? 'Copied ✓' : copied === 'svg-failed' ? 'Copy failed' : 'Copy SVG markup'}</button>
        <button className="ghost" onClick={() => copy('path', piece.file)}>{copied === 'path' ? 'Copied ✓' : copied === 'path-failed' ? 'Copy failed' : 'Copy file path'}</button>
      </div>

      <button className="ghost codetoggle" onClick={() => setShowCode(!showCode)}>{showCode ? 'Hide' : 'Show'} SVG source</button>
      {showCode && <pre className="code">{svg.length > 60000 ? svg.slice(0, 60000) + '\n… (truncated; use Download or Copy for the full file)' : svg}</pre>}
    </aside>
  );
}

function PartThumb({ piece, view, onClick }: { piece: Piece; view: ViewSettings; onClick: () => void }) {
  const src = useMemo(() => dataUrl(themedSvg(piece, view.palette)), [piece, view.palette]);
  return (
    <button className="partthumb" onClick={onClick} title={piece.title}>
      <span style={view.surface}><img src={src} alt="" /></span>
      <small>{piece.name.replace(/\.svg$/, '').replace('-', ' ')}</small>
    </button>
  );
}
