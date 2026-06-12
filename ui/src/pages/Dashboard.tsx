import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WorkflowDetail from '../components/WorkflowDetail';
import ParamModal from '../components/ParamModal';
import RunView from '../components/RunView';
import { useWorkflows } from '../hooks/useWorkflows';
import { useRuns } from '../hooks/useRuns';
import Icon from '../components/Icon';
import Glyph from '../components/Glyph';
import { DialogModal } from '../components/DialogModal';
import { Toasts, useToasts } from '../components/Toast';
import { triggerRun, deleteWorkflow } from '../api';
import type { WorkflowParam, Run } from '../types';

const GLYPH_COLORS = [
  '#8b5cf6',
  '#4ade80',
  '#fbbf24',
  '#c084fc',
  '#67e8f9',
  '#f87171',
  '#fb923c',
  '#f472b6',
];

function assignColor(index: number): string {
  return GLYPH_COLORS[index % GLYPH_COLORS.length];
}

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

export default function Dashboard() {
  const navigate = useNavigate();
  const { id: workflowId } = useParams<{ id: string }>();
  const { workflows, loading: wfLoading, refresh: refreshWorkflows } = useWorkflows();
  const { runs, refresh: refreshRuns } = useRuns(workflowId);
  const { runs: allRuns } = useRuns();
  const [showParamModal, setShowParamModal] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [listRunTarget, setListRunTarget] = useState<string | null>(null);
  const { toasts, addToast, dismissToast } = useToasts();

  const selectedWorkflow = workflowId ? workflows.find((w) => w.id === workflowId) ?? null : null;

  const runsByWorkflow = useMemo(() => {
    const map = new Map<string, Run[]>();
    for (const r of allRuns) {
      const arr = map.get(r.workflow_id) ?? [];
      arr.push(r);
      map.set(r.workflow_id, arr);
    }
    return map;
  }, [allRuns]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const wf of workflows) {
      for (const t of wf.tags ?? []) set.add(t);
    }
    return [...set].sort();
  }, [workflows]);

  async function launchRun(wfId: string, wfName?: string, params?: Record<string, string>) {
    try {
      const result = await triggerRun(wfId, params);
      addToast(`Started run for "${wfName ?? wfId}"`, 'success');
      // Navigate to the workflow page and set run ID so run view renders
      if (!workflowId || workflowId !== wfId) {
        navigate(`/workflow/${wfId}`);
      }
      setActiveRunId(result.run_id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addToast(`Failed to start run: ${msg}`, 'error');
    }
  }

  function getConditionParams(wf: { steps: { branch_condition?: string }[]; params?: { name: string }[] } | null): WorkflowParam[] {
    if (!wf) return [];
    const varValues = new Map<string, Set<string>>();
    for (const step of wf.steps) {
      if (!step.branch_condition) continue;
      // Match both "${VAR} == value" and "VAR == value" formats
      const wrappedMatch = step.branch_condition.match(/\$\{(\w+)\}\s*={1,2}\s*(.+)$/);
      const bareMatch = step.branch_condition.match(/^(\w+)\s*={1,2}\s*(.+)$/);
      const match = wrappedMatch ?? bareMatch;
      if (!match) continue;
      const varName = match[1];
      const varVal = match[2].trim();
      if (!varValues.has(varName)) varValues.set(varName, new Set());
      if (varVal) varValues.get(varName)!.add(varVal);
    }
    const existingNames = new Set((wf.params ?? []).map((p) => p.name));
    const result: WorkflowParam[] = [];
    for (const [name, values] of varValues) {
      if (existingNames.has(name)) continue;
      const vals = [...values];
      const allBool = vals.length > 0 && vals.every((v) => v === 'true' || v === 'false');
      if (allBool) {
        result.push({ name, label: name, type: 'toggle', required: true });
      } else if (vals.length >= 2) {
        result.push({ name, label: name, type: 'select', required: true, options: vals });
      } else {
        result.push({ name, label: name, type: 'text', required: true });
      }
    }
    return result;
  }

  function handleRun() {
    if (!selectedWorkflow) return;
    const hasParams = selectedWorkflow.params && selectedWorkflow.params.length > 0;
    const condParams = getConditionParams(selectedWorkflow);
    if (hasParams || condParams.length > 0) {
      setShowParamModal(true);
    } else {
      launchRun(selectedWorkflow.id, selectedWorkflow.name);
    }
  }

  function handleParamRun(values: Record<string, string>) {
    if (!selectedWorkflow) return;
    setShowParamModal(false);
    launchRun(selectedWorkflow.id, selectedWorkflow.name, values);
  }

  function handleRunBack() {
    setActiveRunId(null);
    refreshRuns();
  }

  if (selectedWorkflow && !activeRunId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--dd-bg)' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <WorkflowDetail
            workflow={selectedWorkflow}
            runs={runs}
            glyphColor={assignColor(workflows.indexOf(selectedWorkflow))}
            onRun={handleRun}
            onRunClick={(runId) => setActiveRunId(runId)}
          />
        </div>
        {showParamModal && (
          <ParamModal
            workflow={{
              name: selectedWorkflow.name,
              icon: {
                ch: (selectedWorkflow.name[0] ?? 'W').toUpperCase(),
                color: assignColor(workflows.indexOf(selectedWorkflow)),
              },
              params: [
                ...(selectedWorkflow.params ?? []),
                ...getConditionParams(selectedWorkflow),
              ],
            }}
            onRun={handleParamRun}
            onCancel={() => setShowParamModal(false)}
          />
        )}
        <Toasts toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  if (activeRunId && selectedWorkflow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--dd-bg)' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <RunView
            runId={activeRunId}
            workflowName={selectedWorkflow.name}
            workflowIcon={{
              ch: (selectedWorkflow.name[0] ?? 'W').toUpperCase(),
              color: assignColor(workflows.indexOf(selectedWorkflow)),
            }}
            onCancel={() => { setActiveRunId(null); refreshRuns(); }}
            onBack={handleRunBack}
          />
        </div>
      </div>
    );
  }

  const filtered = workflows.filter((w) => {
    if (activeTag && !(w.tags ?? []).includes(activeTag)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return w.name.toLowerCase().includes(q) ||
        (w.description ?? '').toLowerCase().includes(q) ||
        (w.tags ?? []).some((t) => t.toLowerCase().includes(q));
    }
    return true;
  });

  const totalRuns = allRuns.length;
  const passedRuns = allRuns.filter((r) => r.status === 'completed').length;
  const failedRuns = allRuns.filter((r) => r.status === 'failed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--dd-bg)' }}>
      {/* Page header */}
      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--dd-line)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: 'var(--dd-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="play_circle" size={20} style={{ color: 'var(--dd-accent)' }} />
              Workflows
            </h1>
            <p style={{ fontSize: 12, color: 'var(--dd-text-3)', marginTop: 2 }}>
              {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
              {workflows.length > 0 && totalRuns > 0 && <> · {totalRuns} runs · {passedRuns} passed</>}
              {workflows.length > 0 && failedRuns > 0 && <> · <span style={{ color: 'var(--dd-red)' }}>{failedRuns} failed</span></>}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/workflow/new/edit')}>
            <Icon name="add" size={15} />
            New Workflow
          </button>
        </div>

        {/* Search + tag filters */}
        {workflows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', flex: '0 0 240px' }}>
                <Icon name="search" size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--dd-text-4)', pointerEvents: 'none' }} />
                <input
                  className="input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search workflows..."
                  style={{ paddingLeft: 28, paddingTop: 5, paddingBottom: 5, fontSize: 12, height: 30, borderRadius: 'var(--dd-radius-xs)' }}
                />
              </div>
              <span style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>
                {filtered.length} shown
              </span>
            </div>

            {/* Tag chips */}
            {allTags.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Icon name="label" size={13} style={{ color: 'var(--dd-text-4)' }} />
                <button
                  onClick={() => setActiveTag(null)}
                  style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                    border: '1px solid var(--dd-line)',
                    background: activeTag === null ? 'var(--dd-accent-dim)' : 'transparent',
                    color: activeTag === null ? 'var(--dd-accent-bright)' : 'var(--dd-text-3)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 120ms ease',
                  }}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                      border: `1px solid ${activeTag === tag ? 'var(--dd-accent)' : 'var(--dd-line)'}`,
                      background: activeTag === tag ? 'var(--dd-accent-dim)' : 'transparent',
                      color: activeTag === tag ? 'var(--dd-accent-bright)' : 'var(--dd-text-3)',
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 120ms ease',
                    }}
                  >
                    # {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <main style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
        {wfLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--dd-text-4)', fontSize: 13 }}>
            Loading workflows...
          </div>
        ) : workflows.length === 0 ? (
          <EmptyWorkflows onCreateVisual={() => navigate('/workflow/new/edit')} />
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <Icon name="search_off" size={32} style={{ color: 'var(--dd-text-4)' }} />
            <div style={{ fontSize: 13, color: 'var(--dd-text-3)' }}>
              No workflows match {activeTag ? `tag "#${activeTag}"` : `"${searchQuery}"`}
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => { setSearchQuery(''); setActiveTag(null); }}
              style={{ fontSize: 12 }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 12,
          }}>
            {filtered.map((wf, i) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                color={assignColor(i)}
                lastRun={runsByWorkflow.get(wf.id)?.[0] ?? null}
                runCount={runsByWorkflow.get(wf.id)?.length ?? 0}
                onOpen={() => navigate(`/workflow/${wf.id}`)}
                onEdit={() => navigate(`/workflow/${wf.id}/edit`)}
                onRun={() => {
                  const hasParams = wf.params && wf.params.length > 0;
                  const hasCondVars = getConditionParams(wf).length > 0;
                  if (hasParams || hasCondVars) {
                    setListRunTarget(wf.id);
                  } else {
                    launchRun(wf.id, wf.name);
                  }
                }}
                onDelete={() => setDeleteTarget({ id: wf.id, name: wf.name })}
                activeTag={activeTag}
                onTagClick={(tag) => setActiveTag(activeTag === tag ? null : tag)}
              />
            ))}
          </div>
        )}
      </main>

      {deleteTarget && (
        <DialogModal
          mode="confirm"
          title={`Delete "${deleteTarget.name}"?`}
          description="This workflow and its configuration will be permanently removed."
          confirmLabel="Delete"
          danger
          onConfirm={async () => {
            const name = deleteTarget.name;
            setDeleteTarget(null);
            try {
              await deleteWorkflow(deleteTarget.id);
              addToast(`"${name}" deleted`, 'success');
              refreshWorkflows();
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Unknown error';
              addToast(`Failed to delete "${name}": ${msg}`, 'error');
            }
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {listRunTarget && (() => {
        const wf = workflows.find((w) => w.id === listRunTarget);
        if (!wf) return null;
        return (
          <ParamModal
            workflow={{
              name: wf.name,
              icon: {
                ch: (wf.name[0] ?? 'W').toUpperCase(),
                color: assignColor(workflows.indexOf(wf)),
              },
              params: [
                ...(wf.params ?? []),
                ...getConditionParams(wf),
              ],
            }}
            onRun={(values) => {
              setListRunTarget(null);
              launchRun(wf.id, wf.name, values);
            }}
            onCancel={() => setListRunTarget(null)}
          />
        );
      })()}

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

// ── Workflow Card ─────────────────────────────────────────────────────────

const LAST_RUN_STATUS: Record<string, { icon: string; color: string; label: string }> = {
  completed: { icon: 'check_circle', color: 'var(--dd-green)', label: 'Passed' },
  failed: { icon: 'cancel', color: 'var(--dd-red)', label: 'Failed' },
  running: { icon: 'pending', color: 'var(--dd-amber)', label: 'Running' },
  cancelled: { icon: 'block', color: 'var(--dd-text-4)', label: 'Cancelled' },
  timed_out: { icon: 'cancel', color: 'var(--dd-red)', label: 'Timed out' },
};

interface WorkflowCardProps {
  workflow: { id: string; name: string; description?: string; tags?: string[]; steps: any[]; source: string; created_at: string };
  color: string;
  lastRun: Run | null;
  runCount: number;
  onOpen: () => void;
  onEdit: () => void;
  onRun: () => void;
  onDelete: () => void;
  activeTag: string | null;
  onTagClick: (tag: string) => void;
}

function WorkflowCard({ workflow, color, lastRun, runCount, onOpen, onEdit, onRun, onDelete, activeTag, onTagClick }: WorkflowCardProps) {
  const [hovered, setHovered] = useState(false);
  const lr = lastRun ? LAST_RUN_STATUS[lastRun.status] ?? null : null;

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--dd-surface)',
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all 200ms ease',
        boxShadow: hovered ? 'var(--dd-shadow-lg)' : 'var(--dd-shadow)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Colored top accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${color}, transparent)`,
        opacity: hovered ? 0.8 : 0.3,
        transition: 'opacity 200ms ease',
      }} />

      {/* Top row: glyph + name + actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Glyph ch={(workflow.name[0] ?? 'W').toUpperCase()} color={color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dd-text)' }}>
            {workflow.name}
          </div>
          {workflow.description && (
            <div style={{
              fontSize: 11, color: 'var(--dd-text-3)', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {workflow.description}
            </div>
          )}
        </div>
        <div style={{
          display: 'flex', gap: 2,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 150ms ease',
        }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="btn btn-ghost btn-sm" onClick={onRun} title="Run" style={{ padding: '3px 5px', color: 'var(--dd-green)' }}>
            <Icon name="play_arrow" size={15} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Edit" style={{ padding: '3px 5px', color: 'var(--dd-text-3)' }}>
            <Icon name="edit" size={13} />
          </button>
          <button
            className="btn btn-ghost btn-sm" onClick={onDelete} title="Delete"
            style={{ padding: '3px 5px', color: 'var(--dd-text-4)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--dd-red)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--dd-text-4)'; }}
          >
            <Icon name="delete" size={13} />
          </button>
        </div>
      </div>

      {/* Meta chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--dd-text-4)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Icon name="layers" size={12} />
          {workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}
        </span>
        {runCount > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Icon name="replay" size={12} />
            {runCount} run{runCount !== 1 ? 's' : ''}
          </span>
        )}
        {workflow.tags && workflow.tags.length > 0 && (
          <div
            style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {workflow.tags.slice(0, 3).map((t) => (
              <button
                key={t}
                onClick={() => onTagClick(t)}
                style={{
                  padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500,
                  border: `1px solid ${activeTag === t ? 'var(--dd-accent)' : 'rgba(139,92,246,0.2)'}`,
                  background: activeTag === t ? 'var(--dd-accent-dim)' : 'rgba(139,92,246,0.06)',
                  color: activeTag === t ? 'var(--dd-accent-bright)' : 'var(--dd-accent-bright)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 120ms ease',
                }}
              >
                # {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Last run status */}
      {lastRun && lr && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 8,
          background: 'var(--dd-surface-2)',
          fontSize: 11,
        }}>
          <Icon name={lr.icon} size={13} fill style={{ color: lr.color }} />
          <span style={{ color: lr.color, fontWeight: 500 }}>{lr.label}</span>
          <span style={{ color: 'var(--dd-text-4)' }}>·</span>
          <span className="mono" style={{ color: 'var(--dd-text-3)' }}>
            {lastRun.duration_ms ? `${lastRun.duration_ms < 1000 ? lastRun.duration_ms + 'ms' : (lastRun.duration_ms / 1000).toFixed(1) + 's'}` : '-'}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ color: 'var(--dd-text-4)' }}>
            {timeAgo(lastRun.started_at)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────

function EmptyWorkflows({ onCreateVisual }: { onCreateVisual: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 24,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'rgba(124,110,246,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="account_tree" size={36} style={{ color: 'var(--dd-accent)' }} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--dd-text)', marginBottom: 6 }}>
          No workflows yet
        </div>
        <div style={{ fontSize: 13, color: 'var(--dd-text-3)', maxWidth: 400 }}>
          Create multi-step workflows to automate your dev tasks.
          Add steps, branches, and parameters.
        </div>
      </div>

      <button className="btn btn-primary" onClick={onCreateVisual} style={{ padding: '10px 24px', fontSize: 13 }}>
        <Icon name="add" size={16} />
        Create your first workflow
      </button>
    </div>
  );
}
