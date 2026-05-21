/* global React */
const { useState, useEffect, useRef } = React;

// =============================================================================
// Shared primitives
// =============================================================================

function Icon({ name, size = 18, fill = false, className = '', style }) {
  const cls = ['icon', fill ? 'fill' : '', className].filter(Boolean).join(' ');
  return <span className={cls} style={{ fontSize: size, ...style }}>{name}</span>;
}

function Kbd({ children }) {
  return <span className="kbd">{children}</span>;
}

function Badge({ kind = 'info', children, dot = true }) {
  return (
    <span className={`badge ${kind}`}>
      {dot && <span className="dot"></span>}
      {children}
    </span>
  );
}

function Tag({ children }) {
  return <span className="tag">{children}</span>;
}

function Spinner({ blue = false }) {
  return <div className={`spinner ${blue ? 'blue' : ''}`}></div>;
}

// Color-coded glyph (the kind that sits next to workflow names — small monogram)
function Glyph({ ch, color = 'var(--dd-blue)' }) {
  return (
    <span
      className="glyph"
      style={{
        background: `${color}22`,
        color: color,
        border: `1px solid ${color}33`,
        fontWeight: 600,
      }}
    >{ch}</span>
  );
}

// =============================================================================
// App shell (used by Dashboard, Run View, Editor, History)
// =============================================================================

const WORKFLOWS = [
  { id: 'deploy-prod',    name: 'Deploy to production',     ch: 'D', color: 'var(--dd-red)',    tags: ['deploy', 'prod'],   active: false, running: false },
  { id: 'deploy-staging', name: 'Deploy to staging',        ch: 'D', color: 'var(--dd-amber)',  tags: ['deploy', 'staging'], active: true,  running: true  },
  { id: 'db-migrate',     name: 'Run DB migrations',        ch: 'M', color: 'var(--dd-purple)', tags: ['db'],               active: false, running: false },
  { id: 'feature-flags',  name: 'Toggle feature flags',     ch: 'F', color: 'var(--dd-blue)',   tags: ['flags'],            active: false, running: false },
  { id: 'restart-api',    name: 'Restart API services',     ch: 'R', color: 'var(--dd-cyan)',   tags: ['ops'],              active: false, running: true  },
  { id: 'seed-db',        name: 'Seed dev database',        ch: 'S', color: 'var(--dd-green)',  tags: ['db', 'dev'],        active: false, running: false },
  { id: 'rotate-keys',    name: 'Rotate API keys',          ch: 'K', color: 'var(--dd-amber)',  tags: ['security'],         active: false, running: false },
  { id: 'purge-cache',    name: 'Purge CDN cache',          ch: 'C', color: 'var(--dd-blue)',   tags: ['ops', 'cdn'],       active: false, running: false },
  { id: 'gen-changelog',  name: 'Generate changelog',       ch: 'G', color: 'var(--dd-purple)', tags: ['release'],          active: false, running: false },
  { id: 'sync-secrets',   name: 'Sync secrets from vault',  ch: 'S', color: 'var(--dd-cyan)',   tags: ['security'],         active: false, running: false },
];

function Titlebar({ path }) {
  return (
    <div className="titlebar">
      <div className="traffic"><span></span><span></span><span></span></div>
      <div className="url">
        <span style={{ color: 'var(--dd-text-4)' }}>localhost:3847</span>
        <span style={{ color: 'var(--dd-text-4)', margin: '0 6px' }}>›</span>
        <b>{path}</b>
      </div>
      <div className="right">
        <span className="mono" style={{ color: 'var(--dd-text-3)' }}>v0.4.2</span>
        <Icon name="search" size={13} style={{ color: 'var(--dd-text-3)' }} />
        <Kbd>⌘K</Kbd>
      </div>
    </div>
  );
}

function Sidebar({ activeId = 'deploy-staging', filter = '' }) {
  const [q, setQ] = useState(filter);
  const filtered = WORKFLOWS.filter(w => !q || w.name.toLowerCase().includes(q.toLowerCase()) || w.tags.some(t => t.includes(q.toLowerCase())));
  const running = WORKFLOWS.filter(w => w.running);

  return (
    <aside className="sidebar">
      {/* App identity */}
      <div style={{ padding: '10px 12px 8px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--dd-line)' }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: 'linear-gradient(135deg, #60a5fa, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0a0c', fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-mono)' }}>D</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dd-text)', letterSpacing: '-0.005em' }}>DevDash</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--dd-text-4)' }}>~/projects/devdash</div>
        </div>
        <Icon name="unfold_more" size={14} style={{ color: 'var(--dd-text-4)' }} />
      </div>

      {/* Search */}
      <div style={{ padding: '8px 8px 4px' }}>
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={13} style={{ position: 'absolute', left: 8, top: 7, color: 'var(--dd-text-4)' }} />
          <input className="input" style={{ paddingLeft: 26, fontSize: 12 }} placeholder="Filter workflows…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {/* Workflows list */}
      <div className="sidebar-section" style={{ overflow: 'auto', flex: 1 }}>
        <div className="sidebar-title">
          <span>Workflows</span>
          <span className="count">{filtered.length}</span>
        </div>
        {filtered.map(w => (
          <div key={w.id} className={`sidebar-item ${w.id === activeId ? 'active' : ''}`}>
            <Glyph ch={w.ch} color={w.color} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
            {w.running && <Spinner />}
          </div>
        ))}

        {/* Tags filter group */}
        <div className="sidebar-title" style={{ marginTop: 12 }}>
          <span>Tags</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '2px 8px 4px' }}>
          {['deploy', 'prod', 'staging', 'db', 'ops', 'flags', 'security', 'release'].map(t =>
            <Tag key={t}>{t}</Tag>
          )}
        </div>

        {/* Running */}
        {running.length > 0 && (
          <>
            <div className="sidebar-title" style={{ marginTop: 12 }}>
              <span style={{ color: 'var(--dd-amber)' }}>Running</span>
              <span className="count" style={{ color: 'var(--dd-amber)' }}>{running.length}</span>
            </div>
            {running.map(w => (
              <div key={w.id} className="sidebar-item">
                <Spinner />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{w.name}</span>
                <span className="meta">02:14</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* + Create */}
      <div style={{ padding: '8px', borderTop: '1px solid var(--dd-line)' }}>
        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.dcGoTo?.('editor')}>
          <Icon name="add" size={14} />Create workflow
          <span style={{ marginLeft: 'auto' }}><Kbd>⌘N</Kbd></span>
        </button>
      </div>
    </aside>
  );
}

function StatusBar({ extra }) {
  return (
    <div className="statusbar">
      <span className="item"><span className="pulse"></span>Server up · 14d 3h</span>
      <span style={{ color: 'var(--dd-line-2)' }}>│</span>
      <span className="item"><Icon name="memory" size={12} />CPU 18%</span>
      <span className="item"><Icon name="storage" size={12} />MEM 412MB / 8GB</span>
      <span style={{ color: 'var(--dd-line-2)' }}>│</span>
      <span className="item"><Icon name="terminal" size={12} />2 running</span>
      <span className="item"><Icon name="history" size={12} />247 runs</span>
      {extra && <><span style={{ color: 'var(--dd-line-2)' }}>│</span>{extra}</>}
      <span className="spacer"></span>
      <span className="item">node v20.11.1</span>
      <span className="item">port 3847</span>
      <span className="item"><Icon name="podcasts" size={12} />ws://localhost:3847</span>
    </div>
  );
}

// Make available to other scripts
Object.assign(window, { Icon, Kbd, Badge, Tag, Spinner, Glyph, Titlebar, Sidebar, StatusBar, WORKFLOWS });
