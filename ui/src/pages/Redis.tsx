import { useEffect, useState, useRef, useCallback } from 'react';
import { Icon } from '../components';
import { redisInfo, redisKeys, redisGetKey, redisSetKey, redisDeleteKey } from '../api';
import type { RedisInfo, RedisKeyInfo, RedisKeyDetail } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTTL(ttl: number): string {
  if (ttl < 0) return '∞'; // infinity symbol
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) {
    const m = Math.floor(ttl / 60);
    const s = ttl % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(ttl / 3600);
  const m = Math.floor((ttl % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const TYPE_COLORS: Record<string, string> = {
  string: '#60a5fa',
  hash: '#a78bfa',
  list: '#34d399',
  set: '#fbbf24',
  zset: '#22d3ee',
};

function isFeatureFlag(key: string, value?: any): boolean {
  const flagPatterns = /^(feature:|flag:|ff:)/i;
  if (flagPatterns.test(key)) return true;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return ['true', 'false', '1', '0', 'enabled', 'disabled'].includes(lower);
  }
  return false;
}

function isBooleanish(value: any): boolean {
  if (typeof value !== 'string') return false;
  const lower = value.toLowerCase();
  return ['true', 'false', '1', '0', 'enabled', 'disabled'].includes(lower);
}

function booleanishValue(value: string): boolean {
  const lower = value.toLowerCase();
  return lower === 'true' || lower === '1' || lower === 'enabled';
}

function toggleBooleanish(value: string): string {
  const lower = value.toLowerCase();
  if (lower === 'true') return 'false';
  if (lower === 'false') return 'true';
  if (lower === '1') return '0';
  if (lower === '0') return '1';
  if (lower === 'enabled') return 'disabled';
  if (lower === 'disabled') return 'enabled';
  return value;
}

function previewValue(detail: RedisKeyDetail): string {
  if (detail.type === 'string') {
    const v = detail.value as string;
    return v.length > 80 ? v.slice(0, 80) + '...' : v;
  }
  if (detail.type === 'hash') {
    const entries = Object.entries(detail.value as Record<string, string>);
    const preview = entries.slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ');
    return entries.length > 3 ? preview + ` (+${entries.length - 3} more)` : preview;
  }
  if (detail.type === 'list' || detail.type === 'set') {
    const arr = detail.value as string[];
    const preview = arr.slice(0, 3).join(', ');
    return arr.length > 3 ? preview + ` (+${arr.length - 3} more)` : preview;
  }
  if (detail.type === 'zset') {
    const pairs = detail.value as { member: string; score: string }[];
    const preview = pairs.slice(0, 3).map((p) => `${p.member}(${p.score})`).join(', ');
    return pairs.length > 3 ? preview + ` (+${pairs.length - 3} more)` : preview;
  }
  return String(detail.value);
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function Redis() {
  const [info, setInfo] = useState<RedisInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [keys, setKeys] = useState<RedisKeyInfo[]>([]);
  const [keyDetails, setKeyDetails] = useState<Record<string, RedisKeyDetail>>({});
  const [pattern, setPattern] = useState('*');
  const [cursor, setCursor] = useState('0');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Load info ────────────────────────────────────────────────────────────

  const loadInfo = useCallback(async () => {
    try {
      const data = await redisInfo();
      setInfo(data);
      setInfoError(null);
    } catch (err) {
      setInfoError((err as Error).message);
    }
  }, []);

  // ── Load keys ────────────────────────────────────────────────────────────

  const loadKeys = useCallback(async (searchPattern: string, fromCursor: string, append: boolean) => {
    setLoading(true);
    try {
      const data = await redisKeys(searchPattern, fromCursor, 50);
      setKeys((prev) => append ? [...prev, ...data.keys] : data.keys);
      setCursor(data.nextCursor);
      setHasMore(data.nextCursor !== '0');

      // Pre-fetch details for string keys (for toggle/preview)
      const newKeys = data.keys.filter((k) => k.type === 'string');
      for (const k of newKeys) {
        redisGetKey(k.key).then((detail) => {
          setKeyDetails((prev) => ({ ...prev, [k.key]: detail }));
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load Redis keys:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial load ────────────────────────────────────────────────────────

  useEffect(() => {
    loadInfo();
    loadKeys('*', '0', false);
  }, [loadInfo, loadKeys]);

  // ── Debounced search ─────────────────────────────────────────────────────

  const handlePatternChange = (value: string) => {
    setPattern(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSelectedKey(null);
      loadKeys(value || '*', '0', false);
    }, 300);
  };

  // ── Refresh ──────────────────────────────────────────────────────────────

  const handleRefresh = () => {
    setSelectedKey(null);
    setKeyDetails({});
    loadInfo();
    loadKeys(pattern || '*', '0', false);
  };

  // ── Load more ────────────────────────────────────────────────────────────

  const handleLoadMore = () => {
    loadKeys(pattern || '*', cursor, true);
  };

  // ── Select key ───────────────────────────────────────────────────────────

  const handleSelectKey = async (key: string) => {
    if (selectedKey === key) {
      setSelectedKey(null);
      return;
    }
    setSelectedKey(key);
    try {
      const detail = await redisGetKey(key);
      setKeyDetails((prev) => ({ ...prev, [key]: detail }));
    } catch (err) {
      console.error('Failed to load key:', err);
    }
  };

  // ── Toggle boolean ──────────────────────────────────────────────────────

  const handleToggle = async (key: string) => {
    const detail = keyDetails[key];
    if (!detail || detail.type !== 'string') return;
    const newValue = toggleBooleanish(detail.value as string);
    try {
      await redisSetKey(key, newValue);
      const updated = await redisGetKey(key);
      setKeyDetails((prev) => ({ ...prev, [key]: updated }));
    } catch (err) {
      console.error('Failed to toggle:', err);
    }
  };

  // ── Edit key ─────────────────────────────────────────────────────────────

  const handleStartEdit = (key: string) => {
    const detail = keyDetails[key];
    if (!detail) return;
    setEditingKey(key);
    setEditValue(typeof detail.value === 'string' ? detail.value : JSON.stringify(detail.value, null, 2));
  };

  const handleSaveEdit = async () => {
    if (!editingKey) return;
    try {
      await redisSetKey(editingKey, editValue);
      const updated = await redisGetKey(editingKey);
      setKeyDetails((prev) => ({ ...prev, [editingKey]: updated }));
      setEditingKey(null);
    } catch (err) {
      console.error('Failed to save:', err);
    }
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  // ── Delete key ───────────────────────────────────────────────────────────

  const handleDelete = async (key: string) => {
    try {
      await redisDeleteKey(key);
      setKeys((prev) => prev.filter((k) => k.key !== key));
      setKeyDetails((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (selectedKey === key) setSelectedKey(null);
      setDeleteConfirm(null);
      loadInfo(); // refresh key count
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  // ── Get selected detail ──────────────────────────────────────────────────

  const selectedDetail = selectedKey ? keyDetails[selectedKey] : null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--dd-bg)',
      color: 'var(--dd-text)',
    }}>
      <main style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 24px',
        gap: '16px',
      }}>
        {/* ── Server Info Bar ──────────────────────────────────────────── */}
        {infoError ? (
          <div style={{
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid var(--dd-red-dim)',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <Icon name="error" size={18} style={{ color: 'var(--dd-red)' }} />
            <span style={{ color: 'var(--dd-red)', fontSize: 13 }}>
              Redis connection failed: {infoError}
            </span>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            <InfoChip icon="info" label="Version" value={info?.version ?? '...'} />
            <InfoChip icon="memory" label="Memory" value={info?.used_memory_human ?? '...'} />
            <InfoChip icon="key" label="Keys" value={info?.total_keys?.toLocaleString() ?? '...'} />
            <InfoChip icon="people" label="Clients" value={info?.connected_clients?.toString() ?? '...'} />
            <InfoChip icon="schedule" label="Uptime" value={info ? formatTTL(info.uptime_seconds) : '...'} />
          </div>
        )}

        {/* ── Search Bar ───────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            background: 'var(--dd-surface-2)',
            border: '1px solid var(--dd-line)',
            borderRadius: 6,
            padding: '0 12px',
            gap: 8,
          }}>
            <Icon name="search" size={16} style={{ color: 'var(--dd-text-3)', flexShrink: 0 }} />
            <input
              type="text"
              value={pattern}
              onChange={(e) => handlePatternChange(e.target.value)}
              placeholder="Search pattern (e.g. feature:* or *user*)"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--dd-text)',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                padding: '8px 0',
              }}
            />
            {pattern !== '*' && pattern !== '' && (
              <button
                onClick={() => { setPattern('*'); loadKeys('*', '0', false); }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                }}
              >
                <Icon name="close" size={14} style={{ color: 'var(--dd-text-4)' }} />
              </button>
            )}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Icon name="refresh" size={15} />
            Refresh
          </button>
        </div>

        {/* ── Keys Table ───────────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          border: '1px solid var(--dd-line)',
          borderRadius: 8,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 80px 2fr 120px',
            background: 'var(--dd-surface)',
            borderBottom: '1px solid var(--dd-line)',
            padding: '8px 16px',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: 'var(--dd-text-3)',
          }}>
            <span>Key</span>
            <span>Type</span>
            <span>TTL</span>
            <span>Value</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {/* Table body */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {keys.length === 0 && !loading && (
              <div style={{
                padding: '48px 16px',
                textAlign: 'center',
                color: 'var(--dd-text-4)',
                fontSize: 13,
              }}>
                <Icon name="inbox" size={32} style={{ display: 'block', margin: '0 auto 8px', color: 'var(--dd-text-4)' }} />
                {pattern !== '*' ? `No keys matching "${pattern}"` : 'No keys found'}
              </div>
            )}

            {keys.map((k) => {
              const detail = keyDetails[k.key];
              const isSelected = selectedKey === k.key;
              const isFlag = detail ? isFeatureFlag(k.key, detail.value) : isFeatureFlag(k.key);
              const showToggle = detail && detail.type === 'string' && isBooleanish(detail.value);

              return (
                <div key={k.key}>
                  {/* Row */}
                  <div
                    onClick={() => handleSelectKey(k.key)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 80px 80px 2fr 120px',
                      padding: '10px 16px',
                      fontSize: 13,
                      borderBottom: '1px solid var(--dd-line)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--dd-surface-2)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--dd-surface)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                    }}
                  >
                    {/* Key name */}
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: isFlag ? '#ef4444' : 'var(--dd-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      {isFlag && <Icon name="flag" size={13} style={{ color: '#ef4444', flexShrink: 0 }} />}
                      {k.key}
                    </span>

                    {/* Type badge */}
                    <span>
                      <TypeBadge type={k.type} />
                    </span>

                    {/* TTL */}
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: k.ttl > 0 ? 'var(--dd-amber)' : 'var(--dd-text-4)',
                    }}>
                      {formatTTL(k.ttl)}
                    </span>

                    {/* Value preview */}
                    <span style={{
                      fontSize: 12,
                      color: 'var(--dd-text-3)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-mono)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      {showToggle && (
                        <ToggleSwitch
                          checked={booleanishValue(detail.value as string)}
                          onChange={(e) => { e.stopPropagation(); handleToggle(k.key); }}
                        />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {detail ? previewValue(detail) : '...'}
                      </span>
                    </span>

                    {/* Actions */}
                    <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                      {detail && detail.type === 'string' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => { e.stopPropagation(); handleStartEdit(k.key); }}
                          title="Edit"
                          style={{ padding: '3px 6px' }}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                      )}
                      {deleteConfirm === k.key ? (
                        <>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={(e) => { e.stopPropagation(); handleDelete(k.key); }}
                            style={{ padding: '3px 6px', fontSize: 11 }}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                            style={{ padding: '3px 6px', fontSize: 11 }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(k.key); }}
                          title="Delete"
                          style={{ padding: '3px 6px' }}
                        >
                          <Icon name="delete" size={14} style={{ color: 'var(--dd-red)' }} />
                        </button>
                      )}
                    </span>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isSelected && selectedDetail && (
                    <DetailPanel
                      detail={selectedDetail}
                      editingKey={editingKey}
                      editValue={editValue}
                      onEditValueChange={setEditValue}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={handleCancelEdit}
                    />
                  )}
                </div>
              );
            })}

            {loading && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--dd-text-4)', fontSize: 13 }}>
                Loading...
              </div>
            )}
          </div>

          {/* Load more footer */}
          {hasMore && !loading && (
            <div style={{
              borderTop: '1px solid var(--dd-line)',
              padding: '8px 16px',
              display: 'flex',
              justifyContent: 'center',
            }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleLoadMore}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Icon name="expand_more" size={15} />
                Load more keys
              </button>
            </div>
          )}
        </div>

        {/* Key count footer */}
        <div style={{
          fontSize: 11,
          color: 'var(--dd-text-4)',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>{keys.length} key{keys.length !== 1 ? 's' : ''} shown</span>
          {info && <span>{info.total_keys.toLocaleString()} total keys in database</span>}
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function InfoChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'var(--dd-surface)',
      border: '1px solid var(--dd-line)',
      borderRadius: 6,
      padding: '8px 12px',
      minWidth: 120,
    }}>
      <Icon name={icon} size={16} style={{ color: 'var(--dd-text-3)' }} />
      <div>
        <div style={{ fontSize: 10, color: 'var(--dd-text-4)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dd-text)', fontFamily: 'var(--font-mono)' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] || 'var(--dd-text-3)';
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color,
      background: color + '18',
      border: `1px solid ${color}30`,
      borderRadius: 4,
      padding: '2px 6px',
    }}>
      {type}
    </span>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 32,
        height: 18,
        borderRadius: 9,
        border: 'none',
        cursor: 'pointer',
        background: checked ? 'var(--dd-green)' : 'var(--dd-surface-3)',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 0.15s',
        padding: 0,
      }}
    >
      <div style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: '#fff',
        position: 'absolute',
        top: 2,
        left: checked ? 16 : 2,
        transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

function DetailPanel({
  detail,
  editingKey,
  editValue,
  onEditValueChange,
  onSaveEdit,
  onCancelEdit,
}: {
  detail: RedisKeyDetail;
  editingKey: string | null;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const isEditing = editingKey === detail.key;

  const renderValue = () => {
    if (isEditing) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            style={{
              width: '100%',
              minHeight: 80,
              background: 'var(--dd-bg)',
              border: '1px solid var(--dd-line-2)',
              borderRadius: 4,
              color: 'var(--dd-text)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              padding: '8px 10px',
              resize: 'vertical',
              outline: 'none',
            }}
            onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'var(--dd-blue)'; }}
            onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'var(--dd-line-2)'; }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={onSaveEdit}>
              Save
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onCancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    switch (detail.type) {
      case 'string':
        return (
          <pre style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--dd-text-2)',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {detail.value as string}
          </pre>
        );

      case 'hash': {
        const entries = Object.entries(detail.value as Record<string, string>);
        return (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={thStyle}>Field</th>
                <th style={thStyle}>Value</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([field, val]) => (
                <tr key={field}>
                  <td style={tdStyle}>{field}</td>
                  <td style={{ ...tdStyle, color: 'var(--dd-text-2)' }}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }

      case 'list':
      case 'set': {
        const items = detail.value as string[];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {items.map((item, i) => (
              <div key={i} style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--dd-text-2)',
                padding: '4px 8px',
                background: i % 2 === 0 ? 'var(--dd-bg)' : 'transparent',
                borderRadius: 3,
                display: 'flex',
                gap: 8,
              }}>
                <span style={{ color: 'var(--dd-text-4)', minWidth: 24, textAlign: 'right' }}>{i}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        );
      }

      case 'zset': {
        const pairs = detail.value as { member: string; score: string }[];
        return (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={thStyle}>Member</th>
                <th style={thStyle}>Score</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p) => (
                <tr key={p.member}>
                  <td style={tdStyle}>{p.member}</td>
                  <td style={{ ...tdStyle, color: 'var(--dd-cyan)' }}>{p.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }

      default:
        return <span style={{ color: 'var(--dd-text-4)', fontSize: 12 }}>Unsupported type</span>;
    }
  };

  return (
    <div style={{
      background: 'var(--dd-surface)',
      borderBottom: '1px solid var(--dd-line)',
      padding: '16px 24px',
    }}>
      {/* Meta row */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 12,
        fontSize: 11,
        color: 'var(--dd-text-3)',
      }}>
        <span>Type: <TypeBadge type={detail.type} /></span>
        <span>TTL: <span style={{ color: 'var(--dd-text-2)', fontFamily: 'var(--font-mono)' }}>{formatTTL(detail.ttl)}</span></span>
        <span>Size: <span style={{ color: 'var(--dd-text-2)', fontFamily: 'var(--font-mono)' }}>{detail.size}</span></span>
      </div>

      {/* Value */}
      <div style={{
        background: 'var(--dd-surface-2)',
        border: '1px solid var(--dd-line)',
        borderRadius: 6,
        padding: '12px 16px',
        maxHeight: 300,
        overflow: 'auto',
      }}>
        {renderValue()}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: '1px solid var(--dd-line)',
  color: 'var(--dd-text-3)',
  fontWeight: 600,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderBottom: '1px solid var(--dd-line)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--dd-text)',
  fontSize: 12,
};
