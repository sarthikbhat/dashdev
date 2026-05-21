import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../api';
import { useSocket } from '../hooks/useSocket';
import type { RunWithSteps, RunStep, StepStatus, RunStatus } from '../types';
import Icon from './Icon';
import Glyph from './Glyph';
import Badge from './Badge';
import Spinner from './Spinner';
import Titlebar from './Titlebar';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';

interface Props {
  runId: string;
  workflowName: string;
  workflowIcon?: { ch: string; color: string };
  onCancel: () => void;
  onBack: () => void;
}

interface LogLine {
  ts: string;
  kind: 'prompt' | 'info' | 'warn' | 'err' | 'dim' | '';
  text: string;
  stepIndex: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function formatElapsed(startedAt: string): string {
  const diff = Date.now() - new Date(startedAt).getTime();
  return formatDuration(diff);
}

function stepStateFromStatus(status: StepStatus): 'done' | 'run' | 'fail' | 'pending' | 'skip' {
  switch (status) {
    case 'completed': return 'done';
    case 'running': return 'run';
    case 'failed':
    case 'timed_out':
    case 'cancelled': return 'fail';
    case 'skipped': return 'skip';
    default: return 'pending';
  }
}

function segmentColor(status: StepStatus): string {
  switch (status) {
    case 'completed': return 'var(--dd-green)';
    case 'running': return 'var(--dd-amber)';
    case 'failed':
    case 'timed_out':
    case 'cancelled': return 'var(--dd-red)';
    default: return 'var(--dd-line-2)';
  }
}

function logKindFromStream(stream: 'stdout' | 'stderr'): LogLine['kind'] {
  return stream === 'stderr' ? 'err' : '';
}

export default function RunView({ runId, workflowName, workflowIcon, onCancel, onBack }: Props) {
  const [run, setRun] = useState<RunWithSteps | null>(null);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [follow, setFollow] = useState(true);
  const [wrap, setWrap] = useState(false);
  const [elapsed, setElapsed] = useState('0s');
  const logBodyRef = useRef<HTMLDivElement>(null);
  const [cancelling, setCancelling] = useState(false);

  // Load initial run data
  useEffect(() => {
    let cancelled = false;
    api.getRun(runId).then((data) => {
      if (cancelled) return;
      setRun(data);
      setSteps(data.steps);
      // Find the currently running step or first pending
      const runningIdx = data.steps.findIndex((s) => s.status === 'running');
      const activeIdx = runningIdx >= 0 ? runningIdx : Math.max(0, data.steps.length - 1);
      setActiveStepIndex(activeIdx);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [runId]);

  // Load initial logs for the active step
  useEffect(() => {
    if (!run) return;
    const step = steps[activeStepIndex];
    if (!step) return;
    api.getStepLogs(runId, step.id).then((rawLogs) => {
      const lines: LogLine[] = rawLogs.map((l) => ({
        ts: new Date(l.timestamp).toISOString().slice(11, 23),
        kind: logKindFromStream(l.stream),
        text: l.content,
        stepIndex: step.step_index,
      }));
      setLogs(lines);
    }).catch(console.error);
  }, [run, activeStepIndex, runId, steps]);

  // Real-time socket updates
  const onRunStatus = useCallback((data: { run_id: string; status: RunStatus }) => {
    if (data.run_id !== runId) return;
    setRun((prev) => prev ? { ...prev, status: data.status } : prev);
  }, [runId]);

  const onStepStatus = useCallback((data: { run_id: string; step_index: number; status: StepStatus; exit_code?: number }) => {
    if (data.run_id !== runId) return;
    setSteps((prev) =>
      prev.map((s) =>
        s.step_index === data.step_index
          ? { ...s, status: data.status, exit_code: data.exit_code }
          : s
      )
    );
    if (data.status === 'running') {
      setActiveStepIndex(data.step_index);
    }
  }, [runId]);

  const onStepLog = useCallback((data: { run_id: string; step_index: number; stream: 'stdout' | 'stderr'; content: string }) => {
    if (data.run_id !== runId) return;
    const now = new Date();
    const ts = now.toISOString().slice(11, 23);
    // Guess kind from content
    let kind: LogLine['kind'] = logKindFromStream(data.stream);
    if (kind === '' && data.content.startsWith('$ ')) kind = 'prompt';
    else if (kind === '' && (data.content.startsWith('✓') || data.content.startsWith('info'))) kind = 'info';
    else if (kind === '' && (data.content.startsWith('⚠') || data.content.startsWith('warn'))) kind = 'warn';
    else if (kind === '' && data.content.startsWith('>')) kind = 'dim';

    const line: LogLine = {
      ts,
      kind,
      text: data.content,
      stepIndex: data.step_index,
    };

    if (data.step_index === activeStepIndex) {
      setLogs((prev) => [...prev, line]);
    }
  }, [runId, activeStepIndex]);

  useSocket({ onRunStatus, onStepStatus, onStepLog });

  // Elapsed timer
  useEffect(() => {
    if (!run?.started_at) return;
    if (run.status !== 'running') {
      if (run.duration_ms) setElapsed(formatDuration(run.duration_ms));
      return;
    }
    setElapsed(formatElapsed(run.started_at));
    const id = setInterval(() => setElapsed(formatElapsed(run.started_at)), 1000);
    return () => clearInterval(id);
  }, [run?.started_at, run?.status, run?.duration_ms]);

  // Auto-scroll on new logs
  useEffect(() => {
    if (follow && logBodyRef.current) {
      logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight;
    }
  }, [logs, follow]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.cancelRun(runId);
      onCancel();
    } catch (e) {
      console.error(e);
      setCancelling(false);
    }
  };

  const handleDownloadLogs = () => {
    const text = logs.map((l) => `[${l.ts}] ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `run-${runId}-step-${activeStepIndex + 1}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doneCount = steps.filter((s) => s.status === 'completed').length;
  const totalCount = steps.length;

  const activeStep = steps[activeStepIndex];

  const errorCount = logs.filter((l) => l.kind === 'err').length;
  const warnCount = logs.filter((l) => l.kind === 'warn').length;

  const isRunning = run?.status === 'running';

  const paramsUsed = run?.params_used ?? {};

  const icon = workflowIcon ?? { ch: workflowName.charAt(0).toUpperCase(), color: 'var(--dd-amber)' };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--dd-bg)',
        display: 'grid',
        gridTemplateRows: '32px 1fr 28px',
        gridTemplateColumns: '240px 1fr',
        gridTemplateAreas: "'tabs tabs' 'side main' 'status status'",
        overflow: 'hidden',
      }}
    >
      <Titlebar path={`${workflowName} · run #${runId.slice(0, 6)}`} />

      <Sidebar
        workflows={[]}
        onSelect={() => {}}
        onCreate={() => {}}
      />

      <main
        style={{
          gridArea: 'main',
          background: 'var(--dd-bg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Page header */}
        <div
          style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid var(--dd-line)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <Glyph ch={icon.ch} color={icon.color} />
                <h1
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {workflowName}
                </h1>
                {isRunning ? (
                  <Badge kind="run">
                    <span
                      className="dot"
                      style={{ background: 'var(--dd-amber)', boxShadow: '0 0 6px var(--dd-amber)' }}
                    />
                    Running
                  </Badge>
                ) : run?.status === 'completed' ? (
                  <Badge kind="success">Completed</Badge>
                ) : run?.status === 'failed' ? (
                  <Badge kind="fail">Failed</Badge>
                ) : run?.status === 'cancelled' ? (
                  <Badge kind="pending">Cancelled</Badge>
                ) : null}
                <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>
                  #{runId.slice(0, 6)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--dd-text-3)' }}>
                {run?.started_at && (
                  <span>
                    <Icon name="schedule" size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Started {elapsed} ago · {new Date(run.started_at).toLocaleTimeString()}
                  </span>
                )}
                <span>
                  <Icon name="terminal" size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  run {runId.slice(0, 8)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={handleDownloadLogs}>
                <Icon name="download" size={14} />
                Download logs
              </button>
              {isRunning && (
                <button
                  className="btn btn-danger"
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  <Icon name="stop" size={14} />
                  {cancelling ? 'Cancelling…' : 'Cancel run'}
                </button>
              )}
              {!isRunning && (
                <button className="btn btn-secondary" onClick={onBack}>
                  <Icon name="arrow_back" size={14} />
                  Back
                </button>
              )}
            </div>
          </div>

          {/* Params strip */}
          {Object.keys(paramsUsed).length > 0 && (
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--dd-text-4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                }}
              >
                Params
              </span>
              {Object.entries(paramsUsed).map(([k, v]) => (
                <span
                  key={k}
                  className="mono"
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    background: 'var(--dd-surface-3)',
                    border: '1px solid var(--dd-line)',
                    borderRadius: 4,
                    color: 'var(--dd-text-2)',
                  }}
                >
                  <span style={{ color: 'var(--dd-text-4)' }}>{k}=</span>
                  <span
                    style={{
                      color: v === 'false' || v === '0' || v === 'no'
                        ? 'var(--dd-red)'
                        : v === 'true' || v === '1' || v === 'yes'
                        ? 'var(--dd-green)'
                        : 'var(--dd-text)',
                    }}
                  >
                    {v}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Progress strip */}
        <div
          style={{
            padding: '12px 22px',
            borderBottom: '1px solid var(--dd-line)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)', minWidth: 50 }}>
            {doneCount} / {totalCount}
          </span>
          <div
            style={{
              flex: 1,
              height: 4,
              background: 'var(--dd-surface-3)',
              borderRadius: 2,
              overflow: 'hidden',
              display: 'flex',
              gap: 2,
            }}
          >
            {steps.map((s) => (
              <div
                key={s.id}
                style={{
                  flex: 1,
                  borderRadius: 2,
                  background: segmentColor(s.status),
                  opacity: s.status === 'running' ? 0.9 : 1,
                  animation: s.status === 'running' ? 'dd-blink 1.6s ease-in-out infinite' : 'none',
                }}
              />
            ))}
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>
            elapsed {elapsed}
          </span>
        </div>

        {/* Body: steps + log */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '360px 1fr',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {/* Steps list */}
          <div
            style={{
              borderRight: '1px solid var(--dd-line)',
              overflow: 'auto',
              padding: '12px 12px',
              background: 'var(--dd-surface)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--dd-text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '4px 6px 10px',
              }}
            >
              Steps
            </div>
            {steps.map((step, idx) => {
              const state = stepStateFromStatus(step.status);
              const isActive = idx === activeStepIndex;
              return (
                <div
                  key={step.id}
                  className={`step${state === 'pending' ? ' pending' : ''}${isActive ? ' active' : ''}`}
                  onClick={() => setActiveStepIndex(idx)}
                >
                  <span className={`step-marker ${state === 'skip' ? 'pending' : state}`}>
                    {state === 'done' && (
                      <Icon name="check" size={11} style={{ fontVariationSettings: "'wght' 700" }} />
                    )}
                    {state === 'run' && <Spinner />}
                    {(state === 'pending' || state === 'skip') && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{step.step_index + 1}</span>
                    )}
                    {state === 'fail' && <Icon name="close" size={11} />}
                  </span>
                  <div className="step-body">
                    <div className="step-title">{step.name}</div>
                    <div
                      className="step-cmd mono"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      <span style={{ color: 'var(--dd-text-4)' }}>$ </span>
                      {step.command}
                    </div>
                  </div>
                  <span
                    className="step-time"
                    style={{ color: state === 'run' ? 'var(--dd-amber)' : undefined }}
                  >
                    {state === 'run'
                      ? '— running'
                      : step.duration_ms
                      ? formatDuration(step.duration_ms)
                      : state === 'pending'
                      ? '—'
                      : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Log panel */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: '#07070a',
            }}
          >
            {/* Log header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 14px',
                borderBottom: '1px solid var(--dd-line)',
                background: 'var(--dd-surface)',
                gap: 12,
                flexShrink: 0,
              }}
            >
              <Icon name="terminal" size={14} style={{ color: 'var(--dd-text-3)' }} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>
                Step {activeStepIndex + 1} · {activeStep?.name ?? '—'}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>
                stdout + stderr{isRunning && activeStep?.status === 'running' ? ' · live' : ''}
              </span>
              <span style={{ flex: 1 }} />
              <button
                className={`btn btn-ghost btn-sm${wrap ? ' active' : ''}`}
                onClick={() => setWrap((v) => !v)}
                style={wrap ? { color: 'var(--dd-blue)' } : {}}
              >
                <Icon name="wrap_text" size={12} />
                Wrap
              </button>
              <button
                className={`btn btn-ghost btn-sm${follow ? ' active' : ''}`}
                onClick={() => setFollow((v) => !v)}
                style={follow ? { color: 'var(--dd-blue)' } : {}}
              >
                <Icon name="vertical_align_bottom" size={12} />
                Follow
              </button>
              <button className="btn btn-ghost btn-sm">
                <Icon name="search" size={12} />
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(logs.map((l) => `[${l.ts}] ${l.text}`).join('\n')).catch(() => {});
                }}
              >
                <Icon name="content_copy" size={12} />
              </button>
            </div>

            {/* Log body */}
            <div
              ref={logBodyRef}
              className="terminal"
              style={{
                flex: 1,
                borderRadius: 0,
                border: 0,
                overflow: 'auto',
                padding: '10px 14px',
                whiteSpace: wrap ? 'pre-wrap' : 'pre',
              }}
              onScroll={(e) => {
                const el = e.currentTarget;
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
                setFollow(atBottom);
              }}
            >
              {logs.length === 0 ? (
                <div style={{ color: 'var(--dd-text-4)', fontStyle: 'italic' }}>
                  {activeStep?.status === 'pending' ? 'Waiting to start…' : 'No logs yet.'}
                </div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className="term-line">
                    <span className="ts">{l.ts}</span>
                    <span className={l.kind || undefined}>{l.text}</span>
                  </div>
                ))
              )}
              {isRunning && activeStep?.status === 'running' && (
                <div className="term-line">
                  <span className="ts">{new Date().toISOString().slice(11, 23)}</span>
                  <span className="term-cursor" style={{ marginLeft: 4 }} />
                </div>
              )}
            </div>

            {/* Log footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 14px',
                borderTop: '1px solid var(--dd-line)',
                background: 'var(--dd-surface)',
                fontSize: 11,
                color: 'var(--dd-text-4)',
                fontFamily: 'var(--font-mono)',
                gap: 16,
                flexShrink: 0,
              }}
            >
              <span>
                <span style={{ color: isRunning ? 'var(--dd-green)' : 'var(--dd-text-4)' }}>●</span>{' '}
                {isRunning ? 'connected' : 'idle'}
              </span>
              <span>{logs.length} lines</span>
              {errorCount > 0 ? (
                <span style={{ color: 'var(--dd-red)' }}>{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
              ) : (
                <span>0 errors</span>
              )}
              {warnCount > 0 ? (
                <span style={{ color: 'var(--dd-amber)' }}>{warnCount} warning{warnCount !== 1 ? 's' : ''}</span>
              ) : (
                <span>0 warnings</span>
              )}
              <span style={{ flex: 1 }} />
              <span>{follow ? 'scrolled to bottom' : 'scrolled up'}</span>
            </div>
          </div>
        </div>
      </main>

      <StatusBar
        processCount={0}
        activeRuns={isRunning ? 1 : 0}
        extra={
          isRunning ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--dd-amber)' }}>
              <Spinner />
              Running · step {activeStepIndex + 1}/{totalCount}
            </span>
          ) : undefined
        }
      />
    </div>
  );
}
