import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { Titlebar, StatusBar, Icon } from '../components';
import { listServices, getServicesStatus, listWorkflows } from '../api';

export default function Landing() {
  const navigate = useNavigate();
  const [serviceCount, setServiceCount] = useState<number | null>(null);
  const [runningCount, setRunningCount] = useState<number | null>(null);
  const [workflowCount, setWorkflowCount] = useState<number | null>(null);

  useEffect(() => {
    listServices()
      .then((svcs) => setServiceCount(svcs.length))
      .catch(() => setServiceCount(0));

    getServicesStatus()
      .then((statuses) => {
        const running = statuses.filter((s) => s.status === 'healthy').length;
        setRunningCount(running);
      })
      .catch(() => setRunningCount(0));

    listWorkflows()
      .then((wfs) => setWorkflowCount(wfs.length))
      .catch(() => setWorkflowCount(0));
  }, []);

  const goToServices = useCallback(() => navigate('/services'), [navigate]);
  const goToWorkflows = useCallback(() => navigate('/workflows'), [navigate]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 's' || e.key === 'S') goToServices();
      if (e.key === 'w' || e.key === 'W') goToWorkflows();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goToServices, goToWorkflows]);

  const serviceLabel =
    serviceCount === null
      ? 'Loading…'
      : runningCount === null
      ? `${serviceCount} services`
      : `${runningCount}/${serviceCount} running`;

  const workflowLabel =
    workflowCount === null ? 'Loading…' : `${workflowCount} workflow${workflowCount !== 1 ? 's' : ''}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--dd-bg-1, #0f1117)', color: 'var(--dd-text-1, #e2e8f0)' }}>
      <Titlebar path="Home" />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '48px', padding: '40px 24px' }}>
        {/* Logo + title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 16,
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, fontWeight: 800, color: '#fff', letterSpacing: -2,
            boxShadow: '0 8px 32px rgba(59,130,246,0.35)',
          }}>
            D
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: 'var(--dd-text-1, #e2e8f0)' }}>
            DevDash
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--dd-text-3, #6b7280)' }}>
            Local development dashboard
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <LandingCard
            icon="dns"
            title="Services"
            description="Monitor and manage local services"
            meta={serviceLabel}
            accent="#3b82f6"
            highlighted
            onClick={goToServices}
            shortcut="S"
          />
          <LandingCard
            icon="play_circle"
            title="Workflows"
            description="Run multi-step dev workflows"
            meta={workflowLabel}
            accent="#8b5cf6"
            onClick={goToWorkflows}
            shortcut="W"
          />
        </div>

        {/* Tip */}
        <p style={{ margin: 0, fontSize: 12, color: 'var(--dd-text-3, #6b7280)', opacity: 0.7 }}>
          Press <KbdInline>S</KbdInline> for Services, <KbdInline>W</KbdInline> for Workflows
        </p>
      </main>

      <StatusBar processCount={0} activeRuns={0} />
    </div>
  );
}

interface LandingCardProps {
  icon: string;
  title: string;
  description: string;
  meta: string;
  accent: string;
  highlighted?: boolean;
  onClick: () => void;
  shortcut: string;
}

function LandingCard({ icon, title, description, meta, accent, highlighted, onClick, shortcut }: LandingCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 280,
        padding: '24px 24px 20px',
        background: hovered
          ? 'var(--dd-bg-3, #1e2130)'
          : highlighted
          ? 'var(--dd-bg-2, #181c27)'
          : 'var(--dd-bg-2, #181c27)',
        border: `1px solid ${hovered ? accent + '60' : 'var(--dd-border, #2a2f3e)'}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? `0 4px 24px ${accent}20` : '0 2px 8px rgba(0,0,0,0.25)',
        outline: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: accent + '20',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={22} style={{ color: accent }} />
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
          color: 'var(--dd-text-3, #6b7280)',
          background: 'var(--dd-bg-1, #0f1117)',
          border: '1px solid var(--dd-border, #2a2f3e)',
          borderRadius: 4, padding: '2px 6px',
        }}>
          {shortcut}
        </span>
      </div>

      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--dd-text-1, #e2e8f0)', marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--dd-text-3, #6b7280)', lineHeight: 1.5 }}>
          {description}
        </div>
      </div>

      <div style={{ fontSize: 12, color: accent, fontWeight: 500, marginTop: 2 }}>
        {meta}
      </div>
    </button>
  );
}

function KbdInline({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: 'inline-block',
      padding: '1px 5px',
      fontSize: 11,
      fontFamily: 'inherit',
      background: 'var(--dd-bg-2, #181c27)',
      border: '1px solid var(--dd-border, #2a2f3e)',
      borderRadius: 4,
      color: 'var(--dd-text-2, #a1a1aa)',
    }}>
      {children}
    </kbd>
  );
}
