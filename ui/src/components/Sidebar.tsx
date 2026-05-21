import { useState } from 'react';
import Glyph from './Glyph';
import Spinner from './Spinner';
import Tag from './Tag';
import Icon from './Icon';

interface WorkflowEntry {
  id: string;
  name: string;
  ch: string;
  color: string;
  tags?: string[];
  running?: boolean;
}

interface Props {
  workflows: WorkflowEntry[];
  activeId?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export default function Sidebar({ workflows, activeId, onSelect, onCreate }: Props) {
  const [query, setQuery] = useState('');

  const filtered = workflows.filter((w) =>
    w.name.toLowerCase().includes(query.toLowerCase())
  );

  const running = workflows.filter((w) => w.running);

  const allTags = Array.from(new Set(workflows.flatMap((w) => w.tags ?? [])));

  return (
    <div
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
      {/* Header */}
      <div
        style={{
          padding: '10px 12px 8px',
          borderBottom: '1px solid var(--dd-line)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        {/* Logo */}
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
            flexShrink: 0,
            letterSpacing: -0.5,
          }}
        >
          D
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--dd-text)',
              lineHeight: 1.2,
            }}
          >
            DevDash
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--dd-text-4)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            ~/Desktop/code/tm
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Icon
            name="search"
            size={13}
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--dd-text-4)',
              pointerEvents: 'none',
            }}
          />
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter workflows…"
            style={{ paddingLeft: 26, fontSize: 12, height: 28 }}
          />
        </div>
      </div>

      {/* Workflow list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 6px' }}>
        {filtered.length === 0 && (
          <div
            style={{
              padding: '12px 8px',
              fontSize: 12,
              color: 'var(--dd-text-4)',
              textAlign: 'center',
            }}
          >
            No workflows found
          </div>
        )}
        {filtered.map((wf) => {
          const isActive = wf.id === activeId;
          return (
            <button
              key={wf.id}
              onClick={() => onSelect(wf.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 5,
                border: 'none',
                background: isActive ? 'rgba(96,165,250,0.08)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--dd-blue)' : '2px solid transparent',
                color: isActive ? 'var(--dd-text)' : 'var(--dd-text-2)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 13,
                fontFamily: 'inherit',
                marginBottom: 1,
                transition: 'background 100ms ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--dd-surface-3)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <Glyph ch={wf.ch} color={wf.color} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {wf.name}
              </span>
              {wf.running && <Spinner />}
            </button>
          );
        })}
      </div>

      {/* Tags section */}
      {allTags.length > 0 && (
        <div
          style={{
            padding: '8px 10px',
            borderTop: '1px solid var(--dd-line)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: 'var(--dd-text-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            Tags
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {allTags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        </div>
      )}

      {/* Running section */}
      {running.length > 0 && (
        <div
          style={{
            padding: '8px 10px',
            borderTop: '1px solid var(--dd-line)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: 'var(--dd-text-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            Running
          </div>
          {running.map((wf) => (
            <div
              key={wf.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--dd-amber)',
                marginBottom: 3,
              }}
            >
              <Spinner />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {wf.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer: Create button */}
      <div
        style={{
          padding: '8px 10px',
          borderTop: '1px solid var(--dd-line)',
          flexShrink: 0,
        }}
      >
        <button
          className="btn btn-secondary"
          onClick={onCreate}
          style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
        >
          <Icon name="add" size={14} />
          Create workflow
        </button>
      </div>
    </div>
  );
}
