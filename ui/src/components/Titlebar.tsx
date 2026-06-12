import { useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';

const NAV_ITEMS = [
  { path: '/services', label: 'Services', icon: 'dns' },
  { path: '/workflows', label: 'Workflows', icon: 'play_circle' },
  { path: '/redis', label: 'Redis', icon: 'storage' },
];

interface Props {
  path: string;
}

export default function Titlebar({ path }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (itemPath: string) => {
    if (itemPath === '/workflows') {
      return location.pathname.startsWith('/workflow') || location.pathname === '/history';
    }
    return location.pathname.startsWith(itemPath);
  };

  return (
    <div
      style={{
        gridArea: 'header',
        height: 52,
        background: 'var(--dd-surface)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 18,
        paddingRight: 18,
        borderBottom: '1px solid var(--dd-line)',
        gap: 0,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Logo */}
      <button
        onClick={() => navigate('/')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 14px 4px 0',
          marginRight: 6,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #7c6ef6 0%, #c084fc 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 15,
            color: '#fff',
            letterSpacing: -0.5,
            boxShadow: '0 2px 8px rgba(124,110,246,0.25)',
          }}
        >
          D
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--dd-text)', letterSpacing: -0.3 }}>
          DevDash
        </span>
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 22, background: 'var(--dd-line-2)', marginRight: 10, flexShrink: 0 }} />

      {/* Nav links */}
      <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                background: active ? 'rgba(124,110,246,0.10)' : 'transparent',
                color: active ? 'var(--dd-blue-bright)' : 'var(--dd-text-3)',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.color = 'var(--dd-text-2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--dd-text-3)';
                }
              }}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Breadcrumb context */}
      {path !== 'Home' && !['Services', 'Workflows', 'Redis', 'Run History'].includes(path) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--dd-text-4)',
          marginRight: 12,
        }}>
          <span style={{ color: 'var(--dd-text-4)' }}>›</span>
          <span style={{
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {path}
          </span>
        </div>
      )}
    </div>
  );
}
