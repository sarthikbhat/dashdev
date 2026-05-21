import { useNavigate } from 'react-router-dom';
import { Titlebar, StatusBar, Icon, Kbd } from './index';

// ── StarterCard ────────────────────────────────────────────────────────────

interface StarterCardProps {
  icon: string;
  iconColor: string;
  title: string;
  body: string;
  kbd?: string;
  primary?: boolean;
  onClick?: () => void;
}

function StarterCard({
  icon,
  iconColor,
  title,
  body,
  kbd,
  primary,
  onClick,
}: StarterCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 14px',
        background: primary ? 'rgba(96,165,250,0.06)' : 'var(--dd-surface-2)',
        border: `1px solid ${primary ? 'rgba(96,165,250,0.35)' : 'var(--dd-line)'}`,
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--dd-text)',
        fontFamily: 'inherit',
        transition: 'background 120ms, border-color 120ms',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          flexShrink: 0,
          background: `${iconColor}1a`,
          border: `1px solid ${iconColor}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: iconColor,
        }}
      >
        <Icon name={icon} size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--dd-text)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {title}
          {kbd && <Kbd>{kbd}</Kbd>}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--dd-text-3)',
            marginTop: 2,
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>
      </div>
    </button>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────

interface Props {
  processCount?: number;
  activeRuns?: number;
}

export default function EmptyState({ processCount = 0, activeRuns = 0 }: Props) {
  const navigate = useNavigate();

  return (
    <div className="dd" style={{ width: '100%', height: '100%' }}>
      <div className="app-window">
        <Titlebar path="Welcome" />

        {/* Empty sidebar */}
        <aside
          className="sidebar"
          style={{
            gridArea: 'side',
            width: 240,
            background: 'var(--dd-surface)',
            borderRight: '1px solid var(--dd-line)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Logo header */}
          <div
            style={{
              padding: '10px 12px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderBottom: '1px solid var(--dd-line)',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0a0a0c',
                fontWeight: 700,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
              }}
            >
              D
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dd-text)' }}>
                DevDash
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--dd-text-4)' }}>
                ~/projects/devdash
              </div>
            </div>
          </div>

          {/* Disabled search */}
          <div style={{ padding: '8px 8px' }}>
            <div style={{ position: 'relative', opacity: 0.5 }}>
              <Icon
                name="search"
                size={13}
                style={{ position: 'absolute', left: 8, top: 7, color: 'var(--dd-text-4)' }}
              />
              <input
                className="input"
                style={{ paddingLeft: 26, fontSize: 12 }}
                placeholder="Filter workflows…"
                disabled
              />
            </div>
          </div>

          {/* No workflows state */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 20px',
              textAlign: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'var(--dd-surface-3)',
                border: '1px dashed var(--dd-line-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--dd-text-4)',
              }}
            >
              <Icon name="bolt" size={22} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--dd-text-2)', fontWeight: 500 }}>
              No workflows yet
            </div>
            <div
              style={{ fontSize: 11, color: 'var(--dd-text-4)', lineHeight: 1.5 }}
            >
              Workflows live as JS files in{' '}
              <span className="mono">./workflows/</span>
            </div>
          </div>

          {/* Create button */}
          <div style={{ padding: 8, borderTop: '1px solid var(--dd-line)' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => navigate('/workflow/new/edit')}
            >
              <Icon name="add" size={14} />
              Create workflow
              <span style={{ marginLeft: 'auto' }}>
                <Kbd>⌘N</Kbd>
              </span>
            </button>
          </div>
        </aside>

        {/* Main hero */}
        <main
          className="main"
          style={{ gridArea: 'main', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 60px',
              overflow: 'auto',
              position: 'relative',
            }}
          >
            {/* Background grid */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)',
                backgroundSize: '24px 24px',
                maskImage:
                  'radial-gradient(ellipse 60% 50% at 50% 40%, #000 30%, transparent 80%)',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                position: 'relative',
                textAlign: 'center',
                maxWidth: 540,
              }}
            >
              {/* Gradient logo */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  margin: '0 auto 24px',
                  background:
                    'linear-gradient(135deg, #60a5fa 0%, #a78bfa 60%, #f472b6 100%)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0a0a0c',
                  fontWeight: 800,
                  fontSize: 30,
                  fontFamily: 'var(--font-mono)',
                  boxShadow:
                    '0 0 0 1px rgba(255,255,255,0.05), 0 20px 40px -10px rgba(96,165,250,0.3)',
                }}
              >
                D
              </div>

              <h1
                style={{
                  fontSize: 28,
                  margin: 0,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                }}
              >
                Welcome to DevDash
              </h1>
              <p
                style={{
                  marginTop: 8,
                  color: 'var(--dd-text-3)',
                  fontSize: 15,
                  lineHeight: 1.5,
                }}
              >
                Run scripted workflows locally. Deploys, migrations, feature flags, restarts.
                Author them as JS, trigger them from one place.
              </p>

              {/* Starter cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  marginTop: 28,
                  textAlign: 'left',
                }}
              >
                <StarterCard
                  icon="add_circle"
                  iconColor="var(--dd-blue)"
                  title="Create your first workflow"
                  body="Start with a blank file or fork a template."
                  kbd="⌘N"
                  primary
                  onClick={() => navigate('/workflow/new/edit')}
                />
                <StarterCard
                  icon="folder_open"
                  iconColor="var(--dd-purple)"
                  title="Import existing scripts"
                  body="Wrap your existing shell scripts in workflow definitions."
                  onClick={() => navigate('/workflow/new/edit')}
                />
                <StarterCard
                  icon="auto_awesome"
                  iconColor="var(--dd-green)"
                  title="Start from a template"
                  body="Deploy, migrate, restart, rotate — pick a recipe."
                  onClick={() => navigate('/workflow/new/edit')}
                />
                <StarterCard
                  icon="menu_book"
                  iconColor="var(--dd-amber)"
                  title="Read the docs"
                  body="Workflow API, parameters, triggers."
                />
              </div>

              {/* Tip strip */}
              <div
                style={{
                  marginTop: 28,
                  padding: '10px 14px',
                  background: 'var(--dd-surface-2)',
                  border: '1px solid var(--dd-line)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 12,
                  color: 'var(--dd-text-3)',
                }}
              >
                <Icon name="lightbulb" size={14} style={{ color: 'var(--dd-amber)' }} />
                <span>
                  Drop any{' '}
                  <span className="mono" style={{ color: 'var(--dd-text)' }}>
                    .js
                  </span>{' '}
                  file into{' '}
                  <span className="mono" style={{ color: 'var(--dd-text)' }}>
                    ./workflows/
                  </span>{' '}
                  and DevDash picks it up automatically.
                </span>
                <span style={{ flex: 1 }} />
                <Kbd>⌘?</Kbd>
              </div>
            </div>
          </div>
        </main>

        <StatusBar
          processCount={processCount}
          activeRuns={activeRuns}
          extra={
            <span style={{ color: 'var(--dd-text-4)' }}>
              <Icon
                name="check"
                size={11}
                style={{ verticalAlign: '-1px', marginRight: 3, color: 'var(--dd-green)' }}
              />
              Watching <span className="mono">./workflows/</span>
            </span>
          }
        />
      </div>
    </div>
  );
}
