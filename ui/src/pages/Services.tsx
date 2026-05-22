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

// ── Toast system ─────────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

let toastCounter = 0;

function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 40,
        right: 16,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 6,
        maxWidth: 360,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background:
              t.type === 'error'
                ? 'rgba(248,113,113,0.12)'
                : t.type === 'success'
                  ? 'rgba(52,211,153,0.12)'
                  : 'rgba(96,165,250,0.12)',
            border: `1px solid ${
              t.type === 'error'
                ? 'rgba(248,113,113,0.25)'
                : t.type === 'success'
                  ? 'rgba(52,211,153,0.25)'
                  : 'rgba(96,165,250,0.25)'
            }`,
            color:
              t.type === 'error'
                ? 'var(--dd-red)'
                : t.type === 'success'
                  ? 'var(--dd-green)'
                  : 'var(--dd-blue)',
            animation: 'dd-toast-in 200ms ease',
          }}
        >
          <Icon
            name={
              t.type === 'error'
                ? 'error'
                : t.type === 'success'
                  ? 'check_circle'
                  : 'info'
            }
            size={14}
          />
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: 0,
              display: 'flex',
              opacity: 0.6,
            }}
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Sidebar (simple service list) ────────────────────────────────────────

interface SidebarProps {
  services: Service[];
  search: string;
  onSearchChange: (v: string) => void;
  highlightedServiceId: string | null;
  onSelectService: (id: string) => void;
}

function ServicesSidebar({
  services,
  search,
  onSearchChange,
  highlightedServiceId,
  onSelectService,
}: SidebarProps) {
  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

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
      {/* Search */}
      <div style={{ padding: '10px 8px 6px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Icon
            name="search"
            size={14}
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
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search services..."
            style={{ paddingLeft: 28, fontSize: 12, padding: '5px 8px 5px 28px' }}
          />
        </div>
      </div>

      {/* Services header */}
      <div style={{ padding: '6px 10px 4px', flexShrink: 0 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--dd-text-4)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Services ({filtered.length})
        </span>
      </div>

      {/* Service list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 6px' }}>
        {filtered.length === 0 && (
          <div
            style={{
              padding: '12px 8px',
              fontSize: 12,
              color: 'var(--dd-text-4)',
              textAlign: 'center',
            }}
          >
            {search ? 'No matches' : 'No services'}
          </div>
        )}
        {filtered.map((svc) => {
          const isActive = svc.id === highlightedServiceId;
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

// ── Log Panel ─────────────────────────────────────────────────────────────

function LogPanel({ serviceId, serviceName, onClose }: { serviceId: string; serviceName: string; onClose: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await api.getServiceLogs(serviceId);
      setLines(data.lines.slice(-200));
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
    <div
      style={{
        borderTop: '1px solid var(--dd-line)',
        background: 'var(--dd-surface)',
      }}
    >
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
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--dd-text-3)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="terminal" size={13} />
          Logs: {serviceName}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={fetchLogs}
            style={{ padding: '2px 6px', fontSize: 11 }}
          >
            <Icon name="refresh" size={12} />
            Refresh
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: '2px 6px', fontSize: 11 }}
          >
            <Icon name="close" size={12} />
            Close
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="terminal"
        style={{
          maxHeight: 260,
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

// ── Group Card (for groups section below table) ──────────────────────────

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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 8,
        background: 'var(--dd-surface-2)',
        border: '1px solid var(--dd-line)',
        fontSize: 12,
      }}
    >
      <Icon name="folder" size={14} style={{ color: 'var(--dd-text-3)' }} />
      <span style={{ fontWeight: 600, color: 'var(--dd-text)' }}>{group.name}</span>
      <span className="mono" style={{ fontSize: 10, color: 'var(--dd-text-4)' }}>
        {healthy}/{members.length}
      </span>
      <button
        className="btn btn-sm"
        style={{
          color: 'var(--dd-green)',
          background: loading === 'start' ? 'rgba(52,211,153,0.15)' : 'var(--dd-surface-3)',
          borderColor: 'var(--dd-line-2)',
          padding: '2px 6px',
        }}
        disabled={loading !== null}
        onClick={() => handleAction('start')}
        title="Start all"
      >
        <Icon name="play_arrow" size={12} />
      </button>
      <button
        className="btn btn-sm"
        style={{
          color: 'var(--dd-red)',
          background: loading === 'stop' ? 'rgba(248,113,113,0.15)' : 'var(--dd-surface-3)',
          borderColor: 'var(--dd-line-2)',
          padding: '2px 6px',
        }}
        disabled={loading !== null}
        onClick={() => handleAction('stop')}
        title="Stop all"
      >
        <Icon name="stop" size={12} />
      </button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onDelete(group)}
        title="Delete group"
        style={{ padding: '2px 4px', color: 'var(--dd-red)' }}
      >
        <Icon name="delete" size={12} />
      </button>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────

function EmptyState({ onAddService }: { onAddService: () => void }) {
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
          Add services to monitor their health and manage them from here.
        </div>
      </div>
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

// ── Inline Spinner ────────────────────────────────────────────────────────

function SmallSpinner({ color }: { color?: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        border: `1.5px solid ${color ? color + '33' : 'var(--dd-text-4)'}`,
        borderTopColor: color || 'var(--dd-text-2)',
        borderRadius: '50%',
        animation: 'dd-spin 0.7s linear infinite',
      }}
    />
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
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [highlightedServiceId, setHighlightedServiceId] = useState<string | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [logServiceId, setLogServiceId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<Map<string, string>>(new Map());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);

  // ── Toast helpers ──
  const addToast = useCallback((message: string, type: Toast['type']) => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Filter services by active group ──
  const filteredServices =
    activeGroup === null
      ? services
      : services.filter((s) => {
          const group = groups.find((g) => g.id === activeGroup);
          return group ? group.service_ids.includes(s.id) : false;
        });

  const healthyCount = services.filter((s) => s.status === 'healthy').length;
  const activeRuns = processes.filter((p) => p.status === 'running').length;

  // Filtered IDs set for select-all
  const filteredIds = new Set(filteredServices.map((s) => s.id));
  const selectedInView = new Set([...selectedIds].filter((id) => filteredIds.has(id)));
  const allFilteredSelected = filteredServices.length > 0 && selectedInView.size === filteredServices.length;

  // ── Action loading helpers ──
  function setActionLoadingKey(key: string, action: string) {
    setActionLoading((prev) => new Map(prev).set(key, action));
  }
  function clearActionLoadingKey(key: string) {
    setActionLoading((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  // ── Handlers ──

  async function handleServiceAction(action: 'start' | 'stop' | 'restart', id: string) {
    const svc = services.find((s) => s.id === id);
    const svcName = svc?.name ?? id;
    const key = `${id}-${action}`;
    setActionLoadingKey(key, action);
    addToast(`${action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : 'Restarting'} ${svcName}...`, 'info');
    try {
      if (action === 'start') await api.startService(id);
      else if (action === 'stop') await api.stopService(id);
      else await api.restartService(id);
      addToast(`${svcName} ${action === 'start' ? 'started' : action === 'stop' ? 'stopped' : 'restarted'}`, 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addToast(`Failed to ${action} ${svcName}: ${msg}`, 'error');
    } finally {
      setTimeout(() => clearActionLoadingKey(key), 2000);
    }
  }

  async function handleBulkAction(action: 'start' | 'stop') {
    const ids = [...selectedInView];
    if (ids.length === 0) return;
    setBulkLoading(action);
    addToast(`${action === 'start' ? 'Starting' : 'Stopping'} ${ids.length} services...`, 'info');
    let successes = 0;
    let failures = 0;
    for (const id of ids) {
      try {
        if (action === 'start') await api.startService(id);
        else await api.stopService(id);
        successes++;
      } catch {
        failures++;
      }
    }
    if (failures > 0) {
      addToast(`${action === 'start' ? 'Started' : 'Stopped'} ${successes}/${ids.length} (${failures} failed)`, 'error');
    } else {
      addToast(`${action === 'start' ? 'Started' : 'Stopped'} ${successes} services`, 'success');
    }
    setSelectedIds(new Set());
    setBulkLoading(null);
  }

  async function handleGroupStart(id: string) {
    const grp = groups.find((g) => g.id === id);
    addToast(`Starting group ${grp?.name ?? id}...`, 'info');
    try {
      await api.startServiceGroup(id);
      addToast(`Group ${grp?.name ?? id} started`, 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addToast(`Failed to start group: ${msg}`, 'error');
    }
  }

  async function handleGroupStop(id: string) {
    const grp = groups.find((g) => g.id === id);
    addToast(`Stopping group ${grp?.name ?? id}...`, 'info');
    try {
      await api.stopServiceGroup(id);
      addToast(`Group ${grp?.name ?? id} stopped`, 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addToast(`Failed to stop group: ${msg}`, 'error');
    }
  }

  async function handleSaveService(data: Parameters<ServiceModalProps['onSave']>[0]) {
    try {
      if (editingService) {
        await api.updateService(editingService.id, data);
        setEditingService(null);
        addToast(`${data.name} updated`, 'success');
      } else {
        await api.createService(data);
        setShowAddService(false);
        addToast(`${data.name} added`, 'success');
      }
      await refreshServices();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addToast(`Failed to save service: ${msg}`, 'error');
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
      addToast(`${service.name} deleted`, 'success');
      await refreshServices();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addToast(`Failed to delete: ${msg}`, 'error');
    }
  }

  async function handleCreateGroup(data: { name: string; service_ids: string[] }) {
    try {
      await api.createServiceGroup(data);
      setShowCreateGroup(false);
      addToast(`Group "${data.name}" created`, 'success');
      await refreshGroups();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addToast(`Failed to create group: ${msg}`, 'error');
    }
  }

  async function handleDeleteGroup(group: ServiceGroup) {
    if (!window.confirm(`Delete group "${group.name}"?`)) return;
    try {
      await api.deleteServiceGroup(group.id);
      addToast(`Group "${group.name}" deleted`, 'success');
      if (activeGroup === group.id) setActiveGroup(null);
      await refreshGroups();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addToast(`Failed to delete group: ${msg}`, 'error');
    }
  }

  function handleSidebarSelect(id: string) {
    setHighlightedServiceId(id);
    // Scroll the service row into view
    setTimeout(() => {
      const row = document.getElementById(`svc-row-${id}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.style.background = 'rgba(96,165,250,0.08)';
        setTimeout(() => {
          row.style.background = '';
        }, 1500);
      }
    }, 50);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      // Deselect all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of filteredIds) next.delete(id);
        return next;
      });
    } else {
      // Select all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of filteredIds) next.add(id);
        return next;
      });
    }
  }

  // Titlebar
  const titlePath = activeGroup
    ? `Services · ${groups.find((g) => g.id === activeGroup)?.name ?? 'Group'}`
    : 'Services';

  const showServiceModal = showAddService || editingService !== null;
  const logService = logServiceId ? services.find((s) => s.id === logServiceId) : null;

  return (
    <div className="dd" style={{ width: '100%', height: '100%' }}>
      <div className="app-window">
        <Titlebar path={titlePath} />

        <ServicesSidebar
          services={services}
          search={sidebarSearch}
          onSearchChange={setSidebarSearch}
          highlightedServiceId={highlightedServiceId}
          onSelectService={handleSidebarSelect}
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
          ) : services.length === 0 ? (
            <EmptyState onAddService={() => setShowAddService(true)} />
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }} ref={tableRef}>
              {/* Header bar */}
              <div className="pg-head" style={{ marginBottom: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    marginBottom: 12,
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
                      className="btn btn-secondary"
                      onClick={() => setShowCreateGroup(true)}
                    >
                      <Icon name="create_new_folder" size={14} />
                      New group
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowAddService(true)}
                    >
                      <Icon name="add" size={14} />
                      Add service
                    </button>
                  </div>
                </div>

                {/* Group filter pills */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <FilterPill
                    label="All"
                    count={services.length}
                    active={activeGroup === null}
                    onClick={() => setActiveGroup(null)}
                  />
                  {groups.map((g) => {
                    const members = services.filter((s) => g.service_ids.includes(s.id));
                    return (
                      <FilterPill
                        key={g.id}
                        label={g.name}
                        count={members.length}
                        active={activeGroup === g.id}
                        onClick={() => setActiveGroup(g.id)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Bulk action bar */}
              {selectedInView.size > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 24px',
                    background: 'rgba(96,165,250,0.06)',
                    borderBottom: '1px solid var(--dd-line)',
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--dd-blue)' }}>
                    {selectedInView.size} selected
                  </span>
                  <button
                    className="btn btn-sm"
                    style={{
                      color: 'var(--dd-green)',
                      background: 'var(--dd-surface-3)',
                      borderColor: 'var(--dd-line-2)',
                    }}
                    disabled={bulkLoading !== null}
                    onClick={() => handleBulkAction('start')}
                  >
                    {bulkLoading === 'start' ? (
                      <SmallSpinner color="var(--dd-green)" />
                    ) : (
                      <Icon name="play_arrow" size={13} />
                    )}
                    Start selected
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{
                      color: 'var(--dd-red)',
                      background: 'var(--dd-surface-3)',
                      borderColor: 'var(--dd-line-2)',
                    }}
                    disabled={bulkLoading !== null}
                    onClick={() => handleBulkAction('stop')}
                  >
                    {bulkLoading === 'stop' ? (
                      <SmallSpinner color="var(--dd-red)" />
                    ) : (
                      <Icon name="stop" size={13} />
                    )}
                    Stop selected
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Deselect all
                  </button>
                </div>
              )}

              {/* Service table */}
              <div style={{ padding: '0 24px 16px' }}>
                {filteredServices.length === 0 ? (
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
                    <Icon name="dns" size={40} style={{ color: 'var(--dd-line-2)' }} />
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
                  <table className="dd-table" style={{ marginTop: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 36, padding: '8px 10px' }}>
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleSelectAll}
                            style={{ accentColor: 'var(--dd-blue)' }}
                          />
                        </th>
                        <th style={{ width: 60 }}>Status</th>
                        <th>Name</th>
                        <th style={{ width: 80 }}>Port</th>
                        <th style={{ width: 80 }}>Category</th>
                        <th>Health Detail</th>
                        <th style={{ width: 90 }}>Uptime</th>
                        <th style={{ width: 190 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredServices.map((svc) => {
                        const isHealthy = svc.status === 'healthy';
                        const isDown = svc.status === 'down';
                        const startKey = `${svc.id}-start`;
                        const stopKey = `${svc.id}-stop`;
                        const restartKey = `${svc.id}-restart`;
                        const anyLoading =
                          actionLoading.has(startKey) ||
                          actionLoading.has(stopKey) ||
                          actionLoading.has(restartKey);

                        return (
                          <tr
                            key={svc.id}
                            id={`svc-row-${svc.id}`}
                            style={{
                              transition: 'background 300ms ease',
                            }}
                          >
                            {/* Checkbox */}
                            <td style={{ padding: '10px 10px' }}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(svc.id)}
                                onChange={() => toggleSelect(svc.id)}
                                style={{ accentColor: 'var(--dd-blue)' }}
                              />
                            </td>

                            {/* Status dot */}
                            <td>
                              <div
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: statusColor(svc.status),
                                  boxShadow: `0 0 0 3px ${statusBg(svc.status)}`,
                                  display: 'inline-block',
                                }}
                              />
                            </td>

                            {/* Name */}
                            <td>
                              <span style={{ fontWeight: 600, color: 'var(--dd-text)' }}>
                                {svc.name}
                              </span>
                            </td>

                            {/* Port */}
                            <td>
                              <span className="mono" style={{ fontSize: 12 }}>
                                :{svc.port}
                              </span>
                            </td>

                            {/* Category */}
                            <td>
                              <span
                                className="badge"
                                style={{
                                  background: statusBg(svc.status),
                                  color: statusColor(svc.status),
                                  borderColor: statusBorder(svc.status),
                                  fontSize: 10,
                                  padding: '1px 6px',
                                }}
                              >
                                {svc.category}
                              </span>
                            </td>

                            {/* Health detail */}
                            <td>
                              <span
                                className="mono"
                                style={{
                                  fontSize: 11,
                                  color: isDown ? 'var(--dd-red)' : 'var(--dd-text-3)',
                                }}
                              >
                                {svc.detail || (isDown ? 'unreachable' : '--')}
                              </span>
                            </td>

                            {/* Uptime */}
                            <td>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: isDown ? 'var(--dd-red)' : 'var(--dd-text-3)',
                                  fontWeight: isDown ? 600 : 400,
                                }}
                              >
                                {isHealthy || svc.status === 'degraded'
                                  ? formatUptime(svc.uptime_since)
                                  : 'down'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td>
                              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                                {/* Start */}
                                {!isHealthy && (
                                  <button
                                    className="btn btn-sm"
                                    style={{
                                      color: 'var(--dd-green)',
                                      background: actionLoading.has(startKey)
                                        ? 'rgba(52,211,153,0.15)'
                                        : 'var(--dd-surface-3)',
                                      borderColor: 'var(--dd-line-2)',
                                      padding: '3px 6px',
                                    }}
                                    disabled={anyLoading}
                                    onClick={() => handleServiceAction('start', svc.id)}
                                    title="Start"
                                  >
                                    {actionLoading.has(startKey) ? (
                                      <SmallSpinner color="var(--dd-green)" />
                                    ) : (
                                      <Icon name="play_arrow" size={13} />
                                    )}
                                  </button>
                                )}

                                {/* Stop */}
                                {isHealthy && (
                                  <button
                                    className="btn btn-sm"
                                    style={{
                                      color: 'var(--dd-red)',
                                      background: actionLoading.has(stopKey)
                                        ? 'rgba(248,113,113,0.15)'
                                        : 'var(--dd-surface-3)',
                                      borderColor: 'var(--dd-line-2)',
                                      padding: '3px 6px',
                                    }}
                                    disabled={anyLoading}
                                    onClick={() => handleServiceAction('stop', svc.id)}
                                    title="Stop"
                                  >
                                    {actionLoading.has(stopKey) ? (
                                      <SmallSpinner color="var(--dd-red)" />
                                    ) : (
                                      <Icon name="stop" size={13} />
                                    )}
                                  </button>
                                )}

                                {/* Restart */}
                                <button
                                  className="btn btn-sm"
                                  style={{
                                    color: 'var(--dd-amber)',
                                    background: actionLoading.has(restartKey)
                                      ? 'rgba(251,191,36,0.15)'
                                      : 'var(--dd-surface-3)',
                                    borderColor: 'var(--dd-line-2)',
                                    padding: '3px 6px',
                                    opacity: isDown ? 0.4 : 1,
                                  }}
                                  disabled={anyLoading || isDown}
                                  onClick={() => handleServiceAction('restart', svc.id)}
                                  title="Restart"
                                >
                                  {actionLoading.has(restartKey) ? (
                                    <SmallSpinner color="var(--dd-amber)" />
                                  ) : (
                                    <Icon name="refresh" size={13} />
                                  )}
                                </button>

                                {/* Divider */}
                                <div
                                  style={{
                                    width: 1,
                                    height: 18,
                                    background: 'var(--dd-line-2)',
                                    margin: '0 2px',
                                  }}
                                />

                                {/* Edit */}
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setEditingService(svc)}
                                  title="Edit"
                                  style={{ padding: '3px 5px' }}
                                >
                                  <Icon name="edit" size={13} />
                                </button>

                                {/* Logs */}
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() =>
                                    setLogServiceId((prev) =>
                                      prev === svc.id ? null : svc.id
                                    )
                                  }
                                  title="Logs"
                                  style={{
                                    padding: '3px 5px',
                                    color:
                                      logServiceId === svc.id
                                        ? 'var(--dd-blue)'
                                        : undefined,
                                  }}
                                >
                                  <Icon name="terminal" size={13} />
                                </button>

                                {/* Delete */}
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handleDeleteService(svc)}
                                  title="Delete"
                                  style={{ padding: '3px 5px', color: 'var(--dd-red)' }}
                                >
                                  <Icon name="delete" size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* Log panel */}
                {logService && (
                  <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--dd-line)' }}>
                    <LogPanel
                      serviceId={logService.id}
                      serviceName={logService.name}
                      onClose={() => setLogServiceId(null)}
                    />
                  </div>
                )}

                {/* Groups section */}
                {groups.length > 0 && (
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
                        flexWrap: 'wrap',
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

      {/* Toasts */}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

// ── Filter Pill ───────────────────────────────────────────────────────────

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 9999,
        border: `1px solid ${active ? 'var(--dd-blue)' : 'var(--dd-line-2)'}`,
        background: active ? 'rgba(96,165,250,0.10)' : 'var(--dd-surface-3)',
        color: active ? 'var(--dd-blue)' : 'var(--dd-text-2)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'inherit',
        transition: 'all 120ms ease',
      }}
    >
      {label}
      <span
        className="mono"
        style={{ fontSize: 10, opacity: 0.7 }}
      >
        {count}
      </span>
    </button>
  );
}
