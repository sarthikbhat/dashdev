import { useState, useEffect, useRef, useCallback } from 'react';
import { Titlebar, StatusBar } from '../components';
import Icon from '../components/Icon';
import { useServices } from '../hooks/useServices';
import { useServiceGroups } from '../hooks/useServiceGroups';
import { useProcesses } from '../hooks/useProcesses';
import type {
  Service,
  ServiceGroup,
  ServiceCategory,
  HealthCheckType,
  ServiceStatusType,
} from '../types';
import * as api from '../api';

// ── Helpers ───────────────────────────────────────────────────────────────

function statusColor(status?: ServiceStatusType): string {
  if (status === 'healthy') return 'var(--dd-green)';
  if (status === 'down') return 'var(--dd-red)';
  if (status === 'degraded') return 'var(--dd-amber)';
  return 'var(--dd-text-4)';
}

function statusBg(status?: ServiceStatusType): string {
  if (status === 'healthy') return 'rgba(52,211,153,0.10)';
  if (status === 'down') return 'rgba(248,113,113,0.10)';
  if (status === 'degraded') return 'rgba(251,191,36,0.10)';
  return 'rgba(113,113,122,0.10)';
}

function statusBorder(status?: ServiceStatusType): string {
  if (status === 'healthy') return 'rgba(52,211,153,0.18)';
  if (status === 'down') return 'rgba(248,113,113,0.20)';
  if (status === 'degraded') return 'rgba(251,191,36,0.22)';
  return 'rgba(113,113,122,0.18)';
}

function formatUptime(since?: string): string {
  if (!since) return 'down';
  const ms = Date.now() - new Date(since).getTime();
  if (ms < 0) return 'just now';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `up ${d}d ${h % 24}h`;
  if (h > 0) return `up ${h}h ${m % 60}m`;
  if (m > 0) return `up ${m}m`;
  return 'up <1m';
}

// ── ServicesSidebar ───────────────────────────────────────────────────────

interface SidebarProps {
  services: Service[];
  groups: ServiceGroup[];
  activeGroup: string | null; // null = "All"
  selectedServiceId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onSelectService: (serviceId: string) => void;
  onNewGroup: () => void;
}

function ServicesSidebar({
  services,
  groups,
  activeGroup,
  selectedServiceId,
  onSelectGroup,
  onSelectService,
  onNewGroup,
}: SidebarProps) {
  const healthyCount = services.filter((s) => s.status === 'healthy').length;

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
      {/* Groups header */}
      <div
        style={{
          padding: '10px 10px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--dd-text-4)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Groups
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onNewGroup}
          style={{ padding: '2px 6px', fontSize: 11 }}
        >
          <Icon name="add" size={12} />
          New
        </button>
      </div>

      {/* Group list */}
      <div style={{ padding: '0 6px 4px', flexShrink: 0 }}>
        {/* All */}
        <SidebarItem
          label="All"
          count={`${healthyCount}/${services.length}`}
          active={activeGroup === null}
          onClick={() => onSelectGroup(null)}
          icon="apps"
        />
        {groups.map((g) => {
          const members = services.filter((s) => g.service_ids.includes(s.id));
          const running = members.filter((s) => s.status === 'healthy').length;
          return (
            <SidebarItem
              key={g.id}
              label={g.name}
              count={`${running}/${members.length}`}
              active={activeGroup === g.id}
              onClick={() => onSelectGroup(g.id)}
              icon="folder"
            />
          );
        })}
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: 'var(--dd-line)',
          margin: '2px 10px 6px',
          flexShrink: 0,
        }}
      />

      {/* Services header */}
      <div style={{ padding: '4px 10px 6px', flexShrink: 0 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--dd-text-4)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Services
        </span>
      </div>

      {/* Service list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 6px' }}>
        {services.length === 0 && (
          <div
            style={{
              padding: '12px 8px',
              fontSize: 12,
              color: 'var(--dd-text-4)',
              textAlign: 'center',
            }}
          >
            No services
          </div>
        )}
        {services.map((svc) => {
          const isActive = svc.id === selectedServiceId;
          return (
            <button
              key={svc.id}
              onClick={() => onSelectService(svc.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 5,
                border: 'none',
                background: isActive ? 'rgba(96,165,250,0.08)' : 'transparent',
                borderLeft: isActive
                  ? '2px solid var(--dd-blue)'
                  : '2px solid transparent',
                color: isActive ? 'var(--dd-text)' : 'var(--dd-text-2)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 12,
                fontFamily: 'inherit',
                marginBottom: 1,
                transition: 'background 100ms ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'var(--dd-surface-3)';
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'transparent';
              }}
            >
              {/* Status dot */}
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: statusColor(svc.status),
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {svc.name}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  color: 'var(--dd-text-4)',
                  flexShrink: 0,
                }}
              >
                :{svc.port}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SidebarItem({
  label,
  count,
  active,
  onClick,
  icon,
}: {
  label: string;
  count: string;
  active: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 8px',
        borderRadius: 5,
        border: 'none',
        background: active ? 'rgba(96,165,250,0.08)' : 'transparent',
        borderLeft: active
          ? '2px solid var(--dd-blue)'
          : '2px solid transparent',
        color: active ? 'var(--dd-text)' : 'var(--dd-text-2)',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 12,
        fontFamily: 'inherit',
        marginBottom: 1,
        transition: 'background 100ms ease',
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background =
            'var(--dd-surface-3)';
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background =
            'transparent';
      }}
    >
      <Icon name={icon} size={14} style={{ color: 'var(--dd-text-3)' }} />
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <span
        className="mono"
        style={{ fontSize: 10, color: 'var(--dd-text-4)', flexShrink: 0 }}
      >
        {count}
      </span>
    </button>
  );
}

// ── Service Card ──────────────────────────────────────────────────────────

interface ServiceCardProps {
  service: Service;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: 'start' | 'stop' | 'restart', id: string) => void;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
}

function ServiceCard({ service, expanded, onToggle, onAction, onEdit, onDelete }: ServiceCardProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleAction(
    e: React.MouseEvent,
    action: 'start' | 'stop' | 'restart'
  ) {
    e.stopPropagation();
    setActionLoading(action);
    try {
      await onAction(action, service.id);
    } finally {
      setTimeout(() => setActionLoading(null), 800);
    }
  }

  const isHealthy = service.status === 'healthy';
  const isDown = service.status === 'down';

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        borderColor: expanded ? 'var(--dd-blue)' : undefined,
      }}
    >
      <div
        onClick={onToggle}
        style={{
          padding: '12px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          transition: 'background 100ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--dd-surface-3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '';
        }}
      >
        {/* Status dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor(service.status),
            boxShadow: `0 0 0 3px ${statusBg(service.status)}`,
            flexShrink: 0,
            marginTop: 5,
          }}
        />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--dd-text)' }}>
              {service.name}
            </span>
            <span
              className="mono"
              style={{ fontSize: 11, color: 'var(--dd-text-4)' }}
            >
              :{service.port}
            </span>
            <span
              className="badge"
              style={{
                background: statusBg(service.status),
                color: statusColor(service.status),
                borderColor: statusBorder(service.status),
                fontSize: 10,
                padding: '1px 6px',
              }}
            >
              {service.category}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 11,
              color: 'var(--dd-text-3)',
            }}
          >
            {service.detail && (
              <span className="mono" style={{ color: 'var(--dd-text-2)' }}>
                {service.detail}
              </span>
            )}
            <span style={{ color: 'var(--dd-text-4)' }}>
              {service.status === 'healthy'
                ? formatUptime(service.uptime_since)
                : service.status ?? 'unknown'}
            </span>
            {service.pid && (
              <span className="mono" style={{ color: 'var(--dd-text-4)' }}>
                pid {service.pid}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div
          style={{ display: 'flex', gap: 4, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="btn btn-sm"
            style={{
              color: 'var(--dd-green)',
              background:
                actionLoading === 'start'
                  ? 'rgba(52,211,153,0.15)'
                  : 'var(--dd-surface-3)',
              borderColor: 'var(--dd-line-2)',
              opacity: isHealthy ? 0.4 : 1,
            }}
            disabled={isHealthy || actionLoading !== null}
            onClick={(e) => handleAction(e, 'start')}
            title="Start"
          >
            <Icon name="play_arrow" size={14} />
          </button>
          <button
            className="btn btn-sm"
            style={{
              color: 'var(--dd-red)',
              background:
                actionLoading === 'stop'
                  ? 'rgba(248,113,113,0.15)'
                  : 'var(--dd-surface-3)',
              borderColor: 'var(--dd-line-2)',
              opacity: isDown ? 0.4 : 1,
            }}
            disabled={isDown || actionLoading !== null}
            onClick={(e) => handleAction(e, 'stop')}
            title="Stop"
          >
            <Icon name="stop" size={14} />
          </button>
          <button
            className="btn btn-sm"
            style={{
              color: 'var(--dd-amber)',
              background:
                actionLoading === 'restart'
                  ? 'rgba(251,191,36,0.15)'
                  : 'var(--dd-surface-3)',
              borderColor: 'var(--dd-line-2)',
              opacity: isDown ? 0.4 : 1,
            }}
            disabled={isDown || actionLoading !== null}
            onClick={(e) => handleAction(e, 'restart')}
            title="Restart"
          >
            <Icon name="refresh" size={14} />
          </button>
          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 22,
              background: 'var(--dd-line-2)',
              margin: '0 2px',
              alignSelf: 'center',
            }}
          />
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); onEdit(service); }}
            title="Edit service"
            style={{ padding: '3px 6px' }}
          >
            <Icon name="edit" size={13} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); onDelete(service); }}
            title="Delete service"
            style={{ padding: '3px 6px', color: 'var(--dd-red)' }}
          >
            <Icon name="delete" size={13} />
          </button>
        </div>
      </div>

      {/* Expanded log panel */}
      {expanded && <LogPanel serviceId={service.id} />}
    </div>
  );
}

// ── Log Panel ─────────────────────────────────────────────────────────────

function LogPanel({ serviceId }: { serviceId: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await api.getServiceLogs(serviceId);
      setLines(data.lines);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div style={{ borderTop: '1px solid var(--dd-line)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          background: 'var(--dd-surface-3)',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--dd-text-4)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Logs
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={fetchLogs}
          style={{ padding: '2px 6px', fontSize: 11 }}
        >
          <Icon name="refresh" size={12} />
          Refresh
        </button>
      </div>
      <div
        ref={containerRef}
        className="terminal"
        style={{
          maxHeight: 220,
          overflowY: 'auto',
          borderRadius: 0,
          border: 'none',
          borderTop: '1px solid var(--dd-line)',
        }}
      >
        {loading ? (
          <div className="term-line dim">Loading logs...</div>
        ) : error ? (
          <div className="term-line err">{error}</div>
        ) : lines.length === 0 ? (
          <div className="term-line dim">No log output</div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="term-line">
              {line}
            </div>
          ))
        )}
        <span className="term-cursor" />
      </div>
    </div>
  );
}

// ── Group Card ────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: ServiceGroup;
  services: Service[];
  onStartAll: (id: string) => void;
  onStopAll: (id: string) => void;
  onDelete: (group: ServiceGroup) => void;
}

function GroupCard({ group, services, onStartAll, onStopAll, onDelete }: GroupCardProps) {
  const members = services.filter((s) => group.service_ids.includes(s.id));
  const healthy = members.filter((s) => s.status === 'healthy').length;
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(action: 'start' | 'stop') {
    setLoading(action);
    try {
      if (action === 'start') await onStartAll(group.id);
      else await onStopAll(group.id);
    } finally {
      setTimeout(() => setLoading(null), 800);
    }
  }

  return (
    <div
      className="card"
      style={{
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Icon
        name="folder"
        size={18}
        style={{ color: 'var(--dd-text-3)', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--dd-text)' }}>
          {group.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>
          {healthy}/{members.length} healthy
          {members.length > 0 && (
            <span style={{ color: 'var(--dd-text-4)', marginLeft: 8 }}>
              {members.map((m) => m.name).join(', ')}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
        <button
          className="btn btn-sm"
          style={{
            color: 'var(--dd-green)',
            background:
              loading === 'start'
                ? 'rgba(52,211,153,0.15)'
                : 'var(--dd-surface-3)',
            borderColor: 'var(--dd-line-2)',
          }}
          disabled={loading !== null}
          onClick={() => handleAction('start')}
        >
          <Icon name="play_arrow" size={13} />
          Start All
        </button>
        <button
          className="btn btn-sm"
          style={{
            color: 'var(--dd-red)',
            background:
              loading === 'stop'
                ? 'rgba(248,113,113,0.15)'
                : 'var(--dd-surface-3)',
            borderColor: 'var(--dd-line-2)',
          }}
          disabled={loading !== null}
          onClick={() => handleAction('stop')}
        >
          <Icon name="stop" size={13} />
          Stop All
        </button>
        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 22,
            background: 'var(--dd-line-2)',
            margin: '0 2px',
          }}
        />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onDelete(group)}
          title="Delete group"
          style={{ padding: '3px 6px', color: 'var(--dd-red)' }}
        >
          <Icon name="delete" size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────

interface EmptyStateProps {
  onAddService: () => void;
  onImport: () => void;
  importStatus: string | null;
}

function EmptyState({ onAddService, onImport, importStatus }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        gap: 20,
      }}
    >
      <Icon name="dns" size={48} style={{ color: 'var(--dd-line-2)' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--dd-text-2)', marginBottom: 6 }}>
          No services configured
        </div>
        <div style={{ fontSize: 12, color: 'var(--dd-text-4)', maxWidth: 320 }}>
          Add services manually or import your existing backendctl configuration.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Import card */}
        <button
          onClick={onImport}
          disabled={importStatus === 'importing...'}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: '18px 24px',
            borderRadius: 10,
            border: '1px solid var(--dd-line-2)',
            background: 'var(--dd-surface-3)',
            cursor: importStatus === 'importing...' ? 'not-allowed' : 'pointer',
            color: 'var(--dd-text-2)',
            width: 160,
            transition: 'border-color 100ms ease, background 100ms ease',
            fontFamily: 'inherit',
            opacity: importStatus === 'importing...' ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (importStatus !== 'importing...')
              e.currentTarget.style.borderColor = 'var(--dd-blue)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--dd-line-2)';
          }}
        >
          <Icon name="download" size={24} style={{ color: 'var(--dd-blue)' }} />
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            {importStatus === 'importing...' ? 'Importing...' : 'Import from backendctl'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--dd-text-4)', textAlign: 'center' }}>
            Already have a backendctl setup?
          </div>
        </button>
        {/* Add manually card */}
        <button
          onClick={onAddService}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: '18px 24px',
            borderRadius: 10,
            border: '1px solid var(--dd-line-2)',
            background: 'var(--dd-surface-3)',
            cursor: 'pointer',
            color: 'var(--dd-text-2)',
            width: 160,
            transition: 'border-color 100ms ease, background 100ms ease',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--dd-blue)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--dd-line-2)';
          }}
        >
          <Icon name="add_circle" size={24} style={{ color: 'var(--dd-green)' }} />
          <div style={{ fontSize: 12, fontWeight: 600 }}>Add your first service</div>
          <div style={{ fontSize: 11, color: 'var(--dd-text-4)', textAlign: 'center' }}>
            Configure a new service manually
          </div>
        </button>
      </div>
      {importStatus && importStatus !== 'importing...' && (
        <span
          style={{
            fontSize: 11,
            color: importStatus.startsWith('Import failed')
              ? 'var(--dd-red)'
              : 'var(--dd-green)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {importStatus}
        </span>
      )}
    </div>
  );
}

// ── Add/Edit Service Modal ────────────────────────────────────────────────

interface ServiceModalProps {
  editingService?: Service | null;
  onSave: (data: {
    name: string;
    port: number;
    category: ServiceCategory;
    health_check_type: HealthCheckType;
    health_check_value?: string;
    start_command?: string;
    stop_command?: string;
    log_file?: string;
  }) => void;
  onCancel: () => void;
}

function ServiceModal({ editingService, onSave, onCancel }: ServiceModalProps) {
  const isEditing = !!editingService;
  const [name, setName] = useState(editingService?.name ?? '');
  const [port, setPort] = useState(editingService?.port ? String(editingService.port) : '');
  const [category, setCategory] = useState<ServiceCategory>(editingService?.category ?? 'app');
  const [hcType, setHcType] = useState<HealthCheckType>(editingService?.health_check_type ?? 'port');
  const [hcValue, setHcValue] = useState(editingService?.health_check_value ?? '');
  const [startCmd, setStartCmd] = useState(editingService?.start_command ?? '');
  const [stopCmd, setStopCmd] = useState(editingService?.stop_command ?? '');
  const [logFile, setLogFile] = useState(editingService?.log_file ?? '');
  const [validationError, setValidationError] = useState('');

  function handleSave() {
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }
    if (!port || isNaN(Number(port)) || Number(port) <= 0) {
      setValidationError('Valid port number is required');
      return;
    }
    setValidationError('');
    onSave({
      name: name.trim(),
      port: Number(port),
      category,
      health_check_type: hcType,
      health_check_value: hcValue.trim() || undefined,
      start_command: startCmd.trim() || undefined,
      stop_command: stopCmd.trim() || undefined,
      log_file: logFile.trim() || undefined,
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{
          width: 480,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px 12px',
            borderBottom: '1px solid var(--dd-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--dd-text)' }}>
            {isEditing ? 'Edit Service' : 'Add Service'}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
            style={{ padding: 4 }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {validationError && (
            <div
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.20)',
                color: 'var(--dd-red)',
                fontSize: 12,
              }}
            >
              {validationError}
            </div>
          )}

          <FormField label="Name" required>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MySQL"
            />
          </FormField>

          <FormField label="Port" required>
            <input
              className="input"
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="e.g. 3306"
            />
          </FormField>

          <FormField label="Category">
            <div style={{ display: 'flex', gap: 12 }}>
              <RadioOption
                label="App"
                checked={category === 'app'}
                onChange={() => setCategory('app')}
              />
              <RadioOption
                label="Infra"
                checked={category === 'infra'}
                onChange={() => setCategory('infra')}
              />
            </div>
          </FormField>

          <FormField label="Health check type">
            <div style={{ display: 'flex', gap: 12 }}>
              <RadioOption
                label="Port"
                checked={hcType === 'port'}
                onChange={() => setHcType('port')}
              />
              <RadioOption
                label="HTTP"
                checked={hcType === 'http'}
                onChange={() => setHcType('http')}
              />
              <RadioOption
                label="Command"
                checked={hcType === 'command'}
                onChange={() => setHcType('command')}
              />
            </div>
          </FormField>

          {(hcType === 'http' || hcType === 'command') && (
            <FormField label={hcType === 'http' ? 'Health check URL' : 'Health check command'}>
              <input
                className="input"
                value={hcValue}
                onChange={(e) => setHcValue(e.target.value)}
                placeholder={
                  hcType === 'http'
                    ? 'http://localhost:8080/health'
                    : 'redis-cli ping'
                }
              />
            </FormField>
          )}

          <FormField label="Start command">
            <input
              className="input"
              value={startCmd}
              onChange={(e) => setStartCmd(e.target.value)}
              placeholder="e.g. docker start mysql"
            />
          </FormField>

          <FormField label="Stop command">
            <input
              className="input"
              value={stopCmd}
              onChange={(e) => setStopCmd(e.target.value)}
              placeholder="e.g. docker stop mysql"
            />
          </FormField>

          <FormField label="Log file path">
            <input
              className="input"
              value={logFile}
              onChange={(e) => setLogFile(e.target.value)}
              placeholder="/var/log/mysql/error.log (optional)"
            />
          </FormField>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--dd-line)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Icon name={isEditing ? 'save' : 'add'} size={14} />
            {isEditing ? 'Save changes' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Group Modal ────────────────────────────────────────────────────

interface CreateGroupModalProps {
  services: Service[];
  onSave: (data: { name: string; service_ids: string[] }) => void;
  onCancel: () => void;
}

function CreateGroupModal({ services, onSave, onCancel }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [validationError, setValidationError] = useState('');

  function toggleService(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }
    setValidationError('');
    onSave({ name: name.trim(), service_ids: Array.from(selected) });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{
          width: 420,
          maxHeight: '80vh',
          overflowY: 'auto',
          padding: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px 12px',
            borderBottom: '1px solid var(--dd-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--dd-text)' }}>
            Create Group
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
            style={{ padding: 4 }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {validationError && (
            <div
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.20)',
                color: 'var(--dd-red)',
                fontSize: 12,
              }}
            >
              {validationError}
            </div>
          )}

          <FormField label="Group name" required>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Backend Services"
            />
          </FormField>

          <FormField label="Services">
            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                border: '1px solid var(--dd-line-2)',
                borderRadius: 6,
                background: 'var(--dd-surface-3)',
              }}
            >
              {services.length === 0 ? (
                <div
                  style={{
                    padding: '12px 10px',
                    fontSize: 12,
                    color: 'var(--dd-text-4)',
                    textAlign: 'center',
                  }}
                >
                  No services available
                </div>
              ) : (
                services.map((svc) => (
                  <label
                    key={svc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontSize: 12,
                      color: 'var(--dd-text-2)',
                      borderBottom: '1px solid var(--dd-line)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(svc.id)}
                      onChange={() => toggleService(svc.id)}
                      style={{ accentColor: 'var(--dd-blue)' }}
                    />
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: statusColor(svc.status),
                      }}
                    />
                    <span>{svc.name}</span>
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: 'var(--dd-text-4)', marginLeft: 'auto' }}
                    >
                      :{svc.port}
                    </span>
                  </label>
                ))
              )}
            </div>
          </FormField>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--dd-line)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Icon name="add" size={14} />
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Form helpers ──────────────────────────────────────────────────────────

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--dd-text-3)',
          marginBottom: 4,
        }}
      >
        {label}
        {required && (
          <span style={{ color: 'var(--dd-red)', marginLeft: 3 }}>*</span>
        )}
      </label>
      {children}
    </div>
  );
}

function RadioOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        cursor: 'pointer',
        fontSize: 12,
        color: checked ? 'var(--dd-text)' : 'var(--dd-text-3)',
      }}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        style={{ accentColor: 'var(--dd-blue)' }}
      />
      {label}
    </label>
  );
}

// ── Main Services Page ────────────────────────────────────────────────────

export default function Services() {
  const { services, loading, refresh: refreshServices } = useServices();
  const {
    groups,
    refresh: refreshGroups,
  } = useServiceGroups();
  const { processes } = useProcesses();

  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Filter services by active group
  const filteredServices =
    activeGroup === null
      ? services
      : services.filter((s) => {
          const group = groups.find((g) => g.id === activeGroup);
          return group ? group.service_ids.includes(s.id) : false;
        });

  const healthyCount = services.filter((s) => s.status === 'healthy').length;
  const activeRuns = processes.filter((p) => p.status === 'running').length;

  // ── Handlers ──

  async function handleServiceAction(action: 'start' | 'stop' | 'restart', id: string) {
    try {
      if (action === 'start') await api.startService(id);
      else if (action === 'stop') await api.stopService(id);
      else await api.restartService(id);
    } catch (e) {
      console.error(`Failed to ${action} service:`, e);
    }
  }

  async function handleGroupStart(id: string) {
    try {
      await api.startServiceGroup(id);
    } catch (e) {
      console.error('Failed to start group:', e);
    }
  }

  async function handleGroupStop(id: string) {
    try {
      await api.stopServiceGroup(id);
    } catch (e) {
      console.error('Failed to stop group:', e);
    }
  }

  async function handleSaveService(data: Parameters<ServiceModalProps['onSave']>[0]) {
    try {
      if (editingService) {
        await api.updateService(editingService.id, data);
        setEditingService(null);
      } else {
        await api.createService(data);
        setShowAddService(false);
      }
      await refreshServices();
    } catch (e) {
      console.error('Failed to save service:', e);
    }
  }

  function handleCancelServiceModal() {
    setShowAddService(false);
    setEditingService(null);
  }

  async function handleDeleteService(service: Service) {
    if (!window.confirm(`Delete ${service.name}?`)) return;
    try {
      await api.deleteService(service.id);
      await refreshServices();
    } catch (e) {
      console.error('Failed to delete service:', e);
    }
  }

  async function handleCreateGroup(data: { name: string; service_ids: string[] }) {
    try {
      await api.createServiceGroup(data);
      setShowCreateGroup(false);
      await refreshGroups();
    } catch (e) {
      console.error('Failed to create group:', e);
    }
  }

  async function handleDeleteGroup(group: ServiceGroup) {
    if (!window.confirm(`Delete group "${group.name}"?`)) return;
    try {
      await api.deleteServiceGroup(group.id);
      await refreshGroups();
    } catch (e) {
      console.error('Failed to delete group:', e);
    }
  }

  async function handleImport() {
    setImportStatus('importing...');
    try {
      const result = await api.importBackendctl(
        '~/Desktop/code/tm/backend/backendctl'
      );
      setImportStatus(`Imported ${result.imported} service(s)`);
      await refreshServices();
      setTimeout(() => setImportStatus(null), 3000);
    } catch (e) {
      setImportStatus(
        `Import failed: ${e instanceof Error ? e.message : 'unknown error'}`
      );
      setTimeout(() => setImportStatus(null), 4000);
    }
  }

  function handleSelectService(id: string) {
    setSelectedServiceId(id);
    setExpandedServiceId(id);
  }

  function handleToggleExpand(id: string) {
    setExpandedServiceId((prev) => (prev === id ? null : id));
  }

  // Titlebar
  const titlePath = activeGroup
    ? `Services · ${groups.find((g) => g.id === activeGroup)?.name ?? 'Group'}`
    : 'Services';

  const showServiceModal = showAddService || editingService !== null;

  return (
    <div className="dd" style={{ width: '100%', height: '100%' }}>
      <div className="app-window">
        <Titlebar path={titlePath} />

        <ServicesSidebar
          services={services}
          groups={groups}
          activeGroup={activeGroup}
          selectedServiceId={selectedServiceId}
          onSelectGroup={setActiveGroup}
          onSelectService={handleSelectService}
          onNewGroup={() => setShowCreateGroup(true)}
        />

        <main
          style={{
            gridArea: 'main',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--dd-text-4)',
                fontSize: 13,
              }}
            >
              Loading services...
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }}>
              {/* Page header — only shown when services exist */}
              {services.length > 0 && (
                <div className="pg-head" style={{ marginBottom: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h1
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: 'var(--dd-text)',
                        }}
                      >
                        Services
                      </h1>
                      <span
                        className="badge"
                        style={{
                          background: statusBg(
                            healthyCount === services.length
                              ? 'healthy'
                              : healthyCount === 0
                                ? 'down'
                                : 'degraded'
                          ),
                          color: statusColor(
                            healthyCount === services.length
                              ? 'healthy'
                              : healthyCount === 0
                                ? 'down'
                                : 'degraded'
                          ),
                          borderColor: statusBorder(
                            healthyCount === services.length
                              ? 'healthy'
                              : healthyCount === 0
                                ? 'down'
                                : 'degraded'
                          ),
                        }}
                      >
                        <span className="dot" />
                        {healthyCount}/{services.length} healthy
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => setShowAddService(true)}
                      >
                        <Icon name="add" size={14} />
                        Add service
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Service cards or empty state */}
              <div style={{ padding: services.length > 0 ? '16px 24px' : '0' }}>
                {services.length === 0 ? (
                  <EmptyState
                    onAddService={() => setShowAddService(true)}
                    onImport={handleImport}
                    importStatus={importStatus}
                  />
                ) : filteredServices.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '60px 0',
                      gap: 12,
                      color: 'var(--dd-text-4)',
                    }}
                  >
                    <Icon
                      name="dns"
                      size={40}
                      style={{ color: 'var(--dd-line-2)' }}
                    />
                    <div
                      style={{
                        fontSize: 14,
                        color: 'var(--dd-text-3)',
                        fontWeight: 500,
                      }}
                    >
                      No services in this group
                    </div>
                  </div>
                ) : (
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {filteredServices.map((svc) => (
                      <ServiceCard
                        key={svc.id}
                        service={svc}
                        expanded={expandedServiceId === svc.id}
                        onToggle={() => handleToggleExpand(svc.id)}
                        onAction={handleServiceAction}
                        onEdit={(s) => setEditingService(s)}
                        onDelete={handleDeleteService}
                      />
                    ))}
                  </div>
                )}

                {/* Groups section */}
                {groups.length > 0 && services.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--dd-text-2)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Groups
                      </span>
                      <span
                        className="mono"
                        style={{ fontSize: 11, color: 'var(--dd-text-4)' }}
                      >
                        {groups.length}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {groups.map((g) => (
                        <GroupCard
                          key={g.id}
                          group={g}
                          services={services}
                          onStartAll={handleGroupStart}
                          onStopAll={handleGroupStop}
                          onDelete={handleDeleteGroup}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <StatusBar
          processCount={processes.length}
          activeRuns={activeRuns}
          extra={
            <span>
              <span
                style={{
                  color:
                    healthyCount === services.length
                      ? 'var(--dd-green)'
                      : 'var(--dd-amber)',
                }}
              >
                {healthyCount}
              </span>
              /{services.length} svc
            </span>
          }
        />
      </div>

      {/* Modals */}
      {showServiceModal && (
        <ServiceModal
          editingService={editingService}
          onSave={handleSaveService}
          onCancel={handleCancelServiceModal}
        />
      )}
      {showCreateGroup && (
        <CreateGroupModal
          services={services}
          onSave={handleCreateGroup}
          onCancel={() => setShowCreateGroup(false)}
        />
      )}
    </div>
  );
}
