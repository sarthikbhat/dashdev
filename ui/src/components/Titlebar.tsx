import Icon from './Icon';
import Kbd from './Kbd';

interface Props {
  path: string;
}

export default function Titlebar({ path }: Props) {
  // Build breadcrumb from path (e.g. "Edit · Deploy Forge App" → ["Edit", "Deploy Forge App"])
  const crumbs = path.split(/\s*[·›]\s*/).filter(Boolean);

  return (
    <div
      style={{
        gridArea: 'header',
        height: 44,
        background: 'var(--dd-surface)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 16,
        borderBottom: '1px solid var(--dd-line)',
        gap: 16,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 13,
            color: '#fff',
            letterSpacing: -0.5,
          }}
        >
          D
        </div>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--dd-text)' }}>
          DevDash
        </span>
      </div>

      {/* Breadcrumb */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            color: 'var(--dd-text-4)',
            fontSize: 14,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ›
        </span>
        {crumbs.map((crumb, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {i > 0 && (
              <span style={{ color: 'var(--dd-text-4)', fontSize: 12, flexShrink: 0 }}>›</span>
            )}
            <span
              style={{
                fontSize: 12,
                color: i === crumbs.length - 1 ? 'var(--dd-text-2)' : 'var(--dd-text-3)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Right side controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--dd-text-4)',
            padding: '2px 6px',
            background: 'var(--dd-surface-3)',
            borderRadius: 4,
            border: '1px solid var(--dd-line)',
          }}
        >
          v0.1.0
        </span>
        <Icon name="search" size={15} style={{ color: 'var(--dd-text-3)', cursor: 'pointer' }} />
        <Kbd>⌘K</Kbd>
      </div>
    </div>
  );
}
