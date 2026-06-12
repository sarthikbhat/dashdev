import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon, Badge, Glyph, Spinner } from '../components';
import { useWorkflows } from '../hooks/useWorkflows';
import { useRuns } from '../hooks/useRuns';
import { getRun } from '../api';
import type { Run, RunStep } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────

const GLYPH_COLORS = [
  'var(--dd-blue)',
  'var(--dd-green)',
  'var(--dd-amber)',
  'var(--dd-purple)',
  'var(--dd-cyan)',
  'var(--dd-red)',
];
function assignColor(index: number) {
  return GLYPH_COLORS[index % GLYPH_COLORS.length];
}

function formatDuration(ms?: number): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}m ${rem}s`;
}

function formatWhen(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getDateGroup(dateStr?: string): string {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  if (d >= startOfToday) return 'Today';
  if (d >= startOfYesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') {
    return <Icon name="check_circle" size={14} fill style={{ color: 'var(--dd-green)' }} />;
  }
  if (status === 'failed' || status === 'timed_out') {
    return <Icon name="cancel" size={14} fill style={{ color: 'var(--dd-red)' }} />;
  }
  if (status === 'running') {
    return <Spinner />;
  }
  if (status === 'cancelled') {
    return <Icon name="do_not_disturb_on" size={14} fill style={{ color: 'var(--dd-text-3)' }} />;
  }
  return null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <Badge kind="success">Passed</Badge>;
  if (status === 'failed' || status === 'timed_out') return <Badge kind="fail">Failed</Badge>;
  if (status === 'running') return <Badge kind="run">Running</Badge>;
  if (status === 'cancelled') return <Badge kind="pending">Cancelled</Badge>;
  return <Badge>{status}</Badge>;
}

function FilterChip({
  color,
  label,
  count,
  active,
  onClick,
}: {
  color: string;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        fontSize: 12,
        fontFamily: 'inherit',
        background: active ? 'var(--dd-surface-3)' : 'transparent',
        border: `1px solid ${active ? 'var(--dd-line-2)' : 'var(--dd-line)'}`,
        borderRadius: 999,
        cursor: 'pointer',
        color: active ? 'var(--dd-text)' : 'var(--dd-text-3)',
        opacity: active ? 1 : 0.7,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 3, background: color }} />
      {label}
      <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>
        {count}
      </span>
    </button>
  );
}

function stepStatusIcon(status: string) {
  if (status === 'completed') return 'check';
  if (status === 'failed' || status === 'timed_out') return 'close';
  if (status === 'skipped') return 'remove';
  if (status === 'cancelled') return 'do_not_disturb_on';
  return 'more_horiz';
}

function stepStatusState(status: string) {
  if (status === 'completed') return 'done';
  if (status === 'failed' || status === 'timed_out' || status === 'cancelled') return 'fail';
  if (status === 'skipped') return 'pending';
  return 'pending';
}

function fmtStepDuration(ms?: number): string {
  if (!ms) return '--';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ExpandedRow({ run }: { run: Run }) {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getRun(run.id)
      .then((data) => {
        if (!cancelled) setSteps(data.steps);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoadingSteps(false); });
    return () => { cancelled = true; };
  }, [run.id]);

  const passedCount = steps.filter((s) => s.status === 'completed').length;
  const failedCount = steps.filter((s) => s.status === 'failed' || s.status === 'timed_out').length;

  return (
    <tr>
      <td
        colSpan={8}
        style={{
          padding: 0,
          background: 'var(--dd-surface-2)',
          borderBottom: '1px solid var(--dd-line)',
        }}
      >
        <div
          style={{
            padding: '14px 14px 14px 56px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
          }}
        >
          {/* Steps recap */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--dd-text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}
            >
              Steps · {passedCount} passed{failedCount > 0 ? `, ${failedCount} failed` : ''}
            </div>
            {loadingSteps ? (
              <div style={{ fontSize: 12, color: 'var(--dd-text-4)', padding: '8px 0' }}>
                Loading steps...
              </div>
            ) : steps.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--dd-text-4)', padding: '8px 0' }}>
                No step data available
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {steps.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    <span className={`step-marker ${stepStatusState(s.status)}`} style={{ width: 14, height: 14 }}>
                      <Icon name={stepStatusIcon(s.status)} size={9} />
                    </span>
                    <span style={{ color: 'var(--dd-text)' }}>{s.name}</span>
                    <span style={{ flex: 1 }} />
                    <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>
                      {fmtStepDuration(s.duration_ms)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--dd-text-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Run details
              </span>
              <span style={{ flex: 1 }} />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate(`/workflow/${run.workflow_id}`)}
              >
                <Icon name="open_in_new" size={11} />
                View workflow
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--dd-text-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <span style={{ color: 'var(--dd-text-4)' }}>Run ID: </span>
                <span className="mono">{run.id.slice(0, 12)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--dd-text-4)' }}>Duration: </span>
                <span className="mono">{formatDuration(run.duration_ms)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--dd-text-4)' }}>Started: </span>
                <span>{run.started_at ? new Date(run.started_at).toLocaleString() : '--'}</span>
              </div>
              {run.finished_at && (
                <div>
                  <span style={{ color: 'var(--dd-text-4)' }}>Finished: </span>
                  <span>{new Date(run.finished_at).toLocaleString()}</span>
                </div>
              )}
              {Object.keys(run.params_used ?? {}).length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: 'var(--dd-text-4)', display: 'block', marginBottom: 4 }}>Params:</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(run.params_used).map(([k, v]) => (
                      <span key={k} className="mono" style={{ fontSize: 11, padding: '2px 6px', background: 'var(--dd-surface-3)', border: '1px solid var(--dd-line)', borderRadius: 3 }}>
                        {k}={v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── RunHistory (main) ──────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const DATE_RANGES = [
  { label: 'All time', days: 0 },
  { label: 'Last 24h', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
];

function DropdownMenu({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={onClose} />
      <div style={{
        position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100,
        background: 'var(--dd-surface-2)', border: '1px solid var(--dd-line-2)',
        borderRadius: 10, padding: '4px 0', minWidth: 180,
        boxShadow: 'var(--dd-shadow-lg)',
      }}>
        {children}
      </div>
    </>
  );
}

function DropdownItem({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '8px 14px', border: 'none', background: 'transparent',
        color: selected ? 'var(--dd-accent-bright)' : 'var(--dd-text-2)',
        fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
        transition: 'background 100ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ width: 14, textAlign: 'center' }}>
        {selected ? '✓' : ''}
      </span>
      {children}
    </button>
  );
}

export default function RunHistory() {
  const [searchParams] = useSearchParams();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(['completed', 'failed', 'running'])
  );
  const [wfFilter, setWfFilter] = useState<string | null>(searchParams.get('wf'));
  const [dateRange, setDateRange] = useState(30);
  const [wfDropOpen, setWfDropOpen] = useState(false);
  const [dateDropOpen, setDateDropOpen] = useState(false);

  const { workflows } = useWorkflows();
  const { runs, loading } = useRuns();

  // Counts for filter chips
  const counts = {
    completed: runs.filter((r) => r.status === 'completed').length,
    failed: runs.filter((r) => r.status === 'failed' || r.status === 'timed_out').length,
    running: runs.filter((r) => r.status === 'running').length,
    cancelled: runs.filter((r) => r.status === 'cancelled').length,
  };

  const dateRangeLabel = DATE_RANGES.find((d) => d.days === dateRange)?.label ?? 'All time';
  const wfFilterName = wfFilter ? workflows.find((w) => w.id === wfFilter)?.name ?? 'Unknown' : 'All workflows';

  // Filter runs
  const filtered = runs.filter((r) => {
    const matchesSearch =
      !search ||
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.workflow_name.toLowerCase().includes(search.toLowerCase());

    const statusKey =
      r.status === 'failed' || r.status === 'timed_out' ? 'failed' : r.status;
    const matchesFilter = activeFilters.size === 0 || activeFilters.has(statusKey);

    const matchesWf = !wfFilter || r.workflow_id === wfFilter;

    let matchesDate = true;
    if (dateRange > 0 && r.started_at) {
      const cutoff = Date.now() - dateRange * 86400000;
      matchesDate = new Date(r.started_at).getTime() >= cutoff;
    }

    return matchesSearch && matchesFilter && matchesWf && matchesDate;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const passRate =
    runs.length > 0
      ? ((counts.completed / runs.length) * 100).toFixed(1)
      : '—';

  function toggleFilter(key: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPage(1);
  }

  // Build workflow glyph map
  const wfGlyphMap = new Map(
    workflows.map((wf, i) => [
      wf.id,
      { ch: (wf.name[0] ?? 'W').toUpperCase(), color: assignColor(i) },
    ])
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--dd-bg)' }}>
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Page header */}
          <div className="pg-head" style={{ flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <h1>
                  <Icon name="history" size={18} style={{ color: 'var(--dd-text-3)' }} />
                  Run history
                </h1>
                <p className="sub">
                  All workflow runs · stored in{' '}
                  <span className="mono">~/.devdash/history.sqlite</span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost">
                  <Icon name="download" size={14} />
                  Export
                </button>
                <button className="btn btn-secondary">
                  <Icon name="delete_sweep" size={14} />
                  Clear older than 30d
                </button>
              </div>
            </div>

            {/* Filter bar */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                marginTop: 14,
                flexWrap: 'wrap',
                minWidth: 0,
              }}
            >
              <div style={{ position: 'relative', flex: '0 0 200px', minWidth: 0 }}>
                <Icon
                  name="search"
                  size={12}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--dd-text-4)', pointerEvents: 'none' }}
                />
                <input
                  className="input"
                  style={{ paddingLeft: 28, paddingTop: 5, paddingBottom: 5, fontSize: 12, height: 30, borderRadius: 'var(--dd-radius-xs)' }}
                  placeholder="Search by id, workflow…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              {/* Workflow dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 12 }}
                  onClick={() => { setWfDropOpen(!wfDropOpen); setDateDropOpen(false); }}
                >
                  <Icon name="filter_alt" size={12} style={{ color: 'var(--dd-text-3)' }} />
                  {wfFilterName}
                  <Icon name="expand_more" size={12} style={{ color: 'var(--dd-text-4)' }} />
                </button>
                <DropdownMenu open={wfDropOpen} onClose={() => setWfDropOpen(false)}>
                  <DropdownItem selected={!wfFilter} onClick={() => { setWfFilter(null); setWfDropOpen(false); setPage(1); }}>
                    All workflows
                  </DropdownItem>
                  {workflows.map((wf) => (
                    <DropdownItem key={wf.id} selected={wfFilter === wf.id} onClick={() => { setWfFilter(wf.id); setWfDropOpen(false); setPage(1); }}>
                      {wf.name}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </div>

              {/* Date range dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 12 }}
                  onClick={() => { setDateDropOpen(!dateDropOpen); setWfDropOpen(false); }}
                >
                  {dateRangeLabel}
                  <Icon name="expand_more" size={12} style={{ color: 'var(--dd-text-4)' }} />
                </button>
                <DropdownMenu open={dateDropOpen} onClose={() => setDateDropOpen(false)}>
                  {DATE_RANGES.map((dr) => (
                    <DropdownItem key={dr.days} selected={dateRange === dr.days} onClick={() => { setDateRange(dr.days); setDateDropOpen(false); setPage(1); }}>
                      {dr.label}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </div>

              <FilterChip
                color="var(--dd-green)"
                label="Pass"
                count={counts.completed}
                active={activeFilters.has('completed')}
                onClick={() => toggleFilter('completed')}
              />
              <FilterChip
                color="var(--dd-red)"
                label="Fail"
                count={counts.failed}
                active={activeFilters.has('failed')}
                onClick={() => toggleFilter('failed')}
              />
              <FilterChip
                color="var(--dd-amber)"
                label="Running"
                count={counts.running}
                active={activeFilters.has('running')}
                onClick={() => toggleFilter('running')}
              />
              <FilterChip
                color="var(--dd-text-3)"
                label="Cancelled"
                count={counts.cancelled}
                active={activeFilters.has('cancelled')}
                onClick={() => toggleFilter('cancelled')}
              />

              <span style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>
                {runs.length} runs · {passRate}% pass
              </span>
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--dd-text-4)',
                  fontSize: 13,
                  gap: 8,
                }}
              >
                <Spinner />
                Loading run history…
              </div>
            ) : (
              <table className="dd-table" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }} />
                    <th style={{ width: 72 }}>ID</th>
                    <th>Workflow</th>
                    <th style={{ width: 90 }}>Status</th>
                    <th style={{ width: 90 }}>Duration</th>
                    <th style={{ width: 80 }}>Trigger</th>
                    <th style={{ width: 100 }}>When</th>
                    <th style={{ width: 36 }} />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          textAlign: 'center',
                          color: 'var(--dd-text-4)',
                          padding: '40px 14px',
                          fontSize: 13,
                        }}
                      >
                        {runs.length === 0
                          ? 'No runs yet. Trigger a workflow to see history here.'
                          : 'No runs match the current filters.'}
                      </td>
                    </tr>
                  )}
                  {pageRows.map((run, i) => {
                    const prevRun = i > 0 ? pageRows[i - 1] : null;
                    const dateGroup = getDateGroup(run.started_at);
                    const prevDateGroup = prevRun ? getDateGroup(prevRun.started_at) : null;
                    const isExpanded = expandedId === run.id;
                    const glyph = wfGlyphMap.get(run.workflow_id) ?? {
                      ch: (run.workflow_name[0] ?? 'W').toUpperCase(),
                      color: 'var(--dd-blue)',
                    };

                    return (
                      <>
                        {dateGroup !== prevDateGroup && (
                          <tr key={`group-${run.id}`}>
                            <td
                              colSpan={8}
                              style={{
                                padding: '12px 14px 6px',
                                background: 'var(--dd-bg)',
                                fontSize: 10,
                                fontWeight: 600,
                                color: 'var(--dd-text-4)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                borderBottom: '1px solid var(--dd-line)',
                              }}
                            >
                              {dateGroup}
                            </td>
                          </tr>
                        )}
                        <tr
                          key={run.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() =>
                            setExpandedId(isExpanded ? null : run.id)
                          }
                        >
                          <td>
                            <StatusIcon status={run.status} />
                          </td>
                          <td className="mono" style={{ color: 'var(--dd-text)' }}>
                            #{run.id.slice(0, 6)}
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <Glyph ch={glyph.ch} color={glyph.color} />
                              <span style={{ color: 'var(--dd-text)' }}>
                                {run.workflow_name}
                              </span>
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={run.status} />
                          </td>
                          <td className="mono">{formatDuration(run.duration_ms)}</td>
                          <td style={{ color: 'var(--dd-text-3)', fontSize: 12 }}>
                            {run.params_used?.triggered_by ?? 'manual'}
                          </td>
                          <td
                            className="mono"
                            style={{ fontSize: 11, color: 'var(--dd-text-3)' }}
                          >
                            {formatWhen(run.started_at)}
                          </td>
                          <td>
                            <Icon
                              name={isExpanded ? 'expand_less' : 'chevron_right'}
                              size={14}
                              style={{ color: 'var(--dd-text-4)' }}
                            />
                          </td>
                        </tr>
                        {isExpanded && <ExpandedRow key={`exp-${run.id}`} run={run} />}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div
            style={{
              borderTop: '1px solid var(--dd-line)',
              padding: '8px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              color: 'var(--dd-text-3)',
              fontFamily: 'var(--font-mono)',
              flexShrink: 0,
            }}
          >
            <span>
              Showing {filtered.length === 0 ? 0 : pageStart + 1}–
              {Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <span style={{ flex: 1 }} />
            <button
              className="btn btn-ghost btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Icon name="chevron_left" size={12} />
              Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <Icon name="chevron_right" size={12} />
            </button>
          </div>
        </main>
    </div>
  );
}
