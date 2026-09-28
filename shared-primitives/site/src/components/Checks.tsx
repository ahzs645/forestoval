import { useCallback, useEffect, useRef, useState } from 'react';
import { pieces } from '../data';
import { REASSEMBLY } from '../layers';
import { COLUMNS, pixelChecks, reassembly, staticChecks, type PieceReport, type ReassemblyResult, type Status } from '../checks';

const ICON: Record<Status, string> = { pass: '✓', warn: '!', fail: '✗', info: 'i' };

export function Checks({ onOpen }: { onOpen: (file: string) => void }) {
  const [reports, setReports] = useState<Record<string, PieceReport>>({});
  const [rebuilds, setRebuilds] = useState<ReassemblyResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const started = useRef(false);
  const total = pieces.length + REASSEMBLY.length;

  const run = useCallback(async () => {
    setRunning(true);
    setProgress(0);
    setRebuilds([]);
    const initial = Object.fromEntries(pieces.map((p) => [p.file, staticChecks(p)]));
    setReports(initial);
    let done = 0;
    for (const p of pieces) {
      let px: PieceReport;
      try {
        px = await pixelChecks(p);
      } catch (e) {
        px = { clip: { status: 'fail', detail: String(e) } };
      }
      setReports((r) => ({ ...r, [p.file]: { ...r[p.file], ...px } }));
      setProgress(++done);
    }
    for (const t of REASSEMBLY) {
      const result = await reassembly(t);
      setRebuilds((r) => [...r, result]);
      setProgress(++done);
    }
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!started.current) { started.current = true; run(); }
  }, [run]);

  const statuses = [...Object.values(reports).flatMap((r) => Object.values(r).map((c) => c!.status)), ...rebuilds.map((r) => r.status)];
  const count = (s: Status) => statuses.filter((x) => x === s).length;

  return (
    <div className="checks">
      <div className="checkshead">
        <div>
          <h2>Checks</h2>
          <p className="muted">Runs in this browser against the generated files. Rerun after regenerating with <code>npm run regen</code>.</p>
        </div>
        <div className="summary">
          <span className="pill pass">{count('pass')} pass</span>
          <span className="pill warn">{count('warn')} warn</span>
          <span className="pill fail">{count('fail')} fail</span>
          <button onClick={run} disabled={running}>{running ? `Running ${progress}/${total}…` : 'Run again'}</button>
        </div>
      </div>
      {running && <div className="progress"><div style={{ width: `${(progress / total) * 100}%` }} /></div>}

      <h3>Reassembly</h3>
      <p className="muted small">Each set of parts is stacked in place and compared pixel by pixel with the composite it came from. Pink marks pixels that differ.</p>
      <div className="rebuilds">
        {rebuilds.map((r) => (
          <figure key={r.name} className={`rebuild ${r.status}`}>
            <figcaption>
              <span className={`badge ${r.status}`}>{ICON[r.status]}</span> {r.name}
              <small>{(r.mismatch * 100).toFixed(2)}% of painted pixels differ</small>
            </figcaption>
            <div className="triptych">
              <div><img src={r.target} alt="" /><small>composite</small></div>
              <div><img src={r.rebuilt} alt="" /><small>parts stacked</small></div>
              <div><img src={r.diff} alt="" /><small>difference</small></div>
            </div>
          </figure>
        ))}
        {rebuilds.length < REASSEMBLY.length && running && <p className="muted">Comparing…</p>}
      </div>

      <h3>Per file</h3>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>File</th>
              {COLUMNS.map(([, label]) => <th key={label}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {pieces.map((p) => (
              <tr key={p.file}>
                <td><button className="link" onClick={() => onOpen(p.file)}>{p.file}</button></td>
                {COLUMNS.map(([id]) => {
                  const c = reports[p.file]?.[id];
                  return (
                    <td key={id} title={c?.detail}>
                      {c ? <span className={`badge ${c.status}`}>{ICON[c.status]}</span> : <span className="muted">…</span>}
                      {id === 'padding' && c && <small className="padding">{c.detail.split(' units')[0]}</small>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Hover a cell for details. “Padding” is the measured space between the artwork and each viewBox edge, in design units.</p>
    </div>
  );
}
