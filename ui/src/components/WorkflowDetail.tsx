import { useNavigate } from 'react-router-dom';
import type { Workflow, Run } from '../types';
import Icon from './Icon';
import Kbd from './Kbd';
import Tag from './Tag';
import Glyph from './Glyph';

interface Props {
  workflow: Workflow;
  runs: Run[];
  glyphColor: string;
  onRun: () => void;
  onRunClick?: (runId: string) => void;
}

// Parse a command string into colored parts: flags (--foo), vars ($VAR), strings ("..."), and plain text
function parseCommand(cmd: string): Array<{ kind: 'plain' | 'flag' | 'var' | 'str'; text: string }> {
  const parts: Array<{ kind: 'plain' | 'flag' | 'var' | 'str'; text: string }> = [];
  const re = /("(?:[^"\\]|\\.)*")|(\$[A-Za-z_][A-Za-z0-9_]*)|(--?[a-zA-Z][\w-]*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd)) !== null) {
    if (m.index > last) {
      parts.push({ kind: 'plain', text: cmd.slice(last, m.index) });
    }
    if (m[1]) parts.push({ kind: 'str', text: m[1] });
    else if (m[2]) parts.push({ kind: 'var', text: m[2] });
    else if (m[3]) parts.push({ kind: 'flag', text: m[3] });
    last = m.index + m[0].length;
  }
  if (last < cmd.length) parts.push({ kind: 'plain', text: cmd.slice(last) });
  return parts;
}

function formatDuration(ms?: number): string {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m > 0) return `${m}m ${rem}s`;
  return `${s}s`;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function passRate(runs: Run[]): string {
  if (!runs.length) return '—';
  const passed = runs.filter((r) => r.status === 'completed').length;
  return `${((passed / runs.length) * 100).toFixed(1)}%`;
}

function avgDuration(runs: Run[]): string {
  const finished = runs.filter((r) => r.duration_ms);
  if (!finished.length) return '—';
  const avg = finished.reduce((sum, r) => sum + (r.duration_ms ?? 0), 0) / finished.length;
  return formatDuration(avg);
}

export default function WorkflowDetail({ workflow, runs, glyphColor, onRun, onRunClick }: Props) {
  const navigate = useNavigate();

  const lastRun = runs[0];
  const recentRuns = runs.slice(0, 4);

  // Estimate total time from step timeouts
  const estimatedTotal = workflow.steps.reduce((sum, s) => sum + (s.timeout ?? 30), 0);
  const estMin = Math.floor(estimatedTotal / 60);
  const estSec = estimatedTotal % 60;
  const estStr = estMin > 0 ? `~${estMin}m ${estSec}s total` : `~${estSec}s total`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Page header */}
      <div className="pg-head" style={{ flexShrink: 0, marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Glyph ch={(workflow.name[0] ?? 'W').toUpperCase()} color={glyphColor} />
              <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--dd-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {workflow.name}
              </h1>
              {workflow.tags && workflow.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {workflow.tags.map((t) => <Tag key={t}>{t}</Tag>)}
                </div>
              )}
              {lastRun && (
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--dd-text-3)', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <Icon name="schedule" size={12} />
                  Last run {timeAgo(lastRun.finished_at ?? lastRun.started_at)}
                  {' · '}
                  <span className="mono" style={{ color: lastRun.status === 'completed' ? 'var(--dd-green)' : 'var(--dd-red)' }}>
                    {lastRun.status === 'completed' ? '✓ passed' : '✗ failed'}
                  </span>
                </span>
              )}
            </div>
            {workflow.description && (
              <p className="sub" style={{ fontSize: 12, color: 'var(--dd-text-3)' }}>{workflow.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button className="btn btn-ghost" onClick={() => navigate('/history')}>
              <Icon name="history" size={14} />Logs
            </button>
            <button className="btn btn-secondary" onClick={() => navigate(`/workflow/${workflow.id}/edit`)}>
              <Icon name="edit" size={14} />Edit
            </button>
            <button className="btn btn-primary" onClick={onRun}>
              <Icon name="play_arrow" size={14} />Run
              <span style={{ marginLeft: 6, opacity: 0.6 }}><Kbd>⌘R</Kbd></span>
            </button>
          </div>
        </div>
      </div>

      {/* Body — 2-column */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
        {/* Left column */}
        <div style={{ padding: '20px 22px', overflow: 'auto' }}>
          {/* Steps section */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dd-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Steps
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>
                {workflow.steps.length} · {estStr}
              </span>
            </div>
          </div>

          <div className="card" style={{ padding: 4, marginBottom: 18 }}>
            {workflow.steps.map((step, i) => {
              const parts = parseCommand(step.command);
              return (
                <div key={i} className="step">
                  <span className="step-marker pending" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {i + 1}
                  </span>
                  <div className="step-body" style={{ flex: 1, minWidth: 0 }}>
                    <div className="step-title" style={{ fontSize: 13, color: 'var(--dd-text)', marginBottom: 2 }}>
                      {step.name}
                    </div>
                    <div className="step-cmd" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--dd-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ color: 'var(--dd-text-4)' }}>$ </span>
                      {parts.map((p, j) => {
                        if (p.kind === 'flag') return <span key={j} className="flag" style={{ color: 'var(--dd-amber)' }}>{p.text}</span>;
                        if (p.kind === 'var') return <span key={j} className="var" style={{ color: 'var(--dd-blue)' }}>{p.text}</span>;
                        if (p.kind === 'str') return <span key={j} className="str" style={{ color: 'var(--dd-green)' }}>{p.text}</span>;
                        return <span key={j}>{p.text}</span>;
                      })}
                      {step.workdir && (
                        <span style={{ marginLeft: 10, color: 'var(--dd-text-4)' }}>
                          · cwd <span style={{ color: 'var(--dd-text-3)' }}>{step.workdir}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="step-time" style={{ fontSize: 11, color: 'var(--dd-text-4)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                    {step.timeout ? `${step.timeout}s` : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Parameters section */}
          {workflow.params && workflow.params.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dd-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Parameters
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>
                  {workflow.params.length} input{workflow.params.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="card" style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                {workflow.params.map((p) => (
                  <div key={p.name} style={{ background: 'var(--dd-surface-3)', border: '1px solid var(--dd-line)', borderRadius: 6, padding: '8px 10px' }}>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--dd-text)' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--dd-text-3)', marginTop: 2 }}>
                      <span style={{ color: 'var(--dd-purple)' }}>{p.type}</span>
                      <span style={{ color: 'var(--dd-text-4)' }}> = </span>
                      <span className="mono">{p.default ?? '—'}</span>
                    </div>
                    {p.label && (
                      <div style={{ fontSize: 10, color: 'var(--dd-text-4)', marginTop: 3 }}>{p.label}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Recent runs section */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dd-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent runs
            </span>
            <button
              onClick={() => navigate(`/history?wf=${workflow.id}`)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--dd-blue)', textDecoration: 'none', padding: 0 }}
            >
              View all →
            </button>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {recentRuns.length === 0 ? (
              <div style={{ padding: '16px 14px', fontSize: 12, color: 'var(--dd-text-4)', textAlign: 'center' }}>
                No runs yet
              </div>
            ) : (
              <table className="dd-table">
                <tbody>
                  {recentRuns.map((r, i) => (
                    <tr
                      key={r.id ?? i}
                      style={{ cursor: onRunClick ? 'pointer' : undefined }}
                      onClick={() => onRunClick?.(r.id)}
                      onMouseEnter={(e) => { if (onRunClick) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                    >
                      <td style={{ width: 22, padding: '8px 0 8px 14px' }}>
                        {r.status === 'completed'
                          ? <Icon name="check_circle" size={14} fill style={{ color: 'var(--dd-green)' }} />
                          : <Icon name="cancel" size={14} fill style={{ color: 'var(--dd-red)' }} />}
                      </td>
                      <td className="mono" style={{ color: 'var(--dd-text)', width: 60 }}>
                        #{r.id.slice(-4)}
                      </td>
                      <td style={{ color: 'var(--dd-text-3)' }}>
                        {timeAgo(r.finished_at ?? r.started_at)}
                      </td>
                      <td className="mono" style={{ color: 'var(--dd-text-3)' }}>
                        {formatDuration(r.duration_ms)}
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>
                          {(r.params_used as Record<string, string>)?.branch ?? 'main'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--dd-text-3)' }}>
                        {r.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column — details inspector */}
        <aside style={{ borderLeft: '1px solid var(--dd-line)', background: 'var(--dd-surface-2)', overflow: 'auto', padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dd-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Details
          </div>

          <dl style={{ margin: 0, fontSize: 12, display: 'grid', gridTemplateColumns: '90px 1fr', rowGap: 10, columnGap: 12 }}>
            <dt style={{ color: 'var(--dd-text-4)' }}>ID</dt>
            <dd className="mono" style={{ margin: 0, color: 'var(--dd-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {workflow.id}
            </dd>

            {workflow.file_path && (
              <>
                <dt style={{ color: 'var(--dd-text-4)' }}>File</dt>
                <dd className="mono" style={{ margin: 0, color: 'var(--dd-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>
                  {workflow.file_path}
                </dd>
              </>
            )}

            <dt style={{ color: 'var(--dd-text-4)' }}>Created</dt>
            <dd style={{ margin: 0, color: 'var(--dd-text-2)' }}>
              {formatDate(workflow.created_at)}
            </dd>

            <dt style={{ color: 'var(--dd-text-4)' }}>Source</dt>
            <dd style={{ margin: 0, color: 'var(--dd-text-2)' }}>{workflow.source}</dd>

            <dt style={{ color: 'var(--dd-text-4)' }}>Total runs</dt>
            <dd className="mono" style={{ margin: 0, color: 'var(--dd-text-2)' }}>
              {runs.length.toLocaleString()}
            </dd>

            <dt style={{ color: 'var(--dd-text-4)' }}>Pass rate</dt>
            <dd style={{ margin: 0, color: 'var(--dd-green)' }}>
              {passRate(runs)}
              {runs.length > 0 && <span style={{ color: 'var(--dd-text-4)' }}> (all)</span>}
            </dd>

            <dt style={{ color: 'var(--dd-text-4)' }}>Avg duration</dt>
            <dd className="mono" style={{ margin: 0, color: 'var(--dd-text-2)' }}>
              {avgDuration(runs)}
            </dd>

            <dt style={{ color: 'var(--dd-text-4)' }}>Steps</dt>
            <dd className="mono" style={{ margin: 0, color: 'var(--dd-text-2)' }}>
              {workflow.steps.length}
            </dd>

            <dt style={{ color: 'var(--dd-text-4)' }}>On failure</dt>
            <dd style={{ margin: 0, color: 'var(--dd-text-2)' }}>
              {workflow.steps[0]?.on_failure ?? 'stop'}
            </dd>

          </dl>

          {/* Duration trend sparkline */}
          <div style={{ marginTop: 18, padding: '12px 12px 14px', background: 'var(--dd-surface-3)', borderRadius: 6, border: '1px solid var(--dd-line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11 }}>
              <span style={{ color: 'var(--dd-text-3)' }}>Duration trend</span>
              <span className="mono" style={{ color: 'var(--dd-text-2)' }}>14d</span>
            </div>
            <DurationSparkline runs={runs} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--dd-text-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              <span>14d ago</span><span>7d ago</span><span>today</span>
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
}

// Sparkline chart built from real run duration data
function DurationSparkline({ runs }: { runs: Run[] }) {
  const W = 280;
  const H = 60;

  // Get up to 14 recent finished runs sorted oldest→newest
  const finished = [...runs]
    .filter((r) => r.duration_ms && r.finished_at)
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
    .slice(-14);

  if (finished.length < 2) {
    // Static fallback polyline
    const staticPts = '0,32 20,28 40,30 60,24 80,26 100,22 120,28 140,18 160,24 180,20 200,26 220,16 240,22 260,14 280,18';
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 50 }}>
        <polyline fill="none" stroke="var(--dd-blue)" strokeWidth="1.5" points={staticPts} />
        <polyline fill="rgba(96,165,250,0.08)" stroke="none" points={`0,${H} ${staticPts} ${W},${H}`} />
      </svg>
    );
  }

  const durations = finished.map((r) => r.duration_ms!);
  const minD = Math.min(...durations);
  const maxD = Math.max(...durations);
  const range = maxD - minD || 1;

  const pts = finished.map((r, i) => {
    const x = (i / (finished.length - 1)) * W;
    const y = H - 6 - ((r.duration_ms! - minD) / range) * (H - 12);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const lineStr = pts.join(' ');
  const areaStr = `0,${H} ${lineStr} ${W},${H}`;

  // Dot positions for last 5 points
  const dotIndices = finished.length <= 5
    ? finished.map((_, i) => i)
    : [finished.length - 5, finished.length - 4, finished.length - 3, finished.length - 2, finished.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 50 }}>
      <polyline fill="none" stroke="var(--dd-blue)" strokeWidth="1.5" points={lineStr} />
      <polyline fill="rgba(96,165,250,0.08)" stroke="none" points={areaStr} />
      {dotIndices.map((idx) => {
        const [x, y] = pts[idx].split(',').map(Number);
        return <circle key={idx} cx={x} cy={y} r="2" fill="var(--dd-blue)" />;
      })}
    </svg>
  );
}
