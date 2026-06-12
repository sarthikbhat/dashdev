import { useEffect, useState } from 'react';
import { health } from '../api';

interface Props {
  processCount: number;
  activeRuns: number;
  extra?: React.ReactNode;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function StatusBar({ processCount, activeRuns, extra }: Props) {
  const [uptime, setUptime] = useState<number | null>(null);
  const [serverUp, setServerUp] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchHealth() {
      try {
        const data = await health();
        if (!cancelled) {
          setUptime(data.uptime);
          setServerUp(true);
        }
      } catch {
        if (!cancelled) setServerUp(false);
      }
    }

    fetchHealth();
    const id = setInterval(fetchHealth, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div
      style={{
        gridArea: 'status',
        height: 28,
        background: 'var(--dd-surface)',
        borderTop: '1px solid var(--dd-line)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 14,
        paddingRight: 14,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--dd-text-4)',
        gap: 14,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: serverUp ? 'var(--dd-green)' : 'var(--dd-red)',
          }}
        />
        <span style={{ color: serverUp ? 'var(--dd-text-3)' : 'var(--dd-red)' }}>
          {serverUp ? 'Connected' : 'Disconnected'}
        </span>
        {uptime !== null && (
          <span>{formatUptime(uptime)}</span>
        )}
      </div>

      <span>{processCount} proc</span>

      {activeRuns > 0 && (
        <span style={{ color: 'var(--dd-amber)' }}>
          {activeRuns} running
        </span>
      )}

      {extra}

      <div style={{ marginLeft: 'auto' }}>
        <span>:3847</span>
      </div>
    </div>
  );
}
