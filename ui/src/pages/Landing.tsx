import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import { listServices, getServicesStatus, listWorkflows, listRuns, redisInfo, health } from '../api';
import type { Run } from '../types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'var(--dd-green)',
  failed: 'var(--dd-red)',
  cancelled: 'var(--dd-text-4)',
  running: 'var(--dd-amber)',
};

const STATUS_ICONS: Record<string, string> = {
  completed: 'check_circle',
  failed: 'cancel',
  cancelled: 'block',
  running: 'pending',
};

export default function Landing() {
  const navigate = useNavigate();
  const [serviceCount, setServiceCount] = useState<number | null>(null);
  const [runningCount, setRunningCount] = useState<number | null>(null);
  const [workflowCount, setWorkflowCount] = useState<number | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [redisKeyCount, setRedisKeyCount] = useState<number | null>(null);
  const [uptime, setUptime] = useState<number | null>(null);

  useEffect(() => {
    listServices().then((s) => setServiceCount(s.length)).catch(() => setServiceCount(0));
    getServicesStatus().then((s) => setRunningCount(s.filter((x) => x.status === 'healthy').length)).catch(() => setRunningCount(0));
    listWorkflows().then((w) => setWorkflowCount(w.length)).catch(() => setWorkflowCount(0));
    listRuns().then((r) => setRuns(r)).catch(() => setRuns([]));
    redisInfo().then((i) => setRedisKeyCount(i.total_keys)).catch(() => setRedisKeyCount(null));
    health().then((h) => setUptime(h.uptime)).catch(() => setUptime(null));
  }, []);

  const completed = runs.filter((r) => r.status === 'completed').length;
  const failed = runs.filter((r) => r.status === 'failed').length;
  const successRate = runs.length > 0 ? Math.round((completed / runs.length) * 100) : null;
  const recentRuns = runs.slice(0, 7);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        padding: '16px 28px',
        display: 'flex', alignItems: 'center', gap: 14,
        borderBottom: '1px solid var(--dd-line)',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: 'var(--dd-text)' }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 12, color: 'var(--dd-text-3)', marginTop: 2 }}>
            {uptime !== null ? `Server up ${formatUptime(uptime)}` : 'Local development dashboard'}
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/history')}>
          <Icon name="history" size={15} />
          History
        </button>
      </div>

      <div style={{ padding: '20px 28px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {/* Metrics row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 12,
          marginBottom: 20,
          flexShrink: 0,
        }}>
          <MetricCard
            icon="dns"
            label="Services"
            value={serviceCount !== null ? String(serviceCount) : '-'}
            sub={runningCount !== null && runningCount > 0 ? `${runningCount} healthy` : undefined}
            subColor="var(--dd-green)"
            accent="#8b5cf6"
          />
          <MetricCard
            icon="account_tree"
            label="Workflows"
            value={workflowCount !== null ? String(workflowCount) : '-'}
            accent="#c084fc"
          />
          <MetricCard
            icon="play_circle"
            label="Total Runs"
            value={String(runs.length)}
            sub={failed > 0 ? `${failed} failed` : completed > 0 ? `${completed} passed` : undefined}
            subColor={failed > 0 ? 'var(--dd-red)' : 'var(--dd-green)'}
            accent="#34d399"
          />
          <MetricCard
            icon="verified"
            label="Success Rate"
            value={successRate !== null ? `${successRate}%` : '-'}
            accent={successRate !== null && successRate >= 80 ? '#34d399' : '#fbbf24'}
            ring={successRate}
          />
          <MetricCard
            icon="storage"
            label="Redis Keys"
            value={redisKeyCount !== null ? redisKeyCount.toLocaleString() : '-'}
            accent="#f472b6"
          />
        </div>

        {/* Two-column content */}
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          {/* Left: Recent activity */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div className="section-header" style={{ flexShrink: 0, marginBottom: 8 }}>
              <Icon name="timeline" size={16} style={{ color: 'var(--dd-accent)' }} />
              Recent Activity
              <div style={{ flex: 1 }} />
              {runs.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')} style={{ fontSize: 11 }}>
                  View all <Icon name="chevron_right" size={14} />
                </button>
              )}
            </div>
            {recentRuns.length === 0 ? (
              <div className="card" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flex: 1, gap: 12, color: 'var(--dd-text-4)',
              }}>
                <Icon name="history" size={32} style={{ opacity: 0.3 }} />
                <span style={{ fontSize: 13 }}>No runs yet</span>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'auto', flex: 1 }}>
                {recentRuns.map((run, i) => (
                  <div
                    key={run.id}
                    className="activity-row"
                    onClick={() => navigate(`/workflow/${run.workflow_id}`)}
                    style={{ borderBottom: i < recentRuns.length - 1 ? '1px solid var(--dd-line)' : 'none' }}
                  >
                    <Icon
                      name={STATUS_ICONS[run.status] ?? 'circle'}
                      size={17}
                      style={{ color: STATUS_COLORS[run.status] ?? 'var(--dd-text-4)', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500, color: 'var(--dd-text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {run.workflow_name}
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--dd-text-4)', marginTop: 1 }}>
                        {run.id.slice(0, 8)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>
                        {formatDuration(run.duration_ms)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--dd-text-4)', marginTop: 1 }}>
                        {timeAgo(run.started_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Distribution + Most Active */}
          <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ padding: 14, flexShrink: 0 }}>
              <div className="section-header" style={{ marginBottom: 10 }}>
                <Icon name="donut_small" size={16} style={{ color: 'var(--dd-accent)' }} />
                Run Distribution
              </div>
              {runs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--dd-text-4)', textAlign: 'center', padding: '12px 0' }}>
                  No data yet
                </div>
              ) : (
                <>
                  <DonutChart completed={completed} failed={failed} other={runs.length - completed - failed} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                    <LegendRow color="var(--dd-green)" label="Completed" count={completed} total={runs.length} />
                    <LegendRow color="var(--dd-red)" label="Failed" count={failed} total={runs.length} />
                    {runs.length - completed - failed > 0 && (
                      <LegendRow color="var(--dd-text-4)" label="Other" count={runs.length - completed - failed} total={runs.length} />
                    )}
                  </div>
                </>
              )}
            </div>

            {runs.length > 0 && (
              <div className="card" style={{ padding: 14, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="section-header" style={{ marginBottom: 10, flexShrink: 0 }}>
                  <Icon name="trending_up" size={16} style={{ color: 'var(--dd-accent)' }} />
                  Most Active
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflow: 'auto', flex: 1 }}>
                  {topWorkflows(runs).map(({ name, id, count }) => (
                    <div
                      key={name}
                      onClick={() => navigate(`/workflow/${id}`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '5px 8px', borderRadius: 8, cursor: 'pointer',
                        transition: 'background 120ms ease', flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: 'var(--dd-accent-dim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: 'var(--dd-accent-bright)',
                        flexShrink: 0,
                      }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{
                        flex: 1, fontSize: 12, color: 'var(--dd-text-2)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {name}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function topWorkflows(runs: Run[]): { name: string; id: string; count: number }[] {
  const counts = new Map<string, { name: string; id: string; count: number }>();
  for (const r of runs) {
    const existing = counts.get(r.workflow_name);
    if (existing) existing.count++;
    else counts.set(r.workflow_name, { name: r.workflow_name, id: r.workflow_id, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
}

// ── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  accent: string;
  ring?: number | null;
}

function MetricCard({ icon, label, value, sub, subColor, accent, ring }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="metric-glow" style={{ background: accent }} />
      <div className="metric-label">
        <Icon name={icon} size={14} style={{ color: accent }} />
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="metric-value">{value}</div>
          {sub && <div className="metric-sub" style={{ color: subColor ?? 'var(--dd-text-4)' }}>{sub}</div>}
        </div>
        {ring != null && (
          <MiniRing percent={ring} color={accent} />
        )}
      </div>
    </div>
  );
}

// ── Mini Ring (for metric card) ─────────────────────────────────────────────

function MiniRing({ percent, color }: { percent: number; color: string }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={36} height={36} viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
      <circle cx={18} cy={18} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={3.5} />
      <circle
        cx={18} cy={18} r={r} fill="none"
        stroke={color} strokeWidth={3.5}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 18 18)"
        className="donut-ring"
      />
    </svg>
  );
}

// ── Donut Chart ─────────────────────────────────────────────────────────────

function DonutChart({ completed, failed, other }: { completed: number; failed: number; other: number }) {
  const total = completed + failed + other;
  if (total === 0) return null;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const segments = [
    { value: completed, color: 'var(--dd-green)' },
    { value: failed, color: 'var(--dd-red)' },
    { value: other, color: 'rgba(255,255,255,0.1)' },
  ].filter((s) => s.value > 0);

  let offset = 0;
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={105} height={105} viewBox="0 0 105 105">
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circ;
          const el = (
            <circle
              key={i}
              cx={52.5} cy={52.5} r={r} fill="none"
              stroke={seg.color} strokeWidth={9}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 52.5 52.5)"
            />
          );
          offset += dash;
          return el;
        })}
        <text x={52.5} y={50} textAnchor="middle" fill="var(--dd-text)" fontSize={20} fontWeight={700} fontFamily="var(--font-mono)">
          {total}
        </text>
        <text x={52.5} y={66} textAnchor="middle" fill="var(--dd-text-3)" fontSize={10}>
          total runs
        </text>
      </svg>
    </div>
  );
}

// ── Legend Row ───────────────────────────────────────────────────────────────

function LegendRow({ color, label, count, total }: { color: string; label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: 'var(--dd-text-3)', flex: 1 }}>{label}</span>
      <span className="mono" style={{ color: 'var(--dd-text)', fontWeight: 600 }}>{count}</span>
      <span className="mono" style={{ color: 'var(--dd-text-4)', fontSize: 11, width: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}
