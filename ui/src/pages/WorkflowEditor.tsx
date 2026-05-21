import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Titlebar, Sidebar, StatusBar, Icon, Badge, Glyph, Tag, Kbd } from '../components';
import { useWorkflows } from '../hooks/useWorkflows';
import { useProcesses } from '../hooks/useProcesses';
import { getWorkflow, saveWorkflow } from '../api';
import type { Workflow, WorkflowParam } from '../types';

// ── Types local to editor ──────────────────────────────────────────────────

interface LocalStep {
  id: number;
  name: string;
  cmd: string;
  wd: string;
  type: 'shell' | 'node' | 'http';
  timeout: string;
  onFail: 'abort' | 'retry' | 'continue';
}

// ── FormLabel ──────────────────────────────────────────────────────────────

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, color: 'var(--dd-text-2)', paddingTop: 7, fontWeight: 500 }}>
      {children}
    </label>
  );
}

// ── StepCard ───────────────────────────────────────────────────────────────

function StepCard({
  step,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
}: {
  step: LocalStep;
  expanded: boolean;
  onToggle: () => void;
  onUpdate?: (patch: Partial<LocalStep>) => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className="card"
      style={{ overflow: 'hidden', borderColor: expanded ? 'var(--dd-line-2)' : 'var(--dd-line)' }}
    >
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}
      >
        <Icon name="drag_indicator" size={16} style={{ color: 'var(--dd-text-4)' }} />
        <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)', minWidth: 18 }}>
          {String(step.id).padStart(2, '0')}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dd-text)' }}>{step.name}</div>
          {!expanded && (
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--dd-text-3)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: 'var(--dd-text-4)' }}>$ </span>
              {step.cmd}
            </div>
          )}
        </div>
        <span className="badge pending" style={{ fontSize: 10 }}>
          <span className="dot" style={{ background: 'var(--dd-purple)' }} />
          {step.type}
        </span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>
          {step.timeout}
        </span>
        <Icon
          name={expanded ? 'expand_less' : 'expand_more'}
          size={16}
          style={{ color: 'var(--dd-text-3)' }}
        />
      </div>

      {expanded && (
        <div
          style={{
            padding: '12px 16px 16px 50px',
            borderTop: '1px solid var(--dd-line)',
            display: 'grid',
            gridTemplateColumns: '110px 1fr',
            columnGap: 16,
            rowGap: 12,
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--dd-text-2)' }}>Name</span>
          <input className="input" value={step.name} onChange={(e) => onUpdate?.({ name: e.target.value })} />

          <span style={{ fontSize: 12, color: 'var(--dd-text-2)' }}>Type</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['shell', 'node', 'http'] as const).map((t) => (
              <button
                key={t}
                className="btn btn-sm"
                onClick={() => onUpdate?.({ type: t })}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  background: t === step.type ? 'var(--dd-surface-3)' : 'transparent',
                  border:
                    t === step.type ? '1px solid var(--dd-blue)' : '1px solid var(--dd-line)',
                  color: t === step.type ? 'var(--dd-text)' : 'var(--dd-text-3)',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <span style={{ fontSize: 12, color: 'var(--dd-text-2)' }}>Command</span>
          <input className="input mono" style={{ fontSize: 12 }} value={step.cmd} onChange={(e) => onUpdate?.({ cmd: e.target.value })} />

          <span style={{ fontSize: 12, color: 'var(--dd-text-2)' }}>Workdir</span>
          <input className="input mono" style={{ fontSize: 12 }} value={step.wd} onChange={(e) => onUpdate?.({ wd: e.target.value })} />

          <span style={{ fontSize: 12, color: 'var(--dd-text-2)' }}>Timeout</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input mono"
              style={{ fontSize: 12, width: 100 }}
              value={step.timeout}
              onChange={(e) => onUpdate?.({ timeout: e.target.value })}
            />
            <span style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>kills step if exceeded</span>
          </div>

          <span style={{ fontSize: 12, color: 'var(--dd-text-2)' }}>On failure</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(
              [
                { v: 'abort', c: 'var(--dd-red)', label: 'Abort workflow' },
                { v: 'retry', c: 'var(--dd-amber)', label: 'Retry (3x)' },
                { v: 'continue', c: 'var(--dd-text-2)', label: 'Continue' },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                className="btn btn-sm"
                onClick={() => onUpdate?.({ onFail: o.v })}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  background: o.v === step.onFail ? `${o.c}1a` : 'transparent',
                  border:
                    o.v === step.onFail ? `1px solid ${o.c}66` : '1px solid var(--dd-line)',
                  color: o.v === step.onFail ? o.c : 'var(--dd-text-3)',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div />
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--dd-red)' }} onClick={onRemove}>
              <Icon name="delete_outline" size={12} />
              Remove step
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FormMode ───────────────────────────────────────────────────────────────

interface FormModeProps {
  workflow: Workflow | null;
  formStateRef: React.MutableRefObject<{
    name: string;
    description: string;
    icon: string;
    color: string;
    tags: string[];
    params: WorkflowParam[];
    steps: LocalStep[];
  }>;
}

function workflowToSteps(wf: Workflow | null): LocalStep[] {
  if (!wf) return [];
  return wf.steps.map((s, i) => ({
    id: i + 1,
    name: s.name,
    cmd: s.command,
    wd: s.workdir ?? '/',
    type: 'shell' as const,
    timeout: s.timeout ? `${s.timeout}s` : '30s',
    onFail: (s.on_failure === 'continue' ? 'continue' : s.on_failure?.startsWith('retry') ? 'retry' : 'abort') as 'abort' | 'retry' | 'continue',
  }));
}

function FormMode({ workflow, formStateRef }: FormModeProps) {
  const [name, setName] = useState(workflow?.name ?? '');
  const [description, setDescription] = useState(workflow?.description ?? '');
  const [icon, setIconVal] = useState(workflow?.icon ?? 'W');
  const [selectedColor, setSelectedColor] = useState('var(--dd-blue)');
  const [tags, setTags] = useState<string[]>(workflow?.tags ?? []);
  const [params, setParams] = useState<WorkflowParam[]>(workflow?.params ?? []);
  const [steps, setSteps] = useState<LocalStep[]>(workflowToSteps(workflow));
  const [expanded, setExpanded] = useState<number | null>(null);

  // Reset form state when workflow loads (fixes empty editor on first load)
  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description ?? '');
      setIconVal(workflow.icon ?? 'W');
      setTags(workflow.tags ?? []);
      setParams(workflow.params ?? []);
      setSteps(workflowToSteps(workflow));
    }
  }, [workflow]);

  // Keep formStateRef in sync so the parent Save button can read current values
  useEffect(() => {
    formStateRef.current = { name, description, icon, color: selectedColor, tags, params, steps };
  }, [name, description, icon, selectedColor, tags, params, steps, formStateRef]);

  const colorOptions = [
    'var(--dd-red)',
    'var(--dd-amber)',
    'var(--dd-green)',
    'var(--dd-blue)',
    'var(--dd-purple)',
    'var(--dd-cyan)',
  ];

  function addStep() {
    const nextId = steps.length > 0 ? Math.max(...steps.map((s) => s.id)) + 1 : 1;
    setSteps([
      ...steps,
      {
        id: nextId,
        name: `Step ${nextId}`,
        cmd: '',
        wd: '/',
        type: 'shell',
        timeout: '30s',
        onFail: 'abort',
      },
    ]);
    setExpanded(nextId);
  }

  function removeStep(id: number) {
    setSteps(steps.filter((s) => s.id !== id));
  }

  function updateStep(id: number, patch: Partial<LocalStep>) {
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addParam() {
    const paramName = prompt('Parameter name:');
    if (!paramName || !paramName.trim()) return;
    const trimmedName = paramName.trim();
    if (params.some((p) => p.name === trimmedName)) {
      alert('A parameter with that name already exists.');
      return;
    }
    const typeInput = prompt('Type (text / select / toggle):', 'text');
    const paramType = (['text', 'select', 'toggle'].includes(typeInput ?? '') ? typeInput : 'text') as 'text' | 'select' | 'toggle';
    const defaultVal = prompt('Default value (leave empty for none):', '') ?? '';
    setParams([
      ...params,
      {
        name: trimmedName,
        label: trimmedName,
        type: paramType,
        default: defaultVal || undefined,
        required: false,
      },
    ]);
  }

  function removeParam(paramName: string) {
    setParams(params.filter((p) => p.name !== paramName));
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>
      {/* Metadata grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '120px 1fr',
          columnGap: 24,
          rowGap: 16,
          marginBottom: 24,
          alignItems: 'start',
          maxWidth: 920,
        }}
      >
        <FormLabel>Name</FormLabel>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workflow name"
          style={{ maxWidth: 400 }}
        />

        <FormLabel>Description</FormLabel>
        <textarea
          className="input"
          rows={2}
          style={{ resize: 'vertical', maxWidth: 560 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this workflow does"
        />

        <FormLabel>Icon &amp; color</FormLabel>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Glyph ch={icon || 'W'} color={selectedColor} />
          <input
            className="input mono"
            value={icon}
            onChange={(e) => setIconVal(e.target.value.slice(0, 2))}
            style={{ width: 44, textAlign: 'center' }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {colorOptions.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  border:
                    c === selectedColor
                      ? '2px solid var(--dd-text)'
                      : '1px solid var(--dd-line)',
                  background: c,
                  padding: 0,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>

        <FormLabel>Tags</FormLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {tags.map((tag) => (
            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Tag>{tag}</Tag>
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: '0 2px', fontSize: 10, color: 'var(--dd-text-4)' }}
                onClick={() => setTags(tags.filter((t) => t !== tag))}
              >
                x
              </button>
            </span>
          ))}
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '2px 6px', fontSize: 11 }}
            onClick={() => {
              const tag = prompt('Enter tag name:');
              if (tag && tag.trim() && !tags.includes(tag.trim())) {
                setTags([...tags, tag.trim()]);
              }
            }}
          >
            <Icon name="add" size={11} />
            Add tag
          </button>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--dd-line)', margin: '4px 0 18px' }} />

      {/* Steps section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Steps</div>
          <div style={{ fontSize: 12, color: 'var(--dd-text-3)' }}>
            {steps.length > 0
              ? 'Drag to reorder · steps run sequentially, top-to-bottom'
              : 'No steps yet. Add a step to define what this workflow does.'}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={addStep}>
          <Icon name="add" size={13} />
          Add step
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 920 }}>
        {steps.map((s) => (
          <StepCard
            key={s.id}
            step={s}
            expanded={expanded === s.id}
            onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
            onUpdate={(patch) => updateStep(s.id, patch)}
            onRemove={() => removeStep(s.id)}
          />
        ))}
      </div>

      {/* Parameters section */}
      <div
        style={{
          marginTop: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Parameters</div>
          <div style={{ fontSize: 12, color: 'var(--dd-text-3)' }}>
            Shown in the run modal when a user triggers this workflow
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={addParam}>
          <Icon name="add" size={13} />
          Add parameter
        </button>
      </div>

      {params.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--dd-text-4)', padding: '12px 0' }}>
          No parameters defined. Add parameters to prompt for input at runtime.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
            maxWidth: 920,
          }}
        >
          {params.map((p) => (
            <div key={p.name} className="card" style={{ padding: '10px 12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <span className="mono" style={{ fontSize: 12, color: 'var(--dd-text)' }}>
                  {p.name}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '0 2px', color: 'var(--dd-text-4)' }}
                  onClick={() => removeParam(p.name)}
                  title="Remove parameter"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
              <div
                style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--dd-text-3)' }}
              >
                <span style={{ color: 'var(--dd-purple)' }}>{p.type}</span>
                <span style={{ color: 'var(--dd-text-4)' }}>·</span>
                <span className="mono">default = {p.default ?? '(none)'}</span>
                {p.required && (
                  <>
                    <span style={{ color: 'var(--dd-text-4)' }}>·</span>
                    <span style={{ color: 'var(--dd-amber)' }}>required</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}

// ── CodeMode ───────────────────────────────────────────────────────────────

function workflowToYaml(wf: Workflow | null, formState?: { name: string; description: string; tags: string[]; params: WorkflowParam[]; steps: LocalStep[] }): string {
  if (!wf && !formState) return '# No workflow loaded';

  const lines: string[] = [];
  const name = formState?.name ?? wf?.name ?? '';
  const description = formState?.description ?? wf?.description ?? '';
  const tags = formState?.tags ?? wf?.tags ?? [];
  const params = formState?.params ?? wf?.params ?? [];

  lines.push(`# ${name}`);
  lines.push('');
  lines.push(`name: "${name}"`);
  if (description) {
    lines.push(`description: "${description}"`);
  }
  if (wf?.source) {
    lines.push(`source: ${wf.source}`);
  }
  if (tags.length > 0) {
    lines.push('tags:');
    tags.forEach((t) => lines.push(`  - "${t}"`));
  }

  if (params.length > 0) {
    lines.push('');
    lines.push('params:');
    params.forEach((p) => {
      lines.push(`  - name: "${p.name}"`);
      lines.push(`    type: ${p.type}`);
      if (p.label) lines.push(`    label: "${p.label}"`);
      if (p.default !== undefined) lines.push(`    default: "${p.default}"`);
      if (p.required) lines.push('    required: true');
    });
  }

  lines.push('');
  lines.push('steps:');

  if (formState?.steps) {
    formState.steps.forEach((s) => {
      lines.push(`  - name: "${s.name}"`);
      lines.push(`    command: "${s.cmd}"`);
      if (s.wd && s.wd !== '/') lines.push(`    workdir: "${s.wd}"`);
      lines.push(`    type: shell`);
      lines.push(`    timeout: ${parseInt(s.timeout) || 30}`);
      if (s.onFail !== 'abort') lines.push(`    on_failure: ${s.onFail === 'retry' ? 'retry:3' : 'continue'}`);
    });
  } else if (wf) {
    wf.steps.forEach((s) => {
      lines.push(`  - name: "${s.name}"`);
      lines.push(`    command: "${s.command}"`);
      if (s.workdir) lines.push(`    workdir: "${s.workdir}"`);
      lines.push(`    type: ${s.type}`);
      if (s.timeout) lines.push(`    timeout: ${s.timeout}`);
      if (s.on_failure && s.on_failure !== 'stop') lines.push(`    on_failure: ${s.on_failure}`);
      if (s.env && Object.keys(s.env).length > 0) {
        lines.push('    env:');
        Object.entries(s.env).forEach(([k, v]) => lines.push(`      ${k}: "${v}"`));
      }
    });
  }

  return lines.join('\n');
}

type TokenKind = 'key' | 'string' | 'comment' | 'plain' | 'keyword';

function tokenizeLine(line: string): Array<{ kind: TokenKind; text: string }> {
  // Comment lines
  if (line.trimStart().startsWith('#')) {
    const indent = line.match(/^(\s*)/)?.[0] ?? '';
    return [
      { kind: 'plain', text: indent },
      { kind: 'comment', text: line.trimStart() },
    ];
  }

  const tokens: Array<{ kind: TokenKind; text: string }> = [];
  // Check for key: value pattern
  const keyMatch = line.match(/^(\s*-?\s*)([a-zA-Z_][a-zA-Z0-9_]*)(:)(.*)/);
  if (keyMatch) {
    tokens.push({ kind: 'plain', text: keyMatch[1] });
    tokens.push({ kind: 'key', text: keyMatch[2] });
    tokens.push({ kind: 'plain', text: keyMatch[3] });
    const rest = keyMatch[4];
    if (rest) {
      // Check if value is a quoted string
      const strMatch = rest.match(/^(\s*)(\"[^\"]*\"|'[^']*')(.*)/);
      if (strMatch) {
        tokens.push({ kind: 'plain', text: strMatch[1] });
        tokens.push({ kind: 'string', text: strMatch[2] });
        if (strMatch[3]) tokens.push({ kind: 'plain', text: strMatch[3] });
      } else {
        // Check for keywords (true, false, null) or numbers
        const kwMatch = rest.match(/^(\s*)(true|false|null|\d+)(\s*.*)/);
        if (kwMatch) {
          tokens.push({ kind: 'plain', text: kwMatch[1] });
          tokens.push({ kind: 'keyword', text: kwMatch[2] });
          if (kwMatch[3]) tokens.push({ kind: 'plain', text: kwMatch[3] });
        } else {
          tokens.push({ kind: 'plain', text: rest });
        }
      }
    }
    return tokens;
  }

  // List items with string values: - "value"
  const listStrMatch = line.match(/^(\s*-\s*)(\"[^\"]*\"|'[^']*')(.*)/);
  if (listStrMatch) {
    tokens.push({ kind: 'plain', text: listStrMatch[1] });
    tokens.push({ kind: 'string', text: listStrMatch[2] });
    if (listStrMatch[3]) tokens.push({ kind: 'plain', text: listStrMatch[3] });
    return tokens;
  }

  return [{ kind: 'plain', text: line }];
}

const TOKEN_COLORS: Record<TokenKind, string> = {
  key: '#e2e8f0',
  string: '#86efac',
  comment: '#64748b',
  plain: '#94a3b8',
  keyword: '#93c5fd',
};

const SAMPLE_YAML = `# Sample DevDash Workflow
name: "My Workflow"
description: "What this workflow does"
icon: "W"
tags:
  - "deploy"
  - "ops"

params:
  - name: "branch"
    type: text
    label: "Branch name"
    default: "main"
    required: true

steps:
  - name: "Step 1"
    command: "echo hello"
    type: run-and-done
    timeout: 30
  - name: "Step 2"
    command: "npm run build"
    workdir: "~/app"
    type: run-and-done
    timeout: 300
    on_failure: stop`;

function validateYaml(formState: { name: string; steps: LocalStep[] }): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!formState.name || !formState.name.trim()) issues.push('name is empty');
  if (formState.steps.length === 0) issues.push('no steps defined');
  formState.steps.forEach((s, i) => {
    if (!s.name || !s.name.trim()) issues.push(`step ${i + 1} has no name`);
    if (!s.cmd || !s.cmd.trim()) issues.push(`step ${i + 1} has no command`);
  });
  return { valid: issues.length === 0, issues };
}

function CodeMode({ workflow, formStateRef }: { workflow: Workflow | null; formStateRef: React.MutableRefObject<{ name: string; description: string; icon: string; color: string; tags: string[]; params: WorkflowParam[]; steps: LocalStep[] }> }) {
  const [sampleOpen, setSampleOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // JS workflows: show read-only message
  if (workflow?.source === 'js') {
    return (
      <div
        style={{
          flex: 1,
          background: '#07070a',
          padding: '32px 28px',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
          This is a JavaScript workflow.
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
          Edit the file directly:
        </div>
        <div
          style={{
            fontSize: 13,
            color: '#86efac',
            fontFamily: 'var(--font-mono)',
            background: '#0f0f14',
            padding: '10px 14px',
            borderRadius: 6,
            border: '1px solid #1e293b',
            marginTop: 4,
          }}
        >
          {workflow.file_path ?? `workflows/${workflow.id}.js`}
        </div>
      </div>
    );
  }

  // YAML or UI workflows: show YAML representation
  const yaml = workflowToYaml(workflow, formStateRef.current);
  const yamlLines = yaml.split('\n');
  const validation = validateYaml(formStateRef.current);
  const sampleLines = SAMPLE_YAML.split('\n');

  return (
    <div
      style={{
        flex: 1,
        background: '#07070a',
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        lineHeight: '20px',
        padding: '16px 0',
      }}
    >
      {yamlLines.map((line, i) => {
        const tokens = tokenizeLine(line);
        return (
          <div key={i} style={{ display: 'flex', minHeight: 20 }}>
            <span
              style={{
                display: 'inline-block',
                width: 48,
                textAlign: 'right',
                paddingRight: 16,
                color: '#334155',
                userSelect: 'none',
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <span style={{ flex: 1, whiteSpace: 'pre' }}>
              {tokens.map((tok, j) => (
                <span key={j} style={{ color: TOKEN_COLORS[tok.kind] }}>{tok.text}</span>
              ))}
            </span>
          </div>
        );
      })}

      {/* Validation hint */}
      <div
        style={{
          margin: '16px 16px 0 48px',
          padding: '8px 12px',
          borderRadius: 6,
          background: validation.valid ? '#0a1a0f' : '#1a0a0a',
          border: validation.valid ? '1px solid #16a34a33' : '1px solid #dc262633',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ color: validation.valid ? '#4ade80' : '#f87171' }}>
          {validation.valid ? '\u2713' : '\u26a0'}
        </span>
        <span style={{ color: validation.valid ? '#4ade80' : '#f87171' }}>
          {validation.valid ? 'Valid workflow' : `Issues: ${validation.issues.join(', ')}`}
        </span>
      </div>

      {/* Sample YAML section */}
      <div style={{ margin: '20px 16px 16px 48px' }}>
        <button
          onClick={() => setSampleOpen(!sampleOpen)}
          style={{
            background: 'transparent',
            border: '1px solid #1e293b',
            borderRadius: 6,
            padding: '6px 12px',
            cursor: 'pointer',
            color: '#94a3b8',
            fontSize: 12,
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 10, transform: sampleOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.15s' }}>{'\u25b6'}</span>
          Sample YAML template
        </button>

        {sampleOpen && (
          <div style={{ marginTop: 8, border: '1px solid #1e293b', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px', borderBottom: '1px solid #1e293b', background: '#0c0c12' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(SAMPLE_YAML).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  padding: '3px 10px',
                  cursor: 'pointer',
                  color: copied ? '#4ade80' : '#94a3b8',
                  fontSize: 11,
                  fontFamily: 'inherit',
                }}
              >
                {copied ? 'Copied!' : 'Copy sample'}
              </button>
            </div>
            <div style={{ padding: '8px 0', background: '#0a0a10' }}>
              {sampleLines.map((line, i) => {
                const tokens = tokenizeLine(line);
                return (
                  <div key={i} style={{ display: 'flex', minHeight: 20 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 40,
                        textAlign: 'right',
                        paddingRight: 12,
                        color: '#1e293b',
                        userSelect: 'none',
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ flex: 1, whiteSpace: 'pre' }}>
                      {tokens.map((tok, j) => (
                        <span key={j} style={{ color: TOKEN_COLORS[tok.kind] }}>{tok.text}</span>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── WorkflowEditor (main) ──────────────────────────────────────────────────

const GLYPH_COLORS_EDITOR = [
  'var(--dd-blue)',
  'var(--dd-green)',
  'var(--dd-amber)',
  'var(--dd-purple)',
  'var(--dd-cyan)',
  'var(--dd-red)',
];

export default function WorkflowEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'form' | 'yaml'>('form');
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(false);
  const [unsaved, setUnsaved] = useState(false);

  const formStateRef = useRef({
    name: '',
    description: '',
    icon: 'W',
    color: 'var(--dd-blue)',
    tags: [] as string[],
    params: [] as WorkflowParam[],
    steps: [] as LocalStep[],
  });

  const { workflows } = useWorkflows();
  const { processes } = useProcesses();

  useEffect(() => {
    if (id && id !== 'new') {
      setLoading(true);
      getWorkflow(id)
        .then((wf) => { if (wf) setWorkflow(wf); })
        .catch(() => null)
        .finally(() => setLoading(false));
    }
  }, [id]);

  const activeRuns = processes.filter((p) => p.status === 'running').length;

  const sidebarWorkflows = workflows.map((wf, i) => ({
    id: wf.id,
    name: wf.name,
    ch: (wf.name[0] ?? 'W').toUpperCase(),
    color: GLYPH_COLORS_EDITOR[i % GLYPH_COLORS_EDITOR.length],
    tags: wf.tags ?? [],
    running: false,
  }));

  return (
    <div className="dd" style={{ width: '100%', height: '100%' }}>
      <div className="app-window">
        <Titlebar path={`Edit · ${workflow?.name ?? id ?? 'new'}`} />

        <Sidebar
          workflows={sidebarWorkflows}
          activeId={id}
          onSelect={(wfId) => navigate(`/workflow/${wfId}`)}
          onCreate={() => navigate('/workflow/new/edit')}
        />

        <main
          className="main"
          style={{
            gridArea: 'main',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Page header */}
          <div className="pg-head" style={{ paddingBottom: 12, flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 4,
                  }}
                >
                  <Icon name="edit" size={16} style={{ color: 'var(--dd-text-3)' }} />
                  <h1 style={{ fontSize: 16 }}>
                    Editing{' '}
                    <span className="mono" style={{ color: 'var(--dd-blue)' }}>
                      {id ?? 'new'}
                    </span>
                  </h1>
                  {unsaved && (
                    <Badge kind="info">
                      <Icon
                        name="circle"
                        size={6}
                        fill
                        style={{ color: 'var(--dd-amber)' }}
                      />
                      Unsaved
                    </Badge>
                  )}
                </div>
                <p className="sub">
                  Saved to{' '}
                  <span className="mono">
                    workflows/{id ?? 'new'}.js
                  </span>{' '}
                  · changes apply on next run
                </p>
              </div>

              {/* Mode toggle */}
              <div
                style={{
                  display: 'inline-flex',
                  background: 'var(--dd-surface-3)',
                  border: '1px solid var(--dd-line-2)',
                  borderRadius: 6,
                  padding: 2,
                  fontSize: 12,
                }}
              >
                <button
                  onClick={() => setMode('form')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: 0,
                    cursor: 'pointer',
                    background: mode === 'form' ? 'var(--dd-bg)' : 'transparent',
                    color: mode === 'form' ? 'var(--dd-text)' : 'var(--dd-text-3)',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="view_list" size={13} />
                  Form
                </button>
                <button
                  onClick={() => setMode('yaml')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: 0,
                    cursor: 'pointer',
                    background: mode === 'yaml' ? 'var(--dd-bg)' : 'transparent',
                    color: mode === 'yaml' ? 'var(--dd-text)' : 'var(--dd-text-3)',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="code" size={13} />
                  {workflow?.source === 'js' ? 'JS' : 'YAML'}
                </button>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-ghost" onClick={() => navigate(-1)}>
                  Discard
                </button>
                <button className="btn btn-secondary">
                  <Icon name="science" size={14} />
                  Test run
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const fs = formStateRef.current;
                    const wfId = workflow?.id ?? id ?? 'new';
                    // Convert LocalStep[] back to WorkflowStep[]
                    const stepsPayload = fs.steps.map((s) => ({
                      name: s.name,
                      command: s.cmd,
                      workdir: s.wd || undefined,
                      type: 'run-and-done' as const,
                      timeout: parseInt(s.timeout) || 30,
                      on_failure: s.onFail === 'retry' ? ('retry:3' as const) : s.onFail === 'continue' ? ('continue' as const) : ('stop' as const),
                    }));
                    saveWorkflow(wfId, {
                      name: fs.name,
                      steps: stepsPayload,
                      description: fs.description || undefined,
                      icon: fs.icon || undefined,
                      tags: fs.tags.length > 0 ? fs.tags : undefined,
                      params: fs.params.length > 0 ? fs.params : undefined,
                    }).then(() => {
                      setUnsaved(false);
                    }).catch(console.error);
                    navigate(-1);
                  }}
                >
                  <Icon name="check" size={14} />
                  Save
                  <span style={{ marginLeft: 6, opacity: 0.6 }}>
                    <Kbd>⌘S</Kbd>
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Mode content */}
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dd-text-4)', fontSize: 13 }}>
              Loading workflow...
            </div>
          ) : mode === 'form' ? <FormMode workflow={workflow} formStateRef={formStateRef} /> : <CodeMode workflow={workflow} formStateRef={formStateRef} />}

        </main>

        <StatusBar processCount={processes.length} activeRuns={activeRuns} />
      </div>
    </div>
  );
}
