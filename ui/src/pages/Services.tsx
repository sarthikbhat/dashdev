import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../components/Icon';
import { DialogModal } from '../components/DialogModal';
import { useServices } from '../hooks/useServices';
import { useServiceGroups } from '../hooks/useServiceGroups';
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

function statusLabel(status?: ServiceStatusType): string {
  if (status === 'healthy') return 'Healthy';
  if (status === 'down') return 'Down';
  if (status === 'degraded') return 'Degraded';
  return 'Unknown';
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

// ── Log Panel (slide-up from bottom) ─────────────────────────────────────

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
        position: 'fixed',
        bottom: 28,
        left: 0,
        right: 0,
        zIndex: 90,
        background: 'var(--dd-surface)',
        borderTop: '1px solid var(--dd-line)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.25)',
        animation: 'dd-slide-up 200ms ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 20px',
          background: 'var(--dd-surface-2)',
          borderBottom: '1px solid var(--dd-line)',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--dd-text-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Icon name="terminal" size={14} style={{ color: 'var(--dd-text-3)' }} />
          Logs: {serviceName}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={fetchLogs}
            style={{ padding: '3px 8px', fontSize: 11 }}
            title="Refresh logs"
          >
            <Icon name="refresh" size={13} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: '3px 8px', fontSize: 11 }}
            title="Close logs"
          >
            <Icon name="close" size={13} />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="terminal"
        style={{
          maxHeight: 280,
          overflowY: 'auto',
          borderRadius: 0,
          border: 'none',
          margin: 0,
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

// ── Group Card (compact horizontal strip) ──────────────────────────────

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

  const allHealthy = healthy === members.length && members.length > 0;
  const noneHealthy = healthy === 0 && members.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderRadius: 10,
        background: 'var(--dd-surface)',
        border: '1px solid var(--dd-line)',
        minWidth: 220,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'var(--dd-surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="folder" size={18} style={{ color: 'var(--dd-text-3)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--dd-text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {group.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              color: allHealthy ? 'var(--dd-green)' : noneHealthy ? 'var(--dd-red)' : 'var(--dd-amber)',
              fontWeight: 500,
            }}
          >
            {healthy}/{members.length} healthy
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          className="btn btn-sm"
          style={{
            color: 'var(--dd-green)',
            background: loading === 'start' ? 'rgba(52,211,153,0.15)' : 'var(--dd-surface-2)',
            borderColor: 'var(--dd-line)',
            padding: '4px 7px',
            borderRadius: 6,
          }}
          disabled={loading !== null}
          onClick={() => handleAction('start')}
          title="Start all"
        >
          <Icon name="play_arrow" size={14} />
        </button>
        <button
          className="btn btn-sm"
          style={{
            color: 'var(--dd-red)',
            background: loading === 'stop' ? 'rgba(248,113,113,0.15)' : 'var(--dd-surface-2)',
            borderColor: 'var(--dd-line)',
            padding: '4px 7px',
            borderRadius: 6,
          }}
          disabled={loading !== null}
          onClick={() => handleAction('stop')}
          title="Stop all"
        >
          <Icon name="stop" size={14} />
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onDelete(group)}
          title="Delete group"
          style={{ padding: '4px 5px', color: 'var(--dd-text-4)' }}
        >
          <Icon name="delete" size={13} />
        </button>
      </div>
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

// ── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, borderColor }: { label: string; value: number; borderColor: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 120,
        padding: '14px 18px',
        background: 'var(--dd-surface)',
        borderRadius: 10,
        border: '1px solid var(--dd-line)',
        borderLeft: `3px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--dd-text)', lineHeight: 1.1 }}>
        {value}
      </span>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--dd-text-4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status, detail }: { status?: ServiceStatusType; detail?: string }) {
  return (
    <span
      title={detail || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        background: statusBg(status),
        color: statusColor(status),
        border: `1px solid ${statusBorder(status)}`,
        cursor: detail ? 'help' : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: statusColor(status),
          flexShrink: 0,
        }}
      />
      {statusLabel(status)}
    </span>
  );
}

// ── Main Services Page ────────────────────────────────────────────────────

export default function Services() {
  const { services, loading, refresh: refreshServices } = useServices();
  const {
    groups,
    refresh: refreshGroups,
  } = useServiceGroups();

  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [showAddService, setShowAddService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [logServiceId, setLogServiceId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<Map<string, string>>(new Map());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);
  const [groupsCollapsed, setGroupsCollapsed] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'service' | 'group'; id: string; name: string } | null>(null);

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
  const downCount = services.filter((s) => s.status === 'down').length;
  const degradedCount = services.filter((s) => s.status === 'degraded').length;

  // Use sidebarSearch as main search filter
  const displayedServices = sidebarSearch
    ? filteredServices.filter((s) =>
        s.name.toLowerCase().includes(sidebarSearch.toLowerCase())
      )
    : filteredServices;

  // Filtered IDs set for select-all
  const filteredIds = new Set(displayedServices.map((s) => s.id));
  const selectedInView = new Set([...selectedIds].filter((id) => filteredIds.has(id)));
  const allFilteredSelected = displayedServices.length > 0 && selectedInView.size === displayedServices.length;

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

  function handleDeleteService(service: Service) {
    setDeleteConfirm({ type: 'service', id: service.id, name: service.name });
  }

  async function confirmDeleteService(id: string) {
    try {
      await api.deleteService(id);
      addToast('Service deleted', 'success');
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

  function handleDeleteGroup(group: ServiceGroup) {
    setDeleteConfirm({ type: 'group', id: group.id, name: group.name });
  }

  async function confirmDeleteGroup(id: string) {
    try {
      await api.deleteServiceGroup(id);
      addToast('Group deleted', 'success');
      if (activeGroup === id) setActiveGroup(null);
      await refreshGroups();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      addToast(`Failed to delete group: ${msg}`, 'error');
    }
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

  const showServiceModal = showAddService || editingService !== null;
  const logService = logServiceId ? services.find((s) => s.id === logServiceId) : null;

  return (
    <div className="dd" style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--dd-bg)' }}>
        <main style={{ flex: 1, overflow: 'auto', padding: 0 }}>
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
            <div style={{ padding: '20px 28px 80px' }} ref={tableRef}>

              {/* ── Summary stat cards ── */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <StatCard label="Total" value={services.length} borderColor="var(--dd-blue)" />
                <StatCard label="Healthy" value={healthyCount} borderColor="var(--dd-green)" />
                <StatCard label="Down" value={downCount} borderColor="var(--dd-red)" />
                <StatCard label="Degraded" value={degradedCount} borderColor="var(--dd-amber)" />
              </div>

              {/* ── Toolbar ── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 16,
                  flexWrap: 'wrap',
                }}
              >
                {/* Group filter pills (left) */}
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

                {/* Search (center) */}
                <div style={{ flex: 1, minWidth: 180, maxWidth: 320, position: 'relative' }}>
                  <Icon
                    name="search"
                    size={14}
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--dd-text-4)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    className="input"
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder="Search services..."
                    style={{
                      paddingLeft: 32,
                      fontSize: 12,
                      height: 32,
                      borderRadius: 8,
                      width: '100%',
                    }}
                  />
                  {sidebarSearch && (
                    <button
                      onClick={() => setSidebarSearch('')}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--dd-text-4)',
                        padding: 0,
                        display: 'flex',
                      }}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  )}
                </div>

                {/* Action buttons (right) */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowCreateGroup(true)}
                    style={{ height: 32, fontSize: 12, padding: '0 12px', borderRadius: 8 }}
                  >
                    <Icon name="create_new_folder" size={14} />
                    New Group
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowAddService(true)}
                    style={{ height: 32, fontSize: 12, padding: '0 14px', borderRadius: 8 }}
                  >
                    <Icon name="add" size={14} />
                    Add Service
                  </button>
                </div>
              </div>

              {/* ── Groups strip (collapsible) ── */}
              {groups.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <button
                    onClick={() => setGroupsCollapsed(!groupsCollapsed)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 0',
                      marginBottom: groupsCollapsed ? 0 : 10,
                      color: 'var(--dd-text-3)',
                      fontFamily: 'inherit',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <Icon
                      name="expand_more"
                      size={16}
                      style={{
                        transform: groupsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                        transition: 'transform 150ms ease',
                        color: 'var(--dd-text-4)',
                      }}
                    />
                    Groups
                    <span className="mono" style={{ fontSize: 10, color: 'var(--dd-text-4)', fontWeight: 400 }}>
                      {groups.length}
                    </span>
                  </button>
                  {!groupsCollapsed && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 10,
                        overflowX: 'auto',
                        paddingBottom: 4,
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
                  )}
                </div>
              )}

              {/* ── Service table ── */}
              {displayedServices.length === 0 ? (
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
                    {sidebarSearch ? 'No services match your search' : 'No services in this group'}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 10,
                    border: '1px solid var(--dd-line)',
                    overflow: 'hidden',
                    background: 'var(--dd-surface)',
                  }}
                >
                  <table className="dd-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40, padding: '10px 12px' }}>
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleSelectAll}
                            style={{ accentColor: 'var(--dd-blue)' }}
                          />
                        </th>
                        <th style={{ width: 100 }}>Status</th>
                        <th>Name</th>
                        <th style={{ width: 80 }}>Port</th>
                        <th style={{ width: 100 }}>Uptime</th>
                        <th style={{ width: 140, textAlign: 'right', paddingRight: 16 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedServices.map((svc) => {
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
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--dd-surface-2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '';
                            }}
                          >
                            {/* Checkbox */}
                            <td style={{ padding: '10px 12px' }}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(svc.id)}
                                onChange={() => toggleSelect(svc.id)}
                                style={{ accentColor: 'var(--dd-blue)' }}
                              />
                            </td>

                            {/* Status badge */}
                            <td>
                              <StatusBadge
                                status={svc.status}
                                detail={svc.detail || (isDown ? 'unreachable' : undefined)}
                              />
                            </td>

                            {/* Name */}
                            <td>
                              <span style={{ fontWeight: 600, color: 'var(--dd-text)', fontSize: 13 }}>
                                {svc.name}
                              </span>
                            </td>

                            {/* Port */}
                            <td>
                              <span className="mono" style={{ fontSize: 12, color: 'var(--dd-text-3)' }}>
                                :{svc.port}
                              </span>
                            </td>

                            {/* Uptime */}
                            <td>
                              <span
                                style={{
                                  fontSize: 12,
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
                              <div style={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'flex-end' }}>
                                {/* Primary action: Start or Stop */}
                                {!isHealthy ? (
                                  <button
                                    className="btn btn-sm"
                                    style={{
                                      color: '#fff',
                                      background: actionLoading.has(startKey)
                                        ? 'rgba(52,211,153,0.6)'
                                        : 'var(--dd-green)',
                                      border: 'none',
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      fontWeight: 600,
                                    }}
                                    disabled={anyLoading}
                                    onClick={() => handleServiceAction('start', svc.id)}
                                    title="Start"
                                  >
                                    {actionLoading.has(startKey) ? (
                                      <SmallSpinner color="#fff" />
                                    ) : (
                                      <Icon name="play_arrow" size={14} />
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    className="btn btn-sm"
                                    style={{
                                      color: 'var(--dd-red)',
                                      background: actionLoading.has(stopKey)
                                        ? 'rgba(248,113,113,0.15)'
                                        : 'var(--dd-surface-2)',
                                      borderColor: 'var(--dd-line)',
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                    }}
                                    disabled={anyLoading}
                                    onClick={() => handleServiceAction('stop', svc.id)}
                                    title="Stop"
                                  >
                                    {actionLoading.has(stopKey) ? (
                                      <SmallSpinner color="var(--dd-red)" />
                                    ) : (
                                      <Icon name="stop" size={14} />
                                    )}
                                  </button>
                                )}

                                {/* Restart */}
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{
                                    padding: '4px 6px',
                                    borderRadius: 6,
                                    color: actionLoading.has(restartKey) ? 'var(--dd-amber)' : 'var(--dd-text-4)',
                                    opacity: isDown ? 0.3 : 1,
                                  }}
                                  disabled={anyLoading || isDown}
                                  onClick={() => handleServiceAction('restart', svc.id)}
                                  title="Restart"
                                >
                                  {actionLoading.has(restartKey) ? (
                                    <SmallSpinner color="var(--dd-amber)" />
                                  ) : (
                                    <Icon name="refresh" size={14} />
                                  )}
                                </button>

                                {/* Divider */}
                                <div
                                  style={{
                                    width: 1,
                                    height: 16,
                                    background: 'var(--dd-line)',
                                    margin: '0 2px',
                                  }}
                                />

                                {/* Edit */}
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setEditingService(svc)}
                                  title="Edit"
                                  style={{ padding: '4px 6px', borderRadius: 6, color: 'var(--dd-text-4)' }}
                                >
                                  <Icon name="edit" size={14} />
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
                                    padding: '4px 6px',
                                    borderRadius: 6,
                                    color:
                                      logServiceId === svc.id
                                        ? 'var(--dd-blue)'
                                        : 'var(--dd-text-4)',
                                  }}
                                >
                                  <Icon name="terminal" size={14} />
                                </button>

                                {/* Delete */}
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => handleDeleteService(svc)}
                                  title="Delete"
                                  style={{ padding: '4px 6px', borderRadius: 6, color: 'var(--dd-text-4)' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--dd-red)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--dd-text-4)'; }}
                                >
                                  <Icon name="delete" size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>

      </div>

      {/* Floating bulk action bar */}
      {selectedInView.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 20px',
            borderRadius: 12,
            background: 'var(--dd-surface)',
            border: '1px solid var(--dd-line)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)',
            fontSize: 13,
            animation: 'dd-toast-in 200ms ease',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--dd-blue)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="check_circle" size={15} />
            {selectedInView.size} selected
          </span>

          <div style={{ width: 1, height: 20, background: 'var(--dd-line)' }} />

          <button
            className="btn btn-sm"
            style={{
              color: '#fff',
              background: 'var(--dd-green)',
              border: 'none',
              padding: '5px 14px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 12,
            }}
            disabled={bulkLoading !== null}
            onClick={() => handleBulkAction('start')}
          >
            {bulkLoading === 'start' ? (
              <SmallSpinner color="#fff" />
            ) : (
              <Icon name="play_arrow" size={14} />
            )}
            Start
          </button>
          <button
            className="btn btn-sm"
            style={{
              color: 'var(--dd-red)',
              background: 'var(--dd-surface-2)',
              borderColor: 'var(--dd-line)',
              padding: '5px 14px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 12,
            }}
            disabled={bulkLoading !== null}
            onClick={() => handleBulkAction('stop')}
          >
            {bulkLoading === 'stop' ? (
              <SmallSpinner color="var(--dd-red)" />
            ) : (
              <Icon name="stop" size={14} />
            )}
            Stop
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--dd-line)' }} />

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSelectedIds(new Set())}
            style={{ padding: '5px 10px', fontSize: 12, color: 'var(--dd-text-3)' }}
          >
            <Icon name="close" size={14} />
            Deselect
          </button>
        </div>
      )}

      {/* Slide-up log panel */}
      {logService && (
        <LogPanel
          serviceId={logService.id}
          serviceName={logService.name}
          onClose={() => setLogServiceId(null)}
        />
      )}

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

      {deleteConfirm && (
        <DialogModal
          mode="confirm"
          title={`Delete ${deleteConfirm.type === 'group' ? 'group ' : ''}"${deleteConfirm.name}"?`}
          description={deleteConfirm.type === 'group' ? 'All services in this group will be ungrouped.' : 'This service will be permanently removed.'}
          confirmLabel="Delete"
          danger
          onConfirm={async () => {
            const { type, id } = deleteConfirm;
            setDeleteConfirm(null);
            if (type === 'service') await confirmDeleteService(id);
            else await confirmDeleteGroup(id);
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
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
        padding: '4px 12px',
        borderRadius: 9999,
        border: `1px solid ${active ? 'var(--dd-blue)' : 'var(--dd-line)'}`,
        background: active ? 'rgba(96,165,250,0.10)' : 'var(--dd-surface)',
        color: active ? 'var(--dd-blue)' : 'var(--dd-text-3)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'inherit',
        transition: 'all 120ms ease',
        height: 32,
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
