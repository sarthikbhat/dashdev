import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import Icon from './Icon';
import StatusBar from './StatusBar';
import { useProcesses } from '../hooks/useProcesses';

const NAV_ITEMS = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/services', icon: 'dns', label: 'Services' },
  { path: '/workflows', icon: 'play_circle', label: 'Workflows' },
  { path: '/cicd', icon: 'rocket_launch', label: 'CI/CD' },
  { path: '/git', icon: 'fork_right', label: 'Git' },
  { path: '/redis', icon: 'storage', label: 'Redis' },
];

const BOTTOM_ITEMS = [
  { path: '/history', icon: 'history', label: 'History' },
];

function NavButton({ item, active, onClick }: { item: { path: string; icon: string; label: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`nav-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      title={item.label}
    >
      <Icon name={item.icon} size={20} />
      <span className="nav-label">{item.label}</span>
    </button>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { processes } = useProcesses();
  const activeRuns = processes.filter((p) => p.status === 'running').length;

  function isActive(itemPath: string): boolean {
    if (itemPath === '/') return location.pathname === '/';
    if (itemPath === '/workflows') {
      return location.pathname.startsWith('/workflow') && !location.pathname.includes('/edit');
    }
    return location.pathname.startsWith(itemPath);
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <nav className="app-sidebar">
        <div className="sidebar-logo" onClick={() => navigate('/')} title="DevDash">
          D
        </div>

        {NAV_ITEMS.map((item) => (
          <NavButton key={item.path} item={item} active={isActive(item.path)} onClick={() => navigate(item.path)} />
        ))}

        <div className="sidebar-spacer" />

        {BOTTOM_ITEMS.map((item) => (
          <NavButton key={item.path} item={item} active={isActive(item.path)} onClick={() => navigate(item.path)} />
        ))}
      </nav>

      {/* Main content */}
      <div className="app-content">
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <Outlet />
        </div>
        <StatusBar processCount={processes.length} activeRuns={activeRuns} />
      </div>
    </div>
  );
}
