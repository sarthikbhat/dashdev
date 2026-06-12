import { useState, useCallback } from 'react';
import Icon from './Icon';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

let toastCounter = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}

const COLORS = {
  error: { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', text: 'var(--dd-red)', icon: 'error' },
  success: { bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)', text: 'var(--dd-green)', icon: 'check_circle' },
  info: { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.25)', text: 'var(--dd-blue)', icon: 'info' },
} as const;

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 40, right: 16, zIndex: 200,
      display: 'flex', flexDirection: 'column-reverse', gap: 6, maxWidth: 360,
    }}>
      {toasts.map((t) => {
        const c = COLORS[t.type];
        return (
          <div
            key={t.id}
            style={{
              padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 8,
              background: c.bg, border: `1px solid ${c.border}`, color: c.text,
              animation: 'dd-toast-in 200ms ease',
            }}
          >
            <Icon name={c.icon} size={14} />
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => onDismiss(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex', opacity: 0.6 }}
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
