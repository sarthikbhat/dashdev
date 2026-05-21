import { useState, useEffect, useCallback } from 'react';
import type { WorkflowParam } from '../types';
import Icon from './Icon';
import Glyph from './Glyph';
import Kbd from './Kbd';

interface WorkflowInfo {
  name: string;
  icon?: { ch: string; color: string };
  params: WorkflowParam[];
  estimatedTime?: string;
}

interface Props {
  workflow: WorkflowInfo;
  onRun: (values: Record<string, string>) => void;
  onCancel: () => void;
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  type: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}

function Field({ label, type, required, help, children }: FieldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 12, color: 'var(--dd-text)' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--dd-purple)' }}>{type}</span>
        {required && (
          <span style={{ fontSize: 10, color: 'var(--dd-amber)', fontWeight: 500 }}>required</span>
        )}
        <span style={{ flex: 1 }} />
        {help && <span style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>{help}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ParamModal({ workflow, onRun, onCancel }: Props) {
  const { name, icon, params, estimatedTime } = workflow;

  // Build initial values from defaults
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of params) {
      init[p.name] = p.default ?? (p.type === 'toggle' ? 'false' : '');
    }
    return init;
  });

  const [saveDefaults, setSaveDefaults] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);

  const glyph = icon ?? { ch: name.charAt(0).toUpperCase(), color: 'var(--dd-amber)' };
  const requiredCount = params.filter((p) => p.required).length;

  const setValue = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  // Keyboard shortcut: Cmd+Enter to run, Escape to cancel
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        onRun(values);
      }
    },
    [onCancel, onRun, values]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Build CLI command preview
  const cliPreview = (() => {
    const parts: React.ReactNode[] = [
      <span key="cmd" style={{ color: 'var(--dd-text)' }}>devdash run</span>,
      ' ',
      <span key="wf" style={{ color: 'var(--dd-blue)' }}>{name.toLowerCase().replace(/\s+/g, '-')}</span>,
    ];
    for (const p of params) {
      const val = values[p.name];
      if (!val && !p.required) continue;
      if (p.type === 'toggle') {
        if (val === 'true') {
          parts.push(' ');
          parts.push(<span key={`flag-${p.name}`} style={{ color: 'var(--dd-amber)' }}>{`--${p.name.replace(/_/g, '-')}`}</span>);
        }
      } else {
        parts.push(' ');
        parts.push(<span key={`flag-${p.name}`} style={{ color: 'var(--dd-amber)' }}>{`--${p.name.replace(/_/g, '-')}`}</span>);
        parts.push(' ');
        parts.push(<span key={`val-${p.name}`} style={{ color: 'var(--dd-green)' }}>{val}</span>);
      }
    }
    return parts;
  })();

  const copyCommand = () => {
    const parts: string[] = [`devdash run ${name.toLowerCase().replace(/\s+/g, '-')}`];
    for (const p of params) {
      const val = values[p.name];
      if (!val && !p.required) continue;
      if (p.type === 'toggle') {
        if (val === 'true') parts.push(`--${p.name.replace(/_/g, '-')}`);
      } else {
        parts.push(`--${p.name.replace(/_/g, '-')} ${val}`);
      }
    }
    navigator.clipboard.writeText(parts.join(' ')).catch(() => {});
  };

  const canRun = params
    .filter((p) => p.required)
    .every((p) => (values[p.name] ?? '').trim() !== '');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Scrim — click to dismiss */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(7,7,10,0.65)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onCancel}
      />

      {/* Modal card */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: 520,
          maxWidth: '90%',
          background: 'var(--dd-surface-2)',
          border: '1px solid var(--dd-line-2)',
          borderRadius: 10,
          boxShadow: '0 20px 60px -10px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02) inset',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px 12px',
            borderBottom: '1px solid var(--dd-line)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Glyph ch={glyph.ch} color={glyph.color} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dd-text)' }}>
              Run · {name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--dd-text-3)', marginTop: 1 }}>
              {params.length} parameter{params.length !== 1 ? 's' : ''}
              {requiredCount > 0 && `, ${requiredCount} required`}
              {estimatedTime && ` · ~${estimatedTime} estimated`}
            </div>
          </div>
          <button
            style={{
              width: 24,
              height: 24,
              padding: 0,
              border: 0,
              background: 'transparent',
              color: 'var(--dd-text-3)',
              cursor: 'pointer',
              borderRadius: 4,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={onCancel}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Body — fields */}
        <div
          style={{
            padding: '18px 18px 6px',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 260px)',
          }}
        >
          {params.map((param) => {
            const val = values[param.name] ?? '';

            if (param.type === 'text') {
              return (
                <Field
                  key={param.name}
                  label={param.name}
                  type="text"
                  required={param.required}
                  help={undefined}
                >
                  <div style={{ position: 'relative' }}>
                    <Icon
                      name="edit"
                      size={14}
                      style={{ position: 'absolute', left: 9, top: 8, color: 'var(--dd-text-4)', pointerEvents: 'none' }}
                    />
                    <input
                      className="input mono"
                      value={val}
                      placeholder={param.default ?? param.name}
                      onChange={(e) => setValue(param.name, e.target.value)}
                      style={{ paddingLeft: 30, fontSize: 13 }}
                    />
                  </div>
                </Field>
              );
            }

            if (param.type === 'toggle') {
              const isOn = val === 'true';
              return (
                <Field
                  key={param.name}
                  label={param.name}
                  type="toggle"
                  required={param.required}
                  help={undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => setValue(param.name, isOn ? 'false' : 'true')}
                      style={{
                        width: 32,
                        height: 18,
                        borderRadius: 9,
                        padding: 2,
                        background: isOn ? 'var(--dd-amber)' : 'var(--dd-surface-3)',
                        border: `1px solid ${isOn ? 'var(--dd-amber)' : 'var(--dd-line-2)'}`,
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background 120ms',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          background: isOn ? '#0a0a0c' : 'var(--dd-text-3)',
                          transform: `translateX(${isOn ? 14 : 0}px)`,
                          transition: 'transform 120ms',
                        }}
                      />
                    </button>
                    <span
                      className="mono"
                      style={{ fontSize: 12, color: isOn ? 'var(--dd-amber)' : 'var(--dd-text-2)' }}
                    >
                      {isOn ? 'true' : 'false'}
                    </span>
                    {isOn && (
                      <span style={{ fontSize: 11, color: 'var(--dd-amber)' }}>
                        <Icon name="warning_amber" size={12} style={{ verticalAlign: '-2px', marginRight: 3 }} />
                        enabled
                      </span>
                    )}
                  </div>
                </Field>
              );
            }

            if (param.type === 'select' && param.options) {
              return (
                <Field
                  key={param.name}
                  label={param.name}
                  type="select"
                  required={param.required}
                  help={undefined}
                >
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {param.options.map((opt) => {
                      const selected = val === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => setValue(param.name, opt)}
                          style={{
                            flex: '1 1 auto',
                            minWidth: 80,
                            padding: '8px 10px',
                            background: selected ? 'rgba(96,165,250,0.08)' : 'var(--dd-surface-3)',
                            border: `1px solid ${selected ? 'var(--dd-blue)' : 'var(--dd-line)'}`,
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: 2,
                            fontFamily: 'inherit',
                            color: 'var(--dd-text)',
                            textAlign: 'left',
                            transition: 'border-color 120ms, background 120ms',
                          }}
                        >
                          <span
                            className="mono"
                            style={{ fontSize: 12, color: selected ? 'var(--dd-blue)' : 'var(--dd-text)' }}
                          >
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              );
            }

            // Fallback: text input
            return (
              <Field key={param.name} label={param.name} type={param.type} required={param.required}>
                <input
                  className="input mono"
                  value={val}
                  placeholder={param.default ?? param.name}
                  onChange={(e) => setValue(param.name, e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </Field>
            );
          })}
        </div>

        {/* CLI preview (collapsible) */}
        <details
          open={previewOpen}
          onToggle={(e) => setPreviewOpen((e.currentTarget as HTMLDetailsElement).open)}
          style={{ padding: '4px 18px 12px' }}
        >
          <summary
            style={{
              cursor: 'pointer',
              listStyle: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--dd-text-3)',
              marginBottom: 6,
              userSelect: 'none',
            }}
          >
            <Icon
              name={previewOpen ? 'expand_more' : 'chevron_right'}
              size={14}
            />
            <span>Will run as</span>
            <span className="mono">{name.toLowerCase().replace(/\s+/g, '-')}</span>
            <span style={{ flex: 1 }} />
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 6px', fontSize: 10 }}
              onClick={(e) => { e.preventDefault(); copyCommand(); }}
            >
              <Icon name="content_copy" size={10} />
              Copy command
            </button>
          </summary>
          <div className="terminal" style={{ fontSize: 11, padding: '8px 10px', lineHeight: '18px' }}>
            <div className="term-line">
              <span className="prompt">$</span>{' '}
              {cliPreview}
            </div>
          </div>
        </details>

        {/* Footer */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid var(--dd-line)',
            background: 'var(--dd-surface)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--dd-text-2)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={saveDefaults}
              onChange={(e) => setSaveDefaults(e.target.checked)}
              style={{ accentColor: 'var(--dd-blue)' }}
            />
            <span>Save these values as new defaults</span>
          </label>
          <span style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel <Kbd>Esc</Kbd>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onRun(values)}
            disabled={!canRun}
            style={!canRun ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            <Icon name="play_arrow" size={14} />
            Run workflow
            <span style={{ marginLeft: 6, opacity: 0.6 }}>
              <Kbd>⌘↵</Kbd>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
