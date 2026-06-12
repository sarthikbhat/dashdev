import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon, DialogModal } from '../components';
import { getWorkflow, saveWorkflow } from '../api';
import type { Workflow, WorkflowParam, FlowNode, FlowBranch, FlowStep } from '../types';

type OnFail = FlowStep['onFail'];

function extractPlaceholders(command: string): string[] {
  const out: string[] = [];
  for (const m of command.matchAll(/\$\{(\w+)\}/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

// ── Command Templates ───────────────────────────────────────────────────

interface CommandTemplate {
  cat: string;
  name: string;
  command: string;
  icon: string;
  timeout: string;
}

const COMMAND_TEMPLATES: CommandTemplate[] = [
  { cat: 'Shell', name: 'Run Command', command: '', icon: 'terminal', timeout: '30s' },
  { cat: 'Shell', name: 'Run Script', command: 'bash ./scripts/', icon: 'description', timeout: '60s' },
  { cat: 'Shell', name: 'SSH Remote', command: 'ssh ${HOST} "${COMMAND}"', icon: 'lan', timeout: '120s' },

  { cat: 'Docker', name: 'Docker Build', command: 'docker build -t ${IMAGE} .', icon: 'inventory_2', timeout: '300s' },
  { cat: 'Docker', name: 'Compose Up', command: 'docker compose up -d', icon: 'layers', timeout: '120s' },
  { cat: 'Docker', name: 'Compose Down', command: 'docker compose down', icon: 'layers_clear', timeout: '60s' },
  { cat: 'Docker', name: 'Docker Push', command: 'docker push ${IMAGE}', icon: 'cloud_upload', timeout: '300s' },

  { cat: 'Kubernetes', name: 'kubectl Apply', command: 'kubectl apply -f ${FILE}', icon: 'cloud_sync', timeout: '60s' },
  { cat: 'Kubernetes', name: 'kubectl Get Pods', command: 'kubectl get pods -n ${NAMESPACE}', icon: 'view_list', timeout: '30s' },
  { cat: 'Kubernetes', name: 'kubectl Exec', command: 'kubectl exec -it ${POD} -n ${NAMESPACE} -- ${COMMAND}', icon: 'terminal', timeout: '120s' },
  { cat: 'Kubernetes', name: 'kubectl Logs', command: 'kubectl logs ${POD} -n ${NAMESPACE}', icon: 'article', timeout: '60s' },
  { cat: 'Kubernetes', name: 'Switch Context', command: 'kubectl config use-context ${CONTEXT}', icon: 'swap_horiz', timeout: '10s' },
  { cat: 'Kubernetes', name: 'Rollout Status', command: 'kubectl rollout status deployment/${DEPLOY} -n ${NAMESPACE}', icon: 'sync', timeout: '120s' },

  { cat: 'Node.js', name: 'npm Install', command: 'npm install', icon: 'download', timeout: '120s' },
  { cat: 'Node.js', name: 'npm Run', command: 'npm run ${SCRIPT}', icon: 'play_arrow', timeout: '120s' },
  { cat: 'Node.js', name: 'npm Test', command: 'npm test', icon: 'science', timeout: '300s' },
  { cat: 'Node.js', name: 'npm Build', command: 'npm run build', icon: 'construction', timeout: '300s' },

  { cat: 'Git', name: 'Git Pull', command: 'git pull origin ${BRANCH}', icon: 'download', timeout: '60s' },
  { cat: 'Git', name: 'Git Push', command: 'git push origin ${BRANCH}', icon: 'upload', timeout: '60s' },
  { cat: 'Git', name: 'Git Checkout', command: 'git checkout ${BRANCH}', icon: 'swap_horiz', timeout: '30s' },
  { cat: 'Git', name: 'Git Merge', command: 'git merge ${BRANCH}', icon: 'merge', timeout: '30s' },

  { cat: 'Redis', name: 'Redis CLI', command: 'redis-cli ${COMMAND}', icon: 'storage', timeout: '30s' },
  { cat: 'Redis', name: 'Flush DB', command: 'redis-cli flushdb', icon: 'delete_sweep', timeout: '10s' },

  { cat: 'HTTP', name: 'cURL GET', command: 'curl -s ${URL}', icon: 'language', timeout: '30s' },
  { cat: 'HTTP', name: 'cURL POST', command: 'curl -s -X POST -H "Content-Type: application/json" -d \'${BODY}\' ${URL}', icon: 'send', timeout: '30s' },
  { cat: 'HTTP', name: 'Health Check', command: 'curl -sf ${URL}/health || exit 1', icon: 'monitor_heart', timeout: '10s' },
];

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  Shell: { icon: 'terminal', color: 'var(--dd-green)' },
  Docker: { icon: 'inventory_2', color: 'var(--dd-blue)' },
  Kubernetes: { icon: 'cloud', color: 'var(--dd-cyan)' },
  'Node.js': { icon: 'code', color: '#68d391' },
  Git: { icon: 'merge', color: 'var(--dd-amber)' },
  Redis: { icon: 'storage', color: 'var(--dd-red)' },
  HTTP: { icon: 'language', color: 'var(--dd-purple)' },
};

// ── Command Sidebar ─────────────────────────────────────────────────────

function CommandSidebar({ onAdd }: { onAdd: (t: CommandTemplate) => void }) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const categories = useMemo(() => {
    const map: Record<string, CommandTemplate[]> = {};
    for (const t of COMMAND_TEMPLATES) {
      (map[t.cat] ??= []).push(t);
    }
    return map;
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return COMMAND_TEMPLATES.filter(
      (t) => t.name.toLowerCase().includes(q) || t.command.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q)
    );
  }, [search]);

  function TemplateRow({ t }: { t: CommandTemplate }) {
    return (
      <button
        onClick={() => onAdd(t)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', border: 'none', background: 'transparent',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          borderRadius: 6, transition: 'background 100ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        title={t.command || 'Empty command — configure after adding'}
      >
        <Icon name={t.icon} size={14} style={{ color: CATEGORY_META[t.cat]?.color ?? 'var(--dd-text-3)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--dd-text-2)' }}>{t.name}</div>
          {t.command && (
            <div className="mono" style={{
              fontSize: 9, color: 'var(--dd-text-4)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1,
            }}>
              {t.command}
            </div>
          )}
        </div>
        <Icon name="add_circle_outline" size={14} style={{ color: 'var(--dd-text-4)', flexShrink: 0, opacity: 0.5 }} />
      </button>
    );
  }

  return (
    <div style={{
      width: 230, flexShrink: 0,
      background: 'var(--dd-surface)',
      borderRight: '1px solid var(--dd-line)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid var(--dd-line)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Icon name="widgets" size={16} style={{ color: 'var(--dd-accent)' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--dd-text)', letterSpacing: '-0.01em' }}>
          Commands
        </span>
        <span style={{ fontSize: 10, color: 'var(--dd-text-4)', marginLeft: 'auto' }}>
          {COMMAND_TEMPLATES.length}
        </span>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px' }}>
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={14} style={{
            position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--dd-text-4)',
          }} />
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commands..."
            style={{ fontSize: 11, paddingLeft: 28, background: 'var(--dd-surface-2)' }}
          />
        </div>
      </div>

      {/* Templates list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 4px 12px' }}>
        {filtered ? (
          filtered.length === 0 ? (
            <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 11, color: 'var(--dd-text-4)' }}>
              No matching commands
            </div>
          ) : (
            filtered.map((t) => <TemplateRow key={`${t.cat}-${t.name}`} t={t} />)
          )
        ) : (
          Object.entries(categories).map(([cat, templates]) => {
            const meta = CATEGORY_META[cat] ?? { icon: 'folder', color: 'var(--dd-text-3)' };
            const isCollapsed = collapsed[cat];
            return (
              <div key={cat} style={{ marginTop: 4 }}>
                <button
                  onClick={() => setCollapsed({ ...collapsed, [cat]: !isCollapsed })}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px', border: 'none', background: 'transparent',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Icon name={isCollapsed ? 'chevron_right' : 'expand_more'} size={14} style={{ color: 'var(--dd-text-4)' }} />
                  <Icon name={meta.icon} size={13} style={{ color: meta.color }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--dd-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {cat}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--dd-text-4)', marginLeft: 'auto' }}>{templates.length}</span>
                </button>
                {!isCollapsed && templates.map((t) => <TemplateRow key={t.name} t={t} />)}
              </div>
            );
          })
        )}
      </div>

      {/* Hint */}
      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--dd-line)',
        fontSize: 9, color: 'var(--dd-text-4)', textAlign: 'center',
      }}>
        Click to add to flow · Use <span className="mono">${'{PARAM}'}</span> for inputs
      </div>
    </div>
  );
}

let _idCounter = 0;
function newId(): string {
  return `n${++_idCounter}_${Date.now().toString(36)}`;
}

function makeStep(name?: string): FlowStep {
  return {
    id: newId(),
    name: name ?? 'New step',
    command: '',
    workdir: '',
    timeout: '30s',
    onFail: 'abort',
  };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
    || `wf-${Date.now().toString(36)}`;
}

function workflowToNodes(wf: Workflow | null): FlowNode[] {
  if (!wf) return [];
  if (wf.nodes && wf.nodes.length > 0) return wf.nodes;
  return wf.steps.map((s) => ({
    id: newId(),
    type: 'step' as const,
    step: {
      id: newId(),
      name: s.name,
      command: s.command,
      workdir: s.workdir ?? '',
      timeout: s.timeout ? `${s.timeout}s` : '30s',
      onFail: (s.on_failure === 'continue' ? 'continue' : s.on_failure?.startsWith('retry') ? 'retry' : 'abort') as OnFail,
    },
  }));
}

// ── Connection Dot ──────────────────────────────────────────────────────

function ConnDot({ color }: { color?: string }) {
  return (
    <div style={{
      width: 10, height: 10, borderRadius: '50%',
      background: color ?? 'var(--dd-surface-3)',
      border: '2px solid var(--dd-surface)',
      boxShadow: '0 0 0 1px var(--dd-line-2)',
      zIndex: 2,
    }} />
  );
}

// ── Properties Panel (right side) ───────────────────────────────────────

function PropertiesPanel({ step, onChange, onClose }: {
  step: FlowStep;
  onChange: (s: FlowStep) => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      width: 320, flexShrink: 0,
      background: 'var(--dd-surface)',
      borderLeft: '1px solid var(--dd-line)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--dd-line)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--dd-accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="terminal" size={18} style={{ color: 'var(--dd-accent)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--dd-text-4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Step Properties
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dd-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {step.name || 'Unnamed step'}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Panel body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* General info section */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dd-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="info" size={13} />
            General
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--dd-text-3)', display: 'block', marginBottom: 4 }}>Name</label>
              <input
                className="input"
                value={step.name}
                onChange={(e) => onChange({ ...step, name: e.target.value })}
                style={{ fontSize: 12 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--dd-text-3)', display: 'block', marginBottom: 4 }}>Command</label>
              <input
                className="input mono"
                value={step.command}
                onChange={(e) => onChange({ ...step, command: e.target.value })}
                placeholder="e.g. npm run build"
                style={{ fontSize: 12 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--dd-text-3)', display: 'block', marginBottom: 4 }}>Working directory</label>
              <input
                className="input mono"
                value={step.workdir}
                onChange={(e) => onChange({ ...step, workdir: e.target.value })}
                placeholder="e.g. ~/app"
                style={{ fontSize: 12 }}
              />
            </div>
          </div>
        </div>

        {/* Settings section */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dd-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="settings" size={13} />
            Settings
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--dd-text-3)', display: 'block', marginBottom: 4 }}>Timeout</label>
              <input
                className="input mono"
                value={step.timeout}
                onChange={(e) => onChange({ ...step, timeout: e.target.value })}
                style={{ fontSize: 12, width: 100 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--dd-text-3)', display: 'block', marginBottom: 6 }}>On failure</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {([
                  { v: 'abort', label: 'Abort', icon: 'block', c: 'var(--dd-red)' },
                  { v: 'retry', label: 'Retry 3x', icon: 'replay', c: 'var(--dd-amber)' },
                  { v: 'continue', label: 'Continue', icon: 'skip_next', c: 'var(--dd-green)' },
                ] as const).map((o) => {
                  const active = o.v === step.onFail;
                  return (
                    <button
                      key={o.v}
                      onClick={() => onChange({ ...step, onFail: o.v })}
                      style={{
                        flex: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        padding: '7px 8px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                        fontFamily: 'inherit', cursor: 'pointer',
                        background: active ? `color-mix(in srgb, ${o.c} 10%, transparent)` : 'var(--dd-surface-2)',
                        border: `1.5px solid ${active ? o.c : 'var(--dd-line)'}`,
                        color: active ? o.c : 'var(--dd-text-4)',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <Icon name={o.icon} size={13} />
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step Node Card ───────────────────────────────────────────────────────

interface StepNodeProps {
  step: FlowStep;
  index: number;
  selected: boolean;
  missingParams: string[];
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
  isDragOver: boolean;
}

function StepNodeCard({
  step, index, selected, missingParams, onSelect, onRemove,
  onDragStart, onDragOver, onDragLeave, onDrop,
  isDragging, isDragOver,
}: StepNodeProps) {
  const hasWarning = !step.command.trim() || missingParams.length > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <ConnDot color={selected ? 'var(--dd-accent)' : undefined} />
      <div
        className={`flow-node${isDragging ? ' dragging' : ''}${isDragOver ? ' drag-over' : ''}`}
        style={{
          borderColor: selected ? 'var(--dd-accent)' : hasWarning ? 'rgba(251,191,36,0.3)' : undefined,
          boxShadow: selected ? '0 0 0 2px rgba(139,92,246,0.2), var(--dd-shadow-lg)' : undefined,
        }}
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onSelect}
      >
        {/* Category badge */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 5, padding: '4px 0',
          background: hasWarning ? 'rgba(251,191,36,0.08)' : 'var(--dd-accent-dim)',
          borderBottom: '1px solid var(--dd-line)',
        }}>
          <Icon name={hasWarning ? 'warning' : 'terminal'} size={11}
            style={{ color: hasWarning ? 'var(--dd-amber)' : 'var(--dd-accent-bright)' }} />
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: hasWarning ? 'var(--dd-amber)' : 'var(--dd-accent-bright)',
          }}>
            Step {index + 1}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 14px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="drag_indicator" size={14} style={{ color: 'var(--dd-text-4)', cursor: 'grab', flexShrink: 0 }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dd-text)' }}>
                {step.name || 'Unnamed step'}
              </div>
              {step.command ? (
                <div className="mono" style={{
                  fontSize: 11, color: 'var(--dd-text-3)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginTop: 3,
                }}>
                  $ {step.command}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--dd-amber)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="warning" size={11} />
                  Click to configure command
                </div>
              )}
            </div>

            <span style={{
              fontSize: 10, fontWeight: 500,
              color: 'var(--dd-text-3)',
              background: 'var(--dd-surface-3)',
              padding: '2px 8px', borderRadius: 4,
              fontFamily: 'var(--font-mono)',
              flexShrink: 0,
            }}>
              {step.timeout}
            </span>

            <button
              className="btn btn-ghost btn-sm"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              title="Remove step"
              style={{ padding: '2px 4px', color: 'var(--dd-text-4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--dd-red)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--dd-text-4)'; }}
            >
              <Icon name="close" size={14} />
            </button>
          </div>

          {/* Missing param warnings */}
          {missingParams.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap', paddingLeft: 24 }}>
              {missingParams.map((p) => (
                <span key={p} style={{
                  fontSize: 9, fontWeight: 600,
                  color: 'var(--dd-amber)',
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.15)',
                  padding: '2px 7px', borderRadius: 4,
                  fontFamily: 'var(--font-mono)',
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                  <Icon name="error_outline" size={9} />
                  {p} — no input defined
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <ConnDot color={selected ? 'var(--dd-accent)' : undefined} />
    </div>
  );
}

// ── Parallel Branch Card ─────────────────────────────────────────────────

interface ParallelNodeProps {
  conditionVar: string;
  branches: FlowBranch[];
  onConditionVarChange: (v: string) => void;
  onChange: (branches: FlowBranch[]) => void;
  onRemove: () => void;
  onSelectStep: (step: FlowStep, nodeId: string, branchIdx: number, stepIdx: number) => void;
  selectedStepId: string | null;
}

function ParallelNodeCard({ conditionVar, branches, onConditionVarChange, onChange, onRemove, onSelectStep, selectedStepId }: ParallelNodeProps) {
  const isConditional = conditionVar.trim().length > 0;
  const accentColor = isConditional ? 'var(--dd-amber)' : 'var(--dd-accent)';
  const accentDim = isConditional ? 'var(--dd-amber-dim)' : 'var(--dd-accent-dim)';

  function addBranch() {
    const id = newId();
    onChange([...branches, {
      id,
      label: `Branch ${branches.length + 1}`,
      condition: '',
      steps: [makeStep(`Step 1`)],
    }]);
  }

  function updateBranch(idx: number, branch: FlowBranch) {
    const next = [...branches];
    next[idx] = branch;
    onChange(next);
  }

  function removeBranch(idx: number) {
    if (branches.length <= 2) return;
    onChange(branches.filter((_, i) => i !== idx));
  }

  function addStepToBranch(branchIdx: number) {
    const branch = branches[branchIdx];
    updateBranch(branchIdx, {
      ...branch,
      steps: [...branch.steps, makeStep(`Step ${branch.steps.length + 1}`)],
    });
  }

  function removeStepFromBranch(branchIdx: number, stepIdx: number) {
    const branch = branches[branchIdx];
    updateBranch(branchIdx, {
      ...branch,
      steps: branch.steps.filter((_, i) => i !== stepIdx),
    });
  }

  return (
    <div style={{ width: '100%', maxWidth: 900, position: 'relative' }}>
      <ConnDot color={accentColor} />

      {/* Outer card container */}
      <div style={{
        border: `1px solid ${isConditional ? 'rgba(251,191,36,0.2)' : 'var(--dd-line)'}`,
        borderRadius: 14,
        background: isConditional ? 'rgba(251,191,36,0.02)' : 'rgba(139,92,246,0.02)',
        overflow: 'hidden',
      }}>
        {/* Header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px',
          background: accentDim,
          borderBottom: `1px solid ${isConditional ? 'rgba(251,191,36,0.15)' : 'rgba(139,92,246,0.1)'}`,
        }}>
          <Icon
            name={isConditional ? 'rule' : 'call_split'}
            size={16}
            style={{ color: accentColor }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {isConditional ? 'If / Else' : 'Parallel'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>
            {branches.length} branches
          </span>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-ghost btn-sm"
            onClick={addBranch}
            style={{ padding: '2px 8px', fontSize: 10, color: accentColor, gap: 4 }}
          >
            <Icon name="add" size={13} /> Branch
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onRemove}
            style={{ padding: '2px 6px', color: 'var(--dd-text-4)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--dd-red)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--dd-text-4)'; }}
          >
            <Icon name="delete" size={14} />
          </button>
        </div>

        {/* Condition variable — defined once for all branches */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--dd-line)',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Icon name="data_object" size={14} style={{ color: 'var(--dd-text-3)' }} />
            <span style={{ fontSize: 11, color: 'var(--dd-text-3)', fontWeight: 500 }}>
              Switch on
            </span>
          </div>
          <input
            className="input mono"
            value={conditionVar}
            onChange={(e) => onConditionVarChange(e.target.value)}
            placeholder="e.g. ENV, REGION, DEPLOY_TARGET"
            style={{
              fontSize: 11, flex: 1,
              background: 'var(--dd-surface-2)', padding: '5px 10px',
              borderColor: isConditional ? 'rgba(251,191,36,0.25)' : undefined,
            }}
          />
          {!isConditional && (
            <span style={{ fontSize: 10, color: 'var(--dd-text-4)', fontStyle: 'italic', flexShrink: 0 }}>
              Leave empty for parallel execution
            </span>
          )}
        </div>

        {/* Branches side by side */}
        <div style={{
          display: 'flex', gap: 0,
          padding: '12px 8px',
        }}>
          {branches.map((branch, bi) => (
            <div key={branch.id} style={{
              flex: 1, minWidth: 180,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
              padding: '8px 8px',
              borderRight: bi < branches.length - 1 ? '1px solid var(--dd-line)' : undefined,
            }}>
              {/* Branch header: label + match value */}
              <div style={{ width: '100%', marginBottom: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
                }}>
                  <input
                    value={branch.label}
                    onChange={(e) => updateBranch(bi, { ...branch, label: e.target.value })}
                    style={{
                      fontSize: 12, fontWeight: 600,
                      background: 'transparent', border: 'none', outline: 'none',
                      color: 'var(--dd-text)',
                      padding: '2px 0', width: 'auto', flex: 1,
                      fontFamily: 'inherit',
                    }}
                  />
                  {branches.length > 2 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeBranch(bi)}
                      style={{ padding: '2px 4px', color: 'var(--dd-text-4)' }}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  )}
                </div>

                {/* Match value — only show when conditional */}
                {isConditional && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: 'var(--dd-amber)',
                      flexShrink: 0,
                    }}>
                      =
                    </span>
                    <input
                      className="input mono"
                      value={branch.condition}
                      onChange={(e) => updateBranch(bi, { ...branch, condition: e.target.value })}
                      placeholder={`value ${bi + 1}`}
                      style={{
                        fontSize: 11, flex: 1,
                        background: 'var(--dd-surface-3)',
                        padding: '4px 8px',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Steps */}
              {branch.steps.map((step, si) => (
                <div key={step.id} style={{ width: '100%' }}>
                  <div
                    className="flow-node"
                    style={{
                      width: '100%', margin: '4px 0', cursor: 'pointer',
                      borderColor: selectedStepId === step.id ? 'var(--dd-accent)' : undefined,
                      boxShadow: selectedStepId === step.id ? '0 0 0 2px rgba(139,92,246,0.2)' : undefined,
                    }}
                    onClick={() => onSelectStep(step, branch.id, bi, si)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
                      <Icon name="terminal" size={13} style={{ color: 'var(--dd-green)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--dd-text)' }}>
                          {step.name}
                        </div>
                        {step.command && (
                          <div className="mono" style={{ fontSize: 10, color: 'var(--dd-text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                            $ {step.command}
                          </div>
                        )}
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); removeStepFromBranch(bi, si); }}
                        style={{ padding: '2px 4px', color: 'var(--dd-text-4)' }}
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button
                className="flow-add-btn"
                onClick={() => addStepToBranch(bi)}
                title="Add step to branch"
                style={{ marginTop: 8, width: 24, height: 24 }}
              >
                <Icon name="add" size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <ConnDot color={accentColor} />
    </div>
  );
}

// ── Add Node Menu ────────────────────────────────────────────────────────

function AddNodeMenu({
  onAddStep, onAddParallel, onClose,
}: {
  onAddStep: () => void;
  onAddParallel: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
      marginTop: 4, background: 'var(--dd-surface-2)', border: '1px solid var(--dd-line-2)',
      borderRadius: 10, boxShadow: 'var(--dd-shadow-lg)', padding: 4, zIndex: 50,
      width: 200, animation: 'dd-toast-in 150ms ease',
    }}>
      <button
        onClick={() => { onAddStep(); onClose(); }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 8,
          border: 'none', background: 'transparent',
          cursor: 'pointer', color: 'var(--dd-text-2)',
          fontSize: 12, fontFamily: 'inherit', textAlign: 'left',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--dd-green-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="terminal" size={15} style={{ color: 'var(--dd-green)' }} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 12 }}>New Step</div>
          <div style={{ fontSize: 10, color: 'var(--dd-text-4)' }}>Run a command</div>
        </div>
      </button>
      <button
        onClick={() => { onAddParallel(); onClose(); }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 8,
          border: 'none', background: 'transparent',
          cursor: 'pointer', color: 'var(--dd-text-2)',
          fontSize: 12, fontFamily: 'inherit', textAlign: 'left',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--dd-accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="call_split" size={15} style={{ color: 'var(--dd-accent)' }} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 12 }}>If / Else</div>
          <div style={{ fontSize: 10, color: 'var(--dd-text-4)' }}>Conditional branches</div>
        </div>
      </button>
    </div>
  );
}

// ── Flow Connector ──────────────────────────────────────────────────────

function FlowConnector({ onAddStep, onAddParallel }: { onAddStep: () => void; onAddParallel: () => void }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="flow-connector" style={{ position: 'relative' }}>
      <div className="flow-line" />
      <button
        className="flow-add-btn"
        onClick={() => setShowMenu(!showMenu)}
        title="Add node"
      >
        <Icon name="add" size={16} />
      </button>
      <div className="flow-line" />
      {showMenu && (
        <AddNodeMenu
          onAddStep={onAddStep}
          onAddParallel={onAddParallel}
          onClose={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}

// ── Terminal Node ────────────────────────────────────────────────────────

function TerminalNode({ label, icon, color }: { label: string; icon: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 24px',
        borderRadius: 20,
        background: 'var(--dd-surface)',
        border: '1px solid var(--dd-line)',
        boxShadow: 'var(--dd-shadow)',
        color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        <Icon name={icon} size={16} />
        {label}
      </div>
    </div>
  );
}

// ── Workflow Metadata Panel ──────────────────────────────────────────────

interface MetaPanelProps {
  name: string;
  description: string;
  tags: string[];
  params: WorkflowParam[];
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onTagsChange: (v: string[]) => void;
  onParamsChange: (v: WorkflowParam[]) => void;
  onParamRename: (oldName: string, newName: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  text: 'var(--dd-blue)', textarea: 'var(--dd-cyan)',
  select: 'var(--dd-purple)', toggle: 'var(--dd-green)',
};

function ParamPill({ param, onUpdate, onRename, onRemove }: {
  param: WorkflowParam;
  onUpdate: (p: WorkflowParam) => void;
  onRename: (oldName: string, newName: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState(param.name);
  const tc = TYPE_COLORS[param.type] ?? 'var(--dd-text-3)';

  function commitName() {
    const cleaned = draftName.trim().replace(/\s/g, '_');
    if (cleaned && cleaned !== param.name) {
      onRename(param.name, cleaned);
    }
    setDraftName(cleaned || param.name);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Collapsed pill */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 6px 3px 8px', borderRadius: open ? '6px 6px 0 0' : 6,
          background: open ? 'var(--dd-surface-3)' : 'var(--dd-surface-2)',
          border: `1px solid ${open ? 'var(--dd-accent)' : 'var(--dd-line)'}`,
          borderBottom: open ? '1px solid var(--dd-line)' : undefined,
          fontSize: 11, cursor: 'pointer',
          transition: 'all 100ms',
        }}
      >
        <span className="mono" style={{ color: 'var(--dd-text-4)', fontSize: 10, userSelect: 'none' }}>{'${'}</span>
        <span className="mono" style={{ color: 'var(--dd-text)', fontWeight: 600 }}>{param.name}</span>
        <span className="mono" style={{ color: 'var(--dd-text-4)', fontSize: 10, userSelect: 'none' }}>{'}'}</span>
        <span style={{
          fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: tc,
          background: `color-mix(in srgb, ${tc} 10%, transparent)`,
          padding: '1px 5px', borderRadius: 3,
        }}>{param.type}</span>
        {param.required && <span style={{ fontSize: 9, color: 'var(--dd-amber)' }}>*</span>}
        <Icon name={open ? 'expand_less' : 'edit'} size={10} style={{ color: 'var(--dd-text-4)' }} />
      </div>

      {/* Expanded edit form */}
      {open && (
        <div style={{
          padding: '8px 10px', borderRadius: '0 0 6px 6px',
          background: 'var(--dd-surface-3)',
          border: '1px solid var(--dd-accent)',
          borderTop: 'none',
          display: 'flex', flexDirection: 'column', gap: 8,
          minWidth: 220,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: 'var(--dd-text-4)', marginBottom: 2, textTransform: 'uppercase', fontWeight: 600 }}>Name</div>
              <input className="input mono" value={draftName}
                onChange={(e) => setDraftName(e.target.value.replace(/\s/g, '_'))}
                onBlur={commitName}
                onKeyDown={(e) => { if (e.key === 'Enter') commitName(); }}
                style={{ fontSize: 11, padding: '3px 6px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: 'var(--dd-text-4)', marginBottom: 2, textTransform: 'uppercase', fontWeight: 600 }}>Label</div>
              <input className="input" value={param.label}
                onChange={(e) => onUpdate({ ...param, label: e.target.value })}
                placeholder="Display label"
                style={{ fontSize: 11, padding: '3px 6px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--dd-text-4)', marginBottom: 2, textTransform: 'uppercase', fontWeight: 600 }}>Type</div>
              <select className="input" value={param.type}
                onChange={(e) => onUpdate({ ...param, type: e.target.value as WorkflowParam['type'] })}
                style={{ fontSize: 11, padding: '3px 6px' }}>
                <option value="text">text</option>
                <option value="textarea">textarea</option>
                <option value="select">select</option>
                <option value="toggle">toggle</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--dd-text-4)', marginBottom: 2, textTransform: 'uppercase', fontWeight: 600 }}>Default</div>
              <input className="input mono" value={param.default ?? ''}
                onChange={(e) => onUpdate({ ...param, default: e.target.value || undefined })}
                placeholder="—"
                style={{ fontSize: 11, padding: '3px 6px', width: 80 }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--dd-text-3)', cursor: 'pointer', paddingBottom: 2 }}>
              <input type="checkbox" checked={param.required ?? false}
                onChange={(e) => onUpdate({ ...param, required: e.target.checked })}
                style={{ accentColor: 'var(--dd-amber)' }} />
              Required
            </label>
          </div>
          {param.type === 'select' && (
            <div>
              <div style={{ fontSize: 9, color: 'var(--dd-text-4)', marginBottom: 2, textTransform: 'uppercase', fontWeight: 600 }}>Options (comma-separated)</div>
              <input className="input" value={(param.options ?? []).join(', ')}
                onChange={(e) => onUpdate({ ...param, options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })}
                placeholder="staging, production"
                style={{ fontSize: 11, padding: '3px 6px' }} />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
            <button className="btn btn-ghost btn-sm" onClick={onRemove}
              style={{ fontSize: 10, color: 'var(--dd-red)', padding: '2px 8px', gap: 3 }}>
              <Icon name="delete" size={11} /> Remove
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}
              style={{ fontSize: 10, padding: '2px 8px' }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ParamEditor({ params, onChange, onRename }: {
  params: WorkflowParam[];
  onChange: (v: WorkflowParam[]) => void;
  onRename: (oldName: string, newName: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState<WorkflowParam['type']>('text');
  const [editRequired, setEditRequired] = useState(false);
  const [editDefault, setEditDefault] = useState('');
  const [editOptions, setEditOptions] = useState('');

  function addParam() {
    if (!editName.trim()) return;
    if (params.some((p) => p.name === editName.trim())) return;
    const p: WorkflowParam = {
      name: editName.trim(),
      label: editLabel.trim() || editName.trim(),
      type: editType,
      required: editRequired,
      default: editDefault || undefined,
    };
    if (editType === 'select' && editOptions.trim()) {
      p.options = editOptions.split(',').map((o) => o.trim()).filter(Boolean);
    }
    onChange([...params, p]);
    setEditName(''); setEditLabel(''); setEditType('text');
    setEditRequired(false); setEditDefault(''); setEditOptions('');
    setAdding(false);
  }

  function handleRename(oldName: string, newName: string) {
    if (params.some((p) => p.name === newName)) return;
    onChange(params.map((p) => p.name === oldName ? { ...p, name: newName, label: p.label === oldName ? newName : p.label } : p));
    onRename(oldName, newName);
  }

  return (
    <div>
      {/* Param pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {params.map((p) => (
          <ParamPill
            key={p.name}
            param={p}
            onUpdate={(updated) => onChange(params.map((x) => x.name === p.name ? updated : x))}
            onRename={handleRename}
            onRemove={() => onChange(params.filter((x) => x.name !== p.name))}
          />
        ))}
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: '2px 8px', fontSize: 10, color: 'var(--dd-accent-bright)', gap: 3 }}
          onClick={() => setAdding(!adding)}
        >
          <Icon name={adding ? 'close' : 'add'} size={12} />
          {adding ? 'Cancel' : 'Add input'}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div style={{
          marginTop: 8, padding: '10px 12px', borderRadius: 8,
          background: 'var(--dd-surface-2)', border: '1px solid var(--dd-line)',
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end',
        }}>
          <div style={{ flex: '1 1 120px' }}>
            <div style={{ fontSize: 10, color: 'var(--dd-text-4)', marginBottom: 3 }}>Name</div>
            <input className="input mono" value={editName} onChange={(e) => setEditName(e.target.value.replace(/\s/g, '_'))}
              placeholder="param_name" style={{ fontSize: 11 }} autoFocus />
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <div style={{ fontSize: 10, color: 'var(--dd-text-4)', marginBottom: 3 }}>Label</div>
            <input className="input" value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
              placeholder="Display label" style={{ fontSize: 11 }} />
          </div>
          <div style={{ flex: '0 0 110px' }}>
            <div style={{ fontSize: 10, color: 'var(--dd-text-4)', marginBottom: 3 }}>Type</div>
            <select className="input" value={editType} onChange={(e) => setEditType(e.target.value as WorkflowParam['type'])}
              style={{ fontSize: 11 }}>
              <option value="text">text</option>
              <option value="textarea">textarea</option>
              <option value="select">select</option>
              <option value="toggle">toggle</option>
            </select>
          </div>
          <div style={{ flex: '0 0 100px' }}>
            <div style={{ fontSize: 10, color: 'var(--dd-text-4)', marginBottom: 3 }}>Default</div>
            <input className="input mono" value={editDefault} onChange={(e) => setEditDefault(e.target.value)}
              placeholder="—" style={{ fontSize: 11 }} />
          </div>
          {editType === 'select' && (
            <div style={{ flex: '1 1 180px' }}>
              <div style={{ fontSize: 10, color: 'var(--dd-text-4)', marginBottom: 3 }}>Options (comma-separated)</div>
              <input className="input" value={editOptions} onChange={(e) => setEditOptions(e.target.value)}
                placeholder="staging, production" style={{ fontSize: 11 }} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--dd-text-3)', cursor: 'pointer' }}>
              <input type="checkbox" checked={editRequired} onChange={(e) => setEditRequired(e.target.checked)} style={{ accentColor: 'var(--dd-amber)' }} />
              Required
            </label>
            <button className="btn btn-primary btn-sm" onClick={addParam} disabled={!editName.trim()}
              style={{ padding: '4px 12px', fontSize: 10 }}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaPanel({ name, description, tags, params, onNameChange, onDescriptionChange, onTagsChange, onParamsChange, onParamRename }: MetaPanelProps) {
  const [showTagDialog, setShowTagDialog] = useState(false);

  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: '1px solid var(--dd-line)',
      flexShrink: 0,
      background: 'var(--dd-surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg, var(--dd-accent) 0%, #c084fc 100%)',
          boxShadow: '0 2px 8px rgba(139,92,246,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name="account_tree" size={22} style={{ color: '#fff' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Workflow name"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--dd-text)', fontSize: 16, fontWeight: 700,
              fontFamily: 'inherit', width: '100%', letterSpacing: -0.3,
            }}
          />
          <input
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Add a description..."
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--dd-text-3)', fontSize: 12,
              fontFamily: 'inherit', width: '100%', marginTop: 2,
            }}
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {tags.map((tag) => (
              <span key={tag} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {tag}
                <button
                  onClick={() => onTagsChange(tags.filter((t) => t !== tag))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--dd-text-4)', display: 'flex' }}
                >
                  <Icon name="close" size={10} />
                </button>
              </span>
            ))}
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 6px', fontSize: 10, color: 'var(--dd-text-4)' }}
              onClick={() => setShowTagDialog(true)}
            >
              <Icon name="add" size={12} /> tag
            </button>
          </div>
        </div>
      </div>

      {/* Inputs / Parameters section */}
      <div style={{ marginTop: 12, paddingLeft: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Icon name="input" size={13} style={{ color: 'var(--dd-text-3)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--dd-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Inputs
          </span>
          {params.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--dd-text-4)' }}>({params.length})</span>
          )}
        </div>
        <ParamEditor params={params} onChange={onParamsChange} onRename={onParamRename} />
      </div>

      {showTagDialog && (
        <DialogModal
          mode="prompt"
          title="Add tag"
          placeholder="Tag name"
          confirmLabel="Add"
          onConfirm={(v) => {
            if (!tags.includes(v)) onTagsChange([...tags, v]);
            setShowTagDialog(false);
          }}
          onCancel={() => setShowTagDialog(false)}
        />
      )}
    </div>
  );
}

// ── Main Builder ─────────────────────────────────────────────────────────

export default function WorkflowBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [params, setParams] = useState<WorkflowParam[]>([]);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedBranchStep, setSelectedBranchStep] = useState<{ nodeId: string; branchIdx: number; stepIdx: number } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    if (id && id !== 'new') {
      setLoading(true);
      getWorkflow(id)
        .then((wf) => {
          setWorkflow(wf);
          setName(wf.name);
          setDescription(wf.description ?? '');
          setTags(wf.tags ?? []);
          setParams(wf.params ?? []);
          setNodes(workflowToNodes(wf));
        })
        .catch(() => null)
        .finally(() => setLoading(false));
    }
  }, [id]);

  // Find selected step for properties panel
  const selectedStep = (() => {
    if (selectedNodeId) {
      const node = nodes.find((n) => n.id === selectedNodeId);
      if (node?.type === 'step' && node.step) return node.step;
    }
    if (selectedBranchStep) {
      const node = nodes.find((n) => n.type === 'parallel' && n.branches?.some((b) => b.id === selectedBranchStep.nodeId));
      if (node?.branches) {
        const branch = node.branches[selectedBranchStep.branchIdx];
        if (branch) return branch.steps[selectedBranchStep.stepIdx] ?? null;
      }
    }
    return null;
  })();

  function updateSelectedStep(step: FlowStep) {
    if (selectedNodeId) {
      const idx = nodes.findIndex((n) => n.id === selectedNodeId);
      if (idx >= 0) updateStepNode(idx, step);
    }
    if (selectedBranchStep) {
      const nodeIdx = nodes.findIndex((n) => n.type === 'parallel' && n.branches?.some((b) => b.id === selectedBranchStep.nodeId));
      if (nodeIdx >= 0 && nodes[nodeIdx].branches) {
        const branches = [...nodes[nodeIdx].branches!];
        const branchSteps = [...branches[selectedBranchStep.branchIdx].steps];
        branchSteps[selectedBranchStep.stepIdx] = step;
        branches[selectedBranchStep.branchIdx] = { ...branches[selectedBranchStep.branchIdx], steps: branchSteps };
        updateParallelNode(nodeIdx, branches);
      }
    }
    // Auto-add new placeholders as inputs
    const placeholders = extractPlaceholders(step.command);
    if (placeholders.length > 0) {
      const existing = new Set(params.map((p) => p.name));
      const toAdd = placeholders.filter((p) => !existing.has(p));
      if (toAdd.length > 0) {
        setParams([...params, ...toAdd.map((pName) => ({
          name: pName,
          label: pName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          type: (/COMMAND|CMD|SCRIPT|QUERY|BODY/i.test(pName) ? 'textarea' : 'text') as WorkflowParam['type'],
          required: true,
        }))]);
      }
    }
  }

  // ── Node manipulation ──

  function addStepAt(index: number) {
    const step = makeStep(`Step ${nodes.length + 1}`);
    const node: FlowNode = { id: newId(), type: 'step', step };
    const next = [...nodes];
    next.splice(index, 0, node);
    setNodes(next);
    setSelectedNodeId(node.id);
    setSelectedBranchStep(null);
  }

  function addParallelAt(index: number) {
    const node: FlowNode = {
      id: newId(),
      type: 'parallel',
      branches: [
        { id: newId(), label: 'Branch A', condition: '', steps: [makeStep('Step A1')] },
        { id: newId(), label: 'Branch B', condition: '', steps: [makeStep('Step B1')] },
      ],
    };
    const next = [...nodes];
    next.splice(index, 0, node);
    setNodes(next);
  }

  function removeNode(index: number) {
    const node = nodes[index];
    if (node.id === selectedNodeId) {
      setSelectedNodeId(null);
    }
    setNodes(nodes.filter((_, i) => i !== index));
  }

  function addFromTemplate(t: CommandTemplate) {
    const step: FlowStep = {
      id: newId(),
      name: t.name,
      command: t.command,
      workdir: '',
      timeout: t.timeout,
      onFail: 'abort',
    };
    const node: FlowNode = { id: newId(), type: 'step', step };
    setNodes([...nodes, node]);
    setSelectedNodeId(node.id);
    setSelectedBranchStep(null);

    // Auto-detect ${PARAM} placeholders and add missing params
    const placeholders = t.command.match(/\$\{(\w+)\}/g);
    if (placeholders) {
      const newParams = [...params];
      let added = 0;
      for (const match of placeholders) {
        const pName = match.slice(2, -1); // strip ${ and }
        if (newParams.some((p) => p.name === pName)) continue;
        const isLikelyCommand = /COMMAND|CMD|SCRIPT|QUERY|BODY/i.test(pName);
        newParams.push({
          name: pName,
          label: pName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          type: isLikelyCommand ? 'textarea' : 'text',
          required: true,
        });
        added++;
      }
      if (added > 0) setParams(newParams);
    }
  }

  function handleParamRename(oldName: string, newName: string) {
    const re = new RegExp(`\\$\\{${oldName}\\}`, 'g');
    const replacement = `\${${newName}}`;
    setNodes(nodes.map((node) => {
      if (node.type === 'step' && node.step) {
        return { ...node, step: { ...node.step, command: node.step.command.replace(re, replacement) } };
      }
      if (node.type === 'parallel' && node.branches) {
        return {
          ...node,
          branches: node.branches.map((b) => ({
            ...b,
            steps: b.steps.map((s) => ({ ...s, command: s.command.replace(re, replacement) })),
          })),
        };
      }
      return node;
    }));
  }

  function updateStepNode(index: number, step: FlowStep) {
    const next = [...nodes];
    next[index] = { ...next[index], step };
    setNodes(next);
  }

  function updateParallelNode(index: number, branches: FlowBranch[]) {
    const next = [...nodes];
    next[index] = { ...next[index], branches };
    setNodes(next);
  }

  // ── Drag and drop ──

  function handleDragStart(index: number) {
    setDragIdx(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIdx(index);
  }

  function handleDragLeave() {
    setDragOverIdx(null);
  }

  function handleDrop(index: number) {
    if (dragIdx === null || dragIdx === index) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const next = [...nodes];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(index > dragIdx ? index - 1 : index, 0, moved);
    setNodes(next);
    setDragIdx(null);
    setDragOverIdx(null);
  }

  // ── Save ──

  async function handleSave() {
    const wfId = workflow?.id ?? (id !== 'new' ? id : null) ?? slugify(name);
    setSaving(true);

    const steps = flattenNodesToSteps(nodes);
    try {
      await saveWorkflow(wfId, {
        name,
        description: description || undefined,
        tags: tags.length > 0 ? tags : undefined,
        params: params.length > 0 ? params : undefined,
        nodes,
        steps,
      });
      navigate(`/workflow/${wfId}`);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }

  function flattenNodesToSteps(nodeList: FlowNode[]) {
    const result: {
      name: string; command: string; workdir?: string;
      type: 'run-and-done'; timeout: number;
      on_failure: 'stop' | 'continue' | `retry:${number}`;
      branch_group?: string; branch_id?: string; branch_condition?: string;
    }[] = [];

    for (const node of nodeList) {
      if (node.type === 'step' && node.step) {
        const s = node.step;
        result.push({
          name: s.name,
          command: s.command,
          workdir: s.workdir || undefined,
          type: 'run-and-done',
          timeout: parseInt(s.timeout) || 30,
          on_failure: s.onFail === 'retry' ? 'retry:3' : s.onFail === 'continue' ? 'continue' : 'stop',
        });
      } else if (node.type === 'parallel' && node.branches) {
        const groupId = node.id;
        for (const branch of node.branches) {
          for (const s of branch.steps) {
            result.push({
              name: s.name,
              command: s.command,
              workdir: s.workdir || undefined,
              type: 'run-and-done',
              timeout: parseInt(s.timeout) || 30,
              on_failure: s.onFail === 'retry' ? 'retry:3' : s.onFail === 'continue' ? 'continue' : 'stop',
              branch_group: groupId,
              branch_id: branch.id,
              branch_condition: node.conditionVar && branch.condition
                ? `\${${node.conditionVar}} == ${branch.condition}`
                : branch.condition || undefined,
            });
          }
        }
      }
    }
    return result;
  }

  function flattenNodes(nodeList: FlowNode[]): FlowStep[] {
    const result: FlowStep[] = [];
    for (const node of nodeList) {
      if (node.type === 'step' && node.step) {
        result.push(node.step);
      } else if (node.type === 'parallel' && node.branches) {
        for (const branch of node.branches) {
          result.push(...branch.steps);
        }
      }
    }
    return result;
  }

  const stepCount = flattenNodes(nodes).length;
  const allSteps = flattenNodes(nodes);
  const emptyCommandSteps = allSteps.filter((s) => !s.command.trim());
  const paramNames = new Set(params.map((p) => p.name));
  function getMissingParams(command: string): string[] {
    return extractPlaceholders(command).filter((p) => !paramNames.has(p));
  }

  const allMissing = allSteps.flatMap((s) => getMissingParams(s.command));
  const uniqueMissing = [...new Set(allMissing)];

  const validationIssues: string[] = [];
  if (!name.trim()) validationIssues.push('Workflow needs a name');
  if (stepCount === 0) validationIssues.push('Add at least one step');
  if (emptyCommandSteps.length > 0) {
    validationIssues.push(
      emptyCommandSteps.length === 1
        ? `"${emptyCommandSteps[0].name}" has no command`
        : `${emptyCommandSteps.length} steps have no command`
    );
  }
  if (uniqueMissing.length > 0) {
    validationIssues.push(
      uniqueMissing.length === 1
        ? `"${uniqueMissing[0]}" used in steps but not defined as input`
        : `${uniqueMissing.length} variables used in steps but not defined as inputs`
    );
  }
  const hasErrors = validationIssues.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--dd-bg)' }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px',
        borderBottom: '1px solid var(--dd-line)',
        background: 'var(--dd-surface)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(workflow ? `/workflow/${workflow.id}` : '/workflows')} style={{ gap: 4 }}>
            <Icon name="arrow_back" size={15} />
            Back
          </button>
          <div style={{ width: 1, height: 18, background: 'var(--dd-line-2)' }} />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSidebar(!showSidebar)}
            style={{ gap: 4, color: showSidebar ? 'var(--dd-accent)' : 'var(--dd-text-3)' }}
            title={showSidebar ? 'Hide command palette' : 'Show command palette'}
          >
            <Icon name="widgets" size={15} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="account_tree" size={16} style={{ color: 'var(--dd-accent)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dd-text)' }}>
              {name || 'New Workflow'}
            </span>
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)', padding: '2px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
            {stepCount} step{stepCount !== 1 ? 's' : ''}
          </span>
          {nodes.some((n) => n.type === 'parallel') && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: 'var(--dd-accent-bright)',
              background: 'var(--dd-accent-dim)',
              borderRadius: 4, padding: '2px 8px',
            }}>
              BRANCHED
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasErrors && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 6,
              background: 'rgba(251,113,133,0.08)',
              border: '1px solid rgba(251,113,133,0.15)',
            }}>
              <Icon name="error_outline" size={14} style={{ color: 'var(--dd-red)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--dd-red)', fontWeight: 500 }}>
                {validationIssues[0]}
              </span>
              {validationIssues.length > 1 && (
                <span style={{ fontSize: 10, color: 'rgba(251,113,133,0.6)' }}>
                  +{validationIssues.length - 1} more
                </span>
              )}
            </div>
          )}
          <button className="btn btn-ghost" onClick={() => navigate(workflow ? `/workflow/${workflow.id}` : '/workflows')}>
            Discard
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={hasErrors || saving}
            style={{ opacity: hasErrors ? 0.5 : 1 }}
          >
            <Icon name="check" size={14} />
            {saving ? 'Saving...' : 'Save workflow'}
          </button>
        </div>
      </div>

      {/* Meta panel */}
      <MetaPanel
        name={name}
        description={description}
        tags={tags}
        params={params}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onTagsChange={setTags}
        onParamsChange={setParams}
        onParamRename={handleParamRename}
      />

      {/* Sidebar + Canvas + Properties split */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Command sidebar */}
        {showSidebar && <CommandSidebar onAdd={addFromTemplate} />}

        {/* Flow canvas */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dd-text-4)' }}>
            Loading...
          </div>
        ) : (
          <div className="flow-canvas" style={{ flex: 1 }} onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedNodeId(null);
              setSelectedBranchStep(null);
            }
          }}>
            <TerminalNode label="Start" icon="play_circle" color="var(--dd-green)" />

            <FlowConnector
              onAddStep={() => addStepAt(0)}
              onAddParallel={() => addParallelAt(0)}
            />

            {nodes.map((node, i) => (
              <div key={node.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                {node.type === 'step' && node.step ? (
                  <StepNodeCard
                    step={node.step}
                    index={i}
                    selected={selectedNodeId === node.id}
                    missingParams={getMissingParams(node.step.command)}
                    onSelect={() => { setSelectedNodeId(node.id); setSelectedBranchStep(null); }}
                    onRemove={() => removeNode(i)}
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; handleDragStart(i); }}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(i)}
                    isDragging={dragIdx === i}
                    isDragOver={dragOverIdx === i}
                  />
                ) : node.type === 'parallel' && node.branches ? (
                  <ParallelNodeCard
                    conditionVar={node.conditionVar ?? ''}
                    branches={node.branches}
                    onConditionVarChange={(v) => {
                      const next = [...nodes];
                      next[i] = { ...next[i], conditionVar: v };
                      setNodes(next);
                    }}
                    onChange={(b) => updateParallelNode(i, b)}
                    onRemove={() => removeNode(i)}
                    onSelectStep={(_step, nodeId, branchIdx, stepIdx) => {
                      setSelectedNodeId(null);
                      setSelectedBranchStep({ nodeId, branchIdx, stepIdx });
                    }}
                    selectedStepId={selectedBranchStep ? nodes.find((n) => n.type === 'parallel' && n.branches?.some((b) => b.id === selectedBranchStep.nodeId))?.branches?.[selectedBranchStep.branchIdx]?.steps[selectedBranchStep.stepIdx]?.id ?? null : null}
                  />
                ) : null}

                <FlowConnector
                  onAddStep={() => addStepAt(i + 1)}
                  onAddParallel={() => addParallelAt(i + 1)}
                />
              </div>
            ))}

            <TerminalNode label="End" icon="stop_circle" color="var(--dd-red)" />
            <div style={{ height: 60 }} />
          </div>
        )}

        {/* Properties panel */}
        {selectedStep && (
          <PropertiesPanel
            step={selectedStep}
            onChange={updateSelectedStep}
            onClose={() => { setSelectedNodeId(null); setSelectedBranchStep(null); }}
          />
        )}
      </div>
    </div>
  );
}
