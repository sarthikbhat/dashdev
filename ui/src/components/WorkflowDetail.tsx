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


export default function WorkflowDetail({ workflow, runs, glyphColor, onRun }: Props) {
  const navigate = useNavigate();

  const recentRuns = runs.slice(0, 3);

  // Estimate total time from step timeouts
  const estimatedTotal = workflow.steps.reduce((sum, s) => sum + (s.timeout ?? 30), 0);
  const estMin = Math.floor(estimatedTotal / 60);
  const estSec = estimatedTotal % 60;
  const estStr = estMin > 0 ? `~${estMin}m ${estSec}s total` : `~${estSec}s total`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Page header */}
      <div className="pg-head" style={{ flexShrink: 0 }}>
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
            </div>
            {workflow.description && (
              <p className="sub" style={{ fontSize: 12, color: 'var(--dd-text-3)' }}>{workflow.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
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

      {/* Body — single column */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 22px' }}>
        {/* Steps section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dd-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Steps
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>
            {workflow.steps.length} · {estStr}
          </span>
        </div>

        <div className="card" style={{ padding: 4, marginBottom: 24 }}>
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

        {/* Parameters — inline, compact */}
        {workflow.params && workflow.params.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {workflow.params.map((p) => (
                <span
                  key={p.name}
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--dd-text-2)',
                    background: 'var(--dd-surface-3)',
                    border: '1px solid var(--dd-line)',
                    borderRadius: 4,
                    padding: '4px 8px',
                  }}
                >
                  <span style={{ color: 'var(--dd-purple)' }}>{p.type}</span>{' '}
                  {p.name}
                  {p.default !== undefined && (
                    <span style={{ color: 'var(--dd-text-4)' }}> = {p.default}</span>
                  )}
                  {p.required && (
                    <span style={{ color: 'var(--dd-amber)', marginLeft: 4 }}>*</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent runs — compact list */}
        {recentRuns.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dd-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Recent runs
              </span>
              <button
                onClick={() => navigate('/history')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--dd-blue)', textDecoration: 'none', padding: 0 }}
              >
                View all
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentRuns.map((r, i) => (
                <div
                  key={r.id ?? i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 12,
                    color: 'var(--dd-text-3)',
                  }}
                >
                  {r.status === 'completed'
                    ? <Icon name="check_circle" size={14} fill style={{ color: 'var(--dd-green)' }} />
                    : <Icon name="cancel" size={14} fill style={{ color: 'var(--dd-red)' }} />}
                  <span>{timeAgo(r.finished_at ?? r.started_at)}</span>
                  <span className="mono" style={{ color: 'var(--dd-text-4)' }}>
                    {formatDuration(r.duration_ms)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
