import { useState, useEffect, useRef } from 'react';
import Icon from './Icon';

interface PromptDialogProps {
  mode: 'prompt';
  title: string;
  message?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

interface ConfirmDialogProps {
  mode: 'confirm';
  title: string;
  message?: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

type DialogModalProps = PromptDialogProps | ConfirmDialogProps;

export function DialogModal(props: DialogModalProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const danger = props.mode === 'confirm' && props.danger;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') props.onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.onCancel]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (props.mode === 'prompt') {
      if (value.trim()) props.onConfirm(value.trim());
    } else {
      props.onConfirm();
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) props.onCancel(); }}
    >
      <div className="modal-scrim" />
      <form
        className="modal-card"
        onSubmit={handleSubmit}
        style={{ width: 360, padding: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 20px 12px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: danger ? 'rgba(239,68,68,0.1)' : 'var(--dd-accent-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon
              name={danger ? 'warning' : props.mode === 'prompt' ? 'edit' : 'help'}
              size={17}
              style={{ color: danger ? 'var(--dd-red)' : 'var(--dd-accent)' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dd-text)' }}>
              {props.title}
            </div>
            {(props.mode === 'confirm' && props.description || props.message) && (
              <div style={{ fontSize: 12, color: 'var(--dd-text-3)', marginTop: 2 }}>
                {props.mode === 'confirm' ? props.description : ''}{props.message ?? ''}
              </div>
            )}
          </div>
        </div>

        {props.mode === 'prompt' && (
          <div style={{ padding: '0 20px 12px' }}>
            <input
              ref={inputRef}
              className="input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={props.placeholder ?? ''}
              style={{ fontSize: 13 }}
            />
          </div>
        )}

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px',
          borderTop: '1px solid var(--dd-line)',
          background: 'rgba(0,0,0,0.15)',
        }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={props.onCancel}
            style={{ fontSize: 12 }}
          >
            Cancel
          </button>
          <button
            ref={props.mode === 'confirm' ? inputRef as any : undefined}
            type="submit"
            className="btn"
            disabled={props.mode === 'prompt' && !value.trim()}
            style={{
              fontSize: 12,
              background: danger ? 'var(--dd-red)' : 'var(--dd-accent)',
              color: '#fff',
              opacity: props.mode === 'prompt' && !value.trim() ? 0.5 : 1,
            }}
          >
            {props.confirmLabel ?? (danger ? 'Delete' : 'Confirm')}
          </button>
        </div>
      </form>
    </div>
  );
}
