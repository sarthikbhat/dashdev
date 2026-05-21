import Icon from './Icon';
import Kbd from './Kbd';

interface Props {
  path: string;
}

export default function Titlebar({ path }: Props) {
  return (
    <div
      style={{
        gridArea: 'tabs',
        height: 32,
        background: '#07070a',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 12,
        borderBottom: '1px solid var(--dd-line)',
        gap: 12,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Traffic lights */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
      </div>

      {/* URL bar */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--dd-text-3)',
            letterSpacing: 0.2,
          }}
        >
          localhost:3847
          <span style={{ color: 'var(--dd-text-4)', margin: '0 4px' }}>›</span>
          <span style={{ color: 'var(--dd-text-2)' }}>{path}</span>
        </span>
      </div>

      {/* Right side controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--dd-text-4)',
          }}
        >
          v0.1.0
        </span>
        <Icon name="search" size={14} style={{ color: 'var(--dd-text-3)', cursor: 'pointer' }} />
        <Kbd>⌘K</Kbd>
      </div>
    </div>
  );
}
