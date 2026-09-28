import { useEffect, useMemo, useState } from 'react';
import { byFile, partsOf, pieces, SECTIONS, type Piece } from '../data';
import { dataUrl, themedSvg } from '../svg';
import type { ViewSettings } from '../App';
import { Detail } from './Detail';

interface Props {
  view: ViewSettings;
  selected: string | null;
  onSelect: (file: string | null) => void;
}

export function Library({ view, selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<string>('all');
  const [showParts, setShowParts] = useState(false);
  const [size, setSize] = useState(200);

  // Parts stay out of the grid unless asked for, or when a search matches them.
  const q = query.trim().toLowerCase();
  const matches = (p: Piece) => !q || `${p.title} ${p.file} ${p.note} ${p.source}`.toLowerCase().includes(q);
  const listed = (p: Piece) => (!p.parent || showParts || !!q) && matches(p);

  const sections = useMemo(
    () =>
      SECTIONS.filter((s) => section === 'all' || s.id === section)
        .map((s) => {
          const items: Piece[] = [];
          for (const p of pieces.filter((x) => !x.parent && s.match(x))) {
            if (listed(p)) items.push(p);
            items.push(...partsOf(p.file).filter(listed));
          }
          return { ...s, items };
        })
        .filter((s) => s.items.length),
    [section, showParts, q],
  );
  const visible = sections.flatMap((s) => s.items);
  const current = selected ? byFile.get(selected) ?? null : null;
  const blockCount = pieces.filter((p) => !p.parent).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'Escape') onSelect(null);
      if (!current || !['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      const i = visible.indexOf(current);
      const next = visible[(i + (e.key === 'ArrowRight' ? 1 : visible.length - 1)) % visible.length];
      if (next) onSelect(next.file);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, visible, onSelect]);

  return (
    <div className={`library ${current ? 'with-detail' : ''}`}>
      <aside className="sidebar">
        <input className="search" placeholder="Search, including parts…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className={`navitem top ${section === 'all' ? 'active' : ''}`} onClick={() => setSection('all')}>
          All building blocks <span>{blockCount}</span>
        </button>
        {SECTIONS.map((s) => (
          <button key={s.id} className={`navitem top ${section === s.id ? 'active' : ''}`} onClick={() => setSection(s.id)}>
            {s.label} <span>{pieces.filter((p) => !p.parent && s.match(p)).length}</span>
          </button>
        ))}
        <label className="check">
          <input type="checkbox" checked={showParts} onChange={(e) => setShowParts(e.target.checked)} />
          <span>
            Show scene parts
            <small className="muted"> ({pieces.filter((p) => p.parent).length}, listed after their scene)</small>
          </span>
        </label>
        <label className="range">
          Card size
          <input type="range" min={140} max={320} value={size} onChange={(e) => setSize(+e.target.value)} />
        </label>
      </aside>

      <section className="gridwrap">
        {q && <p className="muted">{visible.length} result(s) for “{query}”</p>}
        {sections.length === 0 && <p className="empty">Nothing matches “{query}”.</p>}
        {sections.map((s) => (
          <div key={s.id} className="section">
            <div className="gridhead">
              <h2>{s.label}</h2>
              <span className="muted">{s.blurb}</span>
            </div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))` }}>
              {s.items.map((p) => (
                <Card key={p.file} piece={p} view={view} size={size} active={p.file === selected} onClick={() => onSelect(p.file === selected ? null : p.file)} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {current && <Detail piece={current} view={view} onClose={() => onSelect(null)} onSelect={onSelect} />}
    </div>
  );
}

function Card({ piece, view, size, active, onClick }: { piece: Piece; view: ViewSettings; size: number; active: boolean; onClick: () => void }) {
  const src = useMemo(() => dataUrl(themedSvg(piece, view.palette)), [piece, view.palette]);
  const parts = partsOf(piece.file).length;
  return (
    <button className={`card ${active ? 'active' : ''} ${piece.parent ? 'part' : ''}`} onClick={onClick}>
      <div className="thumb" style={{ ...view.surface, height: size * 0.8 }}>
        <img src={src} alt={piece.title} loading="lazy" />
      </div>
      <div className="cardtext">
        <span className="title">{piece.title}</span>
        <span className="file">{piece.parent ? `part of ${byFile.get(piece.parent)?.name}` : piece.name}</span>
        <span className="tags">
          {parts > 0 && <span className="tag parts">{parts} parts</span>}
          {!piece.themable && view.palette && <span className="tag">fixed colours</span>}
        </span>
      </div>
    </button>
  );
}
