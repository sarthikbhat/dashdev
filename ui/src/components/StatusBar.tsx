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

  const sep = (
    <span style={{ color: 'var(--dd-line-2)', margin: '0 6px' }}>│</span>
  );

  return (
    <div
      style={{
        gridArea: 'status',
        height: 28,
        background: '#07070a',
        borderTop: '1px solid var(--dd-line)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 12,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--dd-text-3)',
        gap: 0,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Server status + uptime */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {/* Pulse dot */}
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: serverUp ? 'var(--dd-green)' : 'var(--dd-red)',
            boxShadow: serverUp
              ? '0 0 0 2px rgba(52,211,153,0.25)'
              : '0 0 0 2px rgba(248,113,113,0.25)',
            animation: serverUp ? 'dd-pulse 2s ease infinite' : 'none',
          }}
        />
        <span style={{ color: serverUp ? 'var(--dd-green)' : 'var(--dd-red)' }}>
          {serverUp ? 'Server up' : 'Server down'}
        </span>
        {uptime !== null && (
          <span style={{ color: 'var(--dd-text-4)' }}>· {formatUptime(uptime)}</span>
        )}
      </div>

      {sep}

      {/* CPU/MEM (placeholder) */}
      <span>CPU —</span>
      <span style={{ marginLeft: 8 }}>MEM —</span>

      {sep}

      {/* Process + run counts */}
      <span>
        <span style={{ color: 'var(--dd-text-2)' }}>{processCount}</span>
        {' '}proc
      </span>
      {sep}
      <span>
        <span style={{ color: activeRuns > 0 ? 'var(--dd-amber)' : 'var(--dd-text-2)' }}>
          {activeRuns}
        </span>
        {' '}runs
      </span>

      {/* Extra content (run status, etc.) */}
      {extra && (
        <>
          {sep}
          {extra}
        </>
      )}

      {/* Right side: node version, port, ws */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 0 }}>
        <span>node v20</span>
        {sep}
        <span>:3847</span>
        {sep}
        <span style={{ color: 'var(--dd-text-4)' }}>ws://localhost:3847</span>
      </div>

      <style>{`
        @keyframes dd-pulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(52,211,153,0.25); }
          50% { box-shadow: 0 0 0 4px rgba(52,211,153,0.10); }
        }
      `}</style>
    </div>
  );
}
