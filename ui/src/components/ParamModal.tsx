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

function Field({ label, type, required, children }: {
  label: string; type: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dd-text)' }}>{label}</span>
        <span style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
          color: 'var(--dd-accent-bright)', background: 'var(--dd-accent-dim)',
          padding: '1px 6px', borderRadius: 4,
        }}>
          {type}
        </span>
        {required && (
          <span style={{ fontSize: 10, color: 'var(--dd-amber)', fontWeight: 500 }}>required</span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function ParamModal({ workflow, onRun, onCancel }: Props) {
  const { name, icon, params, estimatedTime } = workflow;

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of params) {
      init[p.name] = p.default ?? (p.type === 'toggle' ? 'false' : '');
    }
    return init;
  });

  const glyph = icon ?? { ch: name.charAt(0).toUpperCase(), color: 'var(--dd-accent)' };
  const requiredCount = params.filter((p) => p.required).length;

  const setValue = (n: string, value: string) => {
    setValues((prev) => ({ ...prev, [n]: value }));
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onRun(values);
    },
    [onCancel, onRun, values]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const canRun = params
    .filter((p) => p.required)
    .every((p) => (values[p.name] ?? '').trim() !== '');

  return (
    <div className="modal-backdrop">
      <div className="modal-scrim" onClick={onCancel} />

      <div className="modal-card" style={{ width: 520, maxWidth: '90%', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px 16px',
          borderBottom: '1px solid var(--dd-line)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <Glyph ch={glyph.ch} color={glyph.color} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--dd-text)', letterSpacing: -0.2 }}>
              Run {name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--dd-text-3)', marginTop: 2 }}>
              {params.length} parameter{params.length !== 1 ? 's' : ''}
              {requiredCount > 0 && ` · ${requiredCount} required`}
              {estimatedTime && ` · ~${estimatedTime}`}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} style={{ padding: 4 }}>
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: '20px 22px 8px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {params.map((param) => {
            const val = values[param.name] ?? '';

            if (param.type === 'toggle') {
              const isOn = val === 'true';
              return (
                <Field key={param.name} label={param.name} type="toggle" required={param.required}>
                  <button
                    onClick={() => setValue(param.name, isOn ? 'false' : 'true')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 10, width: '100%',
                      background: isOn ? 'rgba(52,211,153,0.06)' : 'var(--dd-surface-3)',
                      border: `1px solid ${isOn ? 'rgba(52,211,153,0.2)' : 'var(--dd-line)'}`,
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <div style={{
                      width: 36, height: 20, borderRadius: 10,
                      background: isOn ? 'var(--dd-green)' : 'var(--dd-surface)',
                      position: 'relative', flexShrink: 0,
                      transition: 'background 150ms ease',
                      border: `1px solid ${isOn ? 'transparent' : 'var(--dd-line-2)'}`,
                    }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute', top: 1,
                        left: isOn ? 17 : 1,
                        transition: 'left 150ms ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                    <span className="mono" style={{
                      fontSize: 12, fontWeight: 600,
                      color: isOn ? 'var(--dd-green)' : 'var(--dd-text-3)',
                    }}>
                      {isOn ? 'true' : 'false'}
                    </span>
                  </button>
                </Field>
              );
            }

            if (param.type === 'select' && param.options) {
              return (
                <Field key={param.name} label={param.name} type="select" required={param.required}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {param.options.map((opt) => {
                      const selected = val === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => setValue(param.name, opt)}
                          style={{
                            flex: '1 1 auto', minWidth: 90,
                            padding: '10px 14px',
                            background: selected ? 'var(--dd-accent-dim)' : 'var(--dd-surface-3)',
                            border: `1.5px solid ${selected ? 'var(--dd-accent)' : 'var(--dd-line)'}`,
                            borderRadius: 10, cursor: 'pointer',
                            fontFamily: 'inherit', textAlign: 'center',
                            transition: 'all 150ms ease',
                          }}
                        >
                          <span className="mono" style={{
                            fontSize: 13, fontWeight: 600,
                            color: selected ? 'var(--dd-accent-bright)' : 'var(--dd-text-2)',
                          }}>
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              );
            }

            if (param.type === 'textarea') {
              return (
                <Field key={param.name} label={param.label ?? param.name} type="textarea" required={param.required}>
                  <textarea
                    className="input mono"
                    value={val}
                    placeholder={param.default ?? `Enter ${param.label ?? param.name}...`}
                    onChange={(e) => setValue(param.name, e.target.value)}
                    rows={4}
                    style={{
                      fontSize: 12, resize: 'vertical', lineHeight: 1.5,
                      minHeight: 80, fontFamily: 'var(--font-mono)',
                    }}
                    autoFocus={params.indexOf(param) === 0}
                  />
                </Field>
              );
            }

            return (
              <Field key={param.name} label={param.label ?? param.name} type="text" required={param.required}>
                <input
                  className="input mono"
                  value={val}
                  placeholder={param.default ?? param.name}
                  onChange={(e) => setValue(param.name, e.target.value)}
                  style={{ fontSize: 13 }}
                  autoFocus={params.indexOf(param) === 0}
                />
              </Field>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--dd-line)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
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
            <Icon name="play_arrow" size={15} />
            Run workflow
            <span style={{ marginLeft: 4, opacity: 0.6 }}><Kbd>⌘↵</Kbd></span>
          </button>
        </div>
      </div>
    </div>
  );
}
