import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Titlebar, Sidebar, StatusBar, Icon, Badge, Glyph, Tag, Kbd } from '../components';
import { useWorkflows } from '../hooks/useWorkflows';
import { useProcesses } from '../hooks/useProcesses';
import { getWorkflow, saveWorkflow } from '../api';
import type { Workflow } from '../types';

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
}: {
  step: LocalStep;
  expanded: boolean;
  onToggle: () => void;
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
          <input className="input" defaultValue={step.name} />

          <span style={{ fontSize: 12, color: 'var(--dd-text-2)' }}>Type</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['shell', 'node', 'http'] as const).map((t) => (
              <button
                key={t}
                className="btn btn-sm"
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
          <input className="input mono" style={{ fontSize: 12 }} defaultValue={step.cmd} />

          <span style={{ fontSize: 12, color: 'var(--dd-text-2)' }}>Workdir</span>
          <input className="input mono" style={{ fontSize: 12 }} defaultValue={step.wd} />

          <span style={{ fontSize: 12, color: 'var(--dd-text-2)' }}>Timeout</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input mono"
              style={{ fontSize: 12, width: 100 }}
              defaultValue={step.timeout}
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
            <button className="btn btn-ghost btn-sm">
              <Icon name="content_copy" size={12} />
              Duplicate
            </button>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--dd-red)' }}>
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

function FormMode({ workflow }: { workflow: Workflow | null }) {
  const defaultSteps: LocalStep[] = workflow
    ? workflow.steps.map((s, i) => ({
        id: i + 1,
        name: s.name,
        cmd: s.command,
        wd: s.workdir ?? '/',
        type: 'shell',
        timeout: s.timeout ? `${s.timeout}s` : '30s',
        onFail: s.on_failure === 'continue' ? 'continue' : s.on_failure?.startsWith('retry') ? 'retry' : 'abort',
      }))
    : [
        { id: 1, name: 'Verify clean git tree', cmd: 'git status --porcelain', wd: '/', type: 'shell', timeout: '30s', onFail: 'abort' },
        { id: 2, name: 'Install dependencies', cmd: 'npm ci --prefer-offline', wd: '~/app', type: 'shell', timeout: '5m', onFail: 'abort' },
        { id: 3, name: 'Run unit tests', cmd: 'npm test -- --coverage', wd: '~/app', type: 'shell', timeout: '10m', onFail: 'abort' },
        { id: 4, name: 'Build production bundle', cmd: 'npm run build:staging', wd: '~/app', type: 'shell', timeout: '5m', onFail: 'abort' },
        { id: 5, name: 'Push to staging cluster', cmd: 'kubectl apply -f "k8s/staging"', wd: '~/infra', type: 'shell', timeout: '5m', onFail: 'retry' },
        { id: 6, name: 'Notify Slack channel', cmd: 'curl -X POST $SLACK_HOOK', wd: '/', type: 'shell', timeout: '30s', onFail: 'continue' },
      ];

  const [steps] = useState<LocalStep[]>(defaultSteps);
  const [expanded, setExpanded] = useState<number | null>(4);

  const params = workflow?.params ?? [
    { name: 'branch', type: 'text' as const, label: 'Branch', default: 'main', required: true },
    { name: 'skip_tests', type: 'toggle' as const, label: 'Skip tests', default: 'false', required: false },
    { name: 'region', type: 'select' as const, label: 'Region', default: 'us-east-1', required: true },
  ];

  const colorOptions = [
    'var(--dd-red)',
    'var(--dd-amber)',
    'var(--dd-green)',
    'var(--dd-blue)',
    'var(--dd-purple)',
    'var(--dd-cyan)',
  ];

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
          defaultValue={workflow?.name ?? 'Deploy to staging'}
          style={{ maxWidth: 400 }}
        />

        <FormLabel>Description</FormLabel>
        <textarea
          className="input"
          rows={2}
          style={{ resize: 'vertical', maxWidth: 560 }}
          defaultValue={
            workflow?.description ??
            'Builds the app, runs smoke tests, and pushes to staging cluster. Notifies #deploys on completion.'
          }
        />

        <FormLabel>Icon &amp; color</FormLabel>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Glyph ch={workflow?.icon ?? 'D'} color="var(--dd-amber)" />
          <input
            className="input mono"
            defaultValue={workflow?.icon ?? 'D'}
            style={{ width: 44, textAlign: 'center' }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {colorOptions.map((c) => (
              <button
                key={c}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  border:
                    c === 'var(--dd-amber)'
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
          {(workflow?.tags ?? ['deploy', 'staging']).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '2px 6px', fontSize: 11 }}
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
            Drag to reorder · steps run sequentially, top-to-bottom
          </div>
        </div>
        <button className="btn btn-secondary btn-sm">
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
        <button className="btn btn-secondary btn-sm">
          <Icon name="add" size={13} />
          Add parameter
        </button>
      </div>

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
              <Icon name="more_horiz" size={14} style={{ color: 'var(--dd-text-4)' }} />
            </div>
            <div
              style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--dd-text-3)' }}
            >
              <span style={{ color: 'var(--dd-purple)' }}>{p.type}</span>
              <span style={{ color: 'var(--dd-text-4)' }}>·</span>
              <span className="mono">default = {p.default}</span>
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

      <div style={{ height: 24 }} />
    </div>
  );
}

// ── Code lines definition ──────────────────────────────────────────────────

interface CodeLine {
  c?: string;
  t: string;
  s?: string;
  k?: string;
  tail?: string;
  s2?: string;
  k2?: string;
  tail2?: string;
  s3?: string;
  k3?: string;
  tail3?: string;
}

const CODE_LINES: CodeLine[] = [
  { c: 'comment', t: '// workflows/deploy-staging.js' },
  { c: 'comment', t: '// Builds the app, runs smoke tests, deploys to staging.' },
  { t: '' },
  { t: 'export default {' },
  { t: "  name: ", s: "'Deploy to staging'", k: 'str', tail: ',' },
  { t: "  description: ", s: "'Builds + runs smoke tests + push to staging cluster.'", k: 'str', tail: ',' },
  { t: "  icon: ", s: "'D'", k: 'str', tail: ', color: ', s2: "'amber'", k2: 'str', tail2: ',' },
  { t: "  tags: [", s: "'deploy'", k: 'str', tail: ', ', s2: "'staging'", k2: 'str', tail2: '],' },
  { t: '' },
  { t: '  params: {' },
  { t: "    branch:     { type: ", s: "'text'", k: 'str', tail: ',   default: ', s2: "'main'", k2: 'str', tail2: ', required: ', s3: 'true', k3: 'kw', tail3: ' },' },
  { t: "    skip_tests: { type: ", s: "'toggle'", k: 'str', tail: ', default: ', s2: 'false', k2: 'kw', tail2: ' },' },
  { t: "    region:     { type: ", s: "'select'", k: 'str', tail: ', options: [', s2: "'us-east-1'", k2: 'str', tail2: ", 'eu-west-1', 'ap-south-1'] }," },
  { t: '  },' },
  { t: '' },
  { t: '  steps: [' },
  { t: '    {' },
  { t: "      name: ", s: "'Verify clean git tree'", k: 'str', tail: ',' },
  { t: "      run:  ", s: "'git status --porcelain'", k: 'str', tail: ',' },
  { t: "      onFail: ", s: "'abort'", k: 'str', tail: ',' },
  { t: '    },' },
  { t: '    {' },
  { t: "      name: ", s: "'Install dependencies'", k: 'str', tail: ',' },
  { t: "      run:  ", s: "'npm ci --prefer-offline'", k: 'str', tail: ',' },
  { t: "      cwd:  ", s: "'~/app'", k: 'str', tail: ', timeout: ', s2: "'5m'", k2: 'str', tail2: ',' },
  { t: '    },' },
  { t: '    {' },
  { t: "      name: ", s: "'Build production bundle'", k: 'str', tail: ',' },
  { t: "      run:  ", s: '`npm run build:${params.region}`', k: 'tpl', tail: ',' },
  { t: "      cwd:  ", s: "'~/app'", k: 'str', tail: ', timeout: ', s2: "'5m'", k2: 'str', tail2: ',' },
  { t: '    },' },
  { t: '    {' },
  { t: "      name: ", s: "'Push to staging cluster'", k: 'str', tail: ',' },
  { t: "      run:  ", s: "'kubectl apply -f k8s/staging'", k: 'str', tail: ',' },
  { t: "      cwd:  ", s: "'~/infra'", k: 'str', tail: ", onFail: ", s2: "'retry'", k2: 'str', tail2: ',' },
  { t: '    },' },
  { t: '    // …' },
  { t: '  ],' },
  { t: '};' },
];

const CURSOR_LINE = 27;

function colorize(k?: string): string {
  if (k === 'str') return 'var(--dd-green)';
  if (k === 'kw') return 'var(--dd-purple)';
  if (k === 'tpl') return 'var(--dd-cyan)';
  return 'var(--dd-text)';
}

// ── CodeMode ───────────────────────────────────────────────────────────────

function CodeMode() {
  const outlineItems = [
    { l: 0, name: 'name', kind: 'property' },
    { l: 0, name: 'description', kind: 'property' },
    { l: 0, name: 'tags[]', kind: 'array' },
    { l: 0, name: 'params', kind: 'object' },
    { l: 1, name: 'branch', kind: 'property' },
    { l: 1, name: 'skip_tests', kind: 'property' },
    { l: 1, name: 'region', kind: 'property' },
    { l: 0, name: 'steps[]', kind: 'array' },
    { l: 1, name: 'Verify clean git tree', kind: 'step' },
    { l: 1, name: 'Install dependencies', kind: 'step' },
    { l: 1, name: 'Run unit tests', kind: 'step' },
    { l: 1, name: 'Build production bundle', kind: 'step', active: true },
    { l: 1, name: 'Push to staging cluster', kind: 'step' },
    { l: 1, name: 'Notify Slack channel', kind: 'step' },
  ] as const;

  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 280px',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      {/* Editor */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#07070a',
          overflow: 'hidden',
        }}
      >
        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--dd-surface)',
            borderBottom: '1px solid var(--dd-line)',
            fontSize: 12,
          }}
        >
          <div
            style={{
              padding: '6px 14px',
              background: '#07070a',
              borderRight: '1px solid var(--dd-line)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--dd-text)',
            }}
          >
            <Icon name="javascript" size={14} style={{ color: 'var(--dd-amber)' }} />
            <span className="mono">deploy-staging.js</span>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: 'var(--dd-text-3)',
              }}
            />
          </div>
          <span style={{ flex: 1 }} />
          <span
            className="mono"
            style={{ fontSize: 11, color: 'var(--dd-text-4)', padding: '6px 12px' }}
          >
            JavaScript · LF · UTF-8 · spaces 2
          </span>
        </div>

        {/* Code area */}
        <div
          className="mono"
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            fontSize: 12,
            lineHeight: '20px',
          }}
        >
          {/* Gutter */}
          <div
            style={{
              background: '#07070a',
              color: 'var(--dd-text-4)',
              padding: '12px 10px 12px 14px',
              textAlign: 'right',
              userSelect: 'none',
              borderRight: '1px solid var(--dd-line)',
              minWidth: 38,
            }}
          >
            {CODE_LINES.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Lines */}
          <div style={{ padding: '12px 14px', flex: 1, position: 'relative' }}>
            {CODE_LINES.map((line, i) => (
              <div
                key={i}
                style={{
                  background: i === CURSOR_LINE ? 'rgba(96,165,250,0.06)' : 'transparent',
                  margin: i === CURSOR_LINE ? '0 -14px' : 0,
                  padding: i === CURSOR_LINE ? '0 14px' : 0,
                  position: 'relative',
                }}
              >
                {line.c === 'comment' ? (
                  <span style={{ color: 'var(--dd-text-4)', fontStyle: 'italic' }}>{line.t}</span>
                ) : (
                  <>
                    <span style={{ color: 'var(--dd-text)' }}>{line.t}</span>
                    {line.s && (
                      <span style={{ color: colorize(line.k) }}>{line.s}</span>
                    )}
                    {line.tail && (
                      <span style={{ color: 'var(--dd-text)' }}>{line.tail}</span>
                    )}
                    {line.s2 && (
                      <span style={{ color: colorize(line.k2) }}>{line.s2}</span>
                    )}
                    {line.tail2 && (
                      <span style={{ color: 'var(--dd-text)' }}>{line.tail2}</span>
                    )}
                    {line.s3 && (
                      <span style={{ color: colorize(line.k3) }}>{line.s3}</span>
                    )}
                    {line.tail3 && (
                      <span style={{ color: 'var(--dd-text)' }}>{line.tail3}</span>
                    )}
                    {i === CURSOR_LINE && (
                      <span
                        className="term-cursor"
                        style={{ background: 'var(--dd-blue)', marginLeft: 2 }}
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Editor status bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 14px',
            borderTop: '1px solid var(--dd-line)',
            background: 'var(--dd-surface)',
            fontSize: 11,
            color: 'var(--dd-text-4)',
            fontFamily: 'var(--font-mono)',
            gap: 16,
          }}
        >
          <span>
            <Icon
              name="check_circle"
              size={11}
              style={{ color: 'var(--dd-green)', verticalAlign: '-1px', marginRight: 4 }}
            />
            no problems
          </span>
          <span>Ln 28, Col 38</span>
          <span style={{ flex: 1 }} />
          <span>prettier · auto-format on save</span>
        </div>
      </div>

      {/* Outline panel */}
      <aside
        style={{
          borderLeft: '1px solid var(--dd-line)',
          background: 'var(--dd-surface-2)',
          overflow: 'auto',
          padding: 16,
          fontSize: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--dd-text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 10,
          }}
        >
          Outline
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {outlineItems.map((o, i) => (
            <div
              key={i}
              style={{
                padding: '3px 8px',
                paddingLeft: 8 + o.l * 16,
                borderRadius: 4,
                fontSize: 12,
                background: 'active' in o && o.active ? 'var(--dd-surface-3)' : 'transparent',
                color: 'active' in o && o.active ? 'var(--dd-text)' : 'var(--dd-text-2)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <Icon
                name={
                  o.kind === 'property'
                    ? 'horizontal_rule'
                    : o.kind === 'object'
                    ? 'data_object'
                    : o.kind === 'array'
                    ? 'data_array'
                    : 'play_circle'
                }
                size={12}
                style={{
                  color:
                    o.kind === 'property'
                      ? 'var(--dd-text-3)'
                      : o.kind === 'step'
                      ? 'var(--dd-blue)'
                      : 'var(--dd-purple)',
                }}
              />
              <span>{o.name}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--dd-text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: '20px 0 10px',
          }}
        >
          Available helpers
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--dd-text-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div>
            <span style={{ color: 'var(--dd-cyan)' }}>params</span>
            <span style={{ color: 'var(--dd-text-4)' }}>{'.<name>'}</span>
          </div>
          <div>
            <span style={{ color: 'var(--dd-cyan)' }}>env</span>
            <span style={{ color: 'var(--dd-text-4)' }}>{'.<KEY>'}</span>
          </div>
          <div>
            <span style={{ color: 'var(--dd-purple)' }}>shell</span>
            <span style={{ color: 'var(--dd-text-4)' }}>(cmd, opts?)</span>
          </div>
          <div>
            <span style={{ color: 'var(--dd-purple)' }}>http</span>
            <span style={{ color: 'var(--dd-text-4)' }}>(method, url, body?)</span>
          </div>
          <div>
            <span style={{ color: 'var(--dd-purple)' }}>log</span>
            <span style={{ color: 'var(--dd-text-4)' }}>(level, msg)</span>
          </div>
          <div>
            <span style={{ color: 'var(--dd-purple)' }}>prompt</span>
            <span style={{ color: 'var(--dd-text-4)' }}>(question)</span>
          </div>
        </div>
      </aside>
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
  const [mode, setMode] = useState<'form' | 'code'>('form');
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [unsaved] = useState(true);

  const { workflows } = useWorkflows();
  const { processes } = useProcesses();

  useEffect(() => {
    if (id && id !== 'new') {
      getWorkflow(id).catch(() => null).then((wf) => {
        if (wf) setWorkflow(wf);
      });
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
                  onClick={() => setMode('code')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: 0,
                    cursor: 'pointer',
                    background: mode === 'code' ? 'var(--dd-bg)' : 'transparent',
                    color: mode === 'code' ? 'var(--dd-text)' : 'var(--dd-text-3)',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="code" size={13} />
                  Code
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
                    if (workflow) {
                      saveWorkflow(workflow.id, {
                        name: workflow.name,
                        steps: workflow.steps,
                        description: workflow.description,
                        icon: workflow.icon,
                        tags: workflow.tags,
                        params: workflow.params,
                      }).catch(console.error);
                    }
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
          {mode === 'form' ? <FormMode workflow={workflow} /> : <CodeMode />}
        </main>

        <StatusBar processCount={processes.length} activeRuns={activeRuns} />
      </div>
    </div>
  );
}
