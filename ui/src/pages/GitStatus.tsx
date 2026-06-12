import { useEffect, useState, useCallback } from 'react';
import Icon from '../components/Icon';
import { getGitStatus, addGitRepo, removeGitRepo, scanGitRepos, gitPull, gitFetch } from '../api';
import type { GitRepoStatus } from '../types';

export default function GitStatus() {
  const [repos, setRepos] = useState<GitRepoStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addPath, setAddPath] = useState('');
  const [addError, setAddError] = useState('');
  const [showScan, setShowScan] = useState(false);
  const [scanDir, setScanDir] = useState('');
  const [scanResults, setScanResults] = useState<string[] | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});

  const fetchStatus = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getGitStatus();
      setRepos(data);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  async function handleAdd() {
    if (!addPath.trim()) return;
    setAddError('');
    try {
      const res = await addGitRepo(addPath.trim());
      if (res.ok) {
        setAddPath('');
        setShowAdd(false);
        fetchStatus(true);
      }
    } catch (e: any) {
      setAddError(e.message || 'Failed to add repo');
    }
  }

  async function handleRemove(path: string) {
    await removeGitRepo(path);
    setRepos((prev) => prev.filter((r) => r.path !== path));
  }

  async function handleScan() {
    if (!scanDir.trim()) return;
    setScanLoading(true);
    try {
      const found = await scanGitRepos(scanDir.trim());
      setScanResults(found);
    } catch {
      setScanResults([]);
    } finally {
      setScanLoading(false);
    }
  }

  async function handleAddScanned(path: string) {
    await addGitRepo(path);
    setScanResults((prev) => prev?.filter((p) => p !== path) ?? null);
    fetchStatus(true);
  }

  async function handlePull(path: string) {
    setActionLoading((prev) => ({ ...prev, [path]: 'pull' }));
    try {
      await gitPull(path);
      fetchStatus(true);
    } catch { /* toast later */ }
    finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[path]; return n; });
    }
  }

  async function handleFetch(path: string) {
    setActionLoading((prev) => ({ ...prev, [path]: 'fetch' }));
    try {
      await gitFetch(path);
      fetchStatus(true);
    } catch { /* toast later */ }
    finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[path]; return n; });
    }
  }

  const cleanCount = repos.filter((r) => r.clean && !r.error).length;
  const dirtyCount = repos.filter((r) => !r.clean && !r.error).length;
  const aheadCount = repos.filter((r) => (r.ahead ?? 0) > 0).length;
  const behindCount = repos.filter((r) => (r.behind ?? 0) > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        padding: '16px 28px',
        display: 'flex', alignItems: 'center', gap: 14,
        borderBottom: '1px solid var(--dd-line)',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: 'var(--dd-text)' }}>
            Git Repos
          </h1>
          <p style={{ fontSize: 12, color: 'var(--dd-text-3)', marginTop: 2 }}>
            {repos.length > 0 ? `${repos.length} tracked repo${repos.length !== 1 ? 's' : ''}` : 'Track your local repositories'}
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => fetchStatus(true)}
          disabled={refreshing}
        >
          <Icon name="refresh" size={15} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setShowScan(true); setScanResults(null); setScanDir(''); }}>
          <Icon name="search" size={15} />
          Scan
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => { setShowAdd(true); setAddPath(''); setAddError(''); }}>
          <Icon name="add" size={15} />
          Add Repo
        </button>
      </div>

      <div style={{ padding: '20px 28px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {/* Summary metrics */}
        {repos.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 20,
            flexShrink: 0,
          }}>
            <MiniMetric icon="check_circle" label="Clean" value={cleanCount} color="var(--dd-green)" />
            <MiniMetric icon="edit" label="Dirty" value={dirtyCount} color="var(--dd-amber)" />
            <MiniMetric icon="arrow_upward" label="Ahead" value={aheadCount} color="var(--dd-blue, #60a5fa)" />
            <MiniMetric icon="arrow_downward" label="Behind" value={behindCount} color="var(--dd-red)" />
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--dd-text-4)' }}>
            <Icon name="hourglass_empty" size={24} style={{ marginRight: 10, opacity: 0.4 }} />
            Loading repositories...
          </div>
        ) : repos.length === 0 ? (
          <EmptyState onAdd={() => { setShowAdd(true); setAddPath(''); setAddError(''); }} onScan={() => { setShowScan(true); setScanResults(null); setScanDir(''); }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', flex: 1, minHeight: 0 }}>
            {repos.map((repo) => (
              <RepoCard
                key={repo.path}
                repo={repo}
                actionLoading={actionLoading[repo.path]}
                onPull={() => handlePull(repo.path)}
                onFetch={() => handleFetch(repo.path)}
                onRemove={() => handleRemove(repo.path)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add repo modal */}
      {showAdd && (
        <Modal title="Add Repository" onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--dd-text-3)' }}>Repository path</label>
            <input
              className="input"
              placeholder="/Users/you/projects/my-repo"
              value={addPath}
              onChange={(e) => setAddPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              autoFocus
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
            />
            {addError && <div style={{ fontSize: 12, color: 'var(--dd-red)' }}>{addError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleAdd}>Add</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Scan modal */}
      {showScan && (
        <Modal title="Scan for Repositories" onClose={() => setShowScan(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--dd-text-3)' }}>Parent directory to scan</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder="~/projects"
                value={scanDir}
                onChange={(e) => setScanDir(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                autoFocus
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13, flex: 1 }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleScan} disabled={scanLoading}>
                {scanLoading ? 'Scanning...' : 'Scan'}
              </button>
            </div>
            {scanResults !== null && (
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                {scanResults.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--dd-text-4)', padding: 12, textAlign: 'center' }}>
                    No git repositories found
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {scanResults.map((p) => (
                      <div key={p} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)',
                      }}>
                        <Icon name="folder" size={16} style={{ color: 'var(--dd-text-4)', flexShrink: 0 }} />
                        <span className="mono" style={{ flex: 1, fontSize: 12, color: 'var(--dd-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleAddScanned(p)} style={{ fontSize: 11 }}>
                          <Icon name="add" size={14} /> Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowScan(false)}>Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Mini Metric ────────────────────────────────────────────────────────────

function MiniMetric({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={18} style={{ color }} />
      </div>
      <div>
        <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--dd-text)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--dd-text-4)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Repo Card ──────────────────────────────────────────────────────────────

function RepoCard({ repo, actionLoading, onPull, onFetch, onRemove }: {
  repo: GitRepoStatus;
  actionLoading?: string;
  onPull: () => void;
  onFetch: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (repo.error) {
    return (
      <div className="card" style={{ padding: '12px 16px', borderLeft: '3px solid var(--dd-red)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="error" size={18} style={{ color: 'var(--dd-red)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dd-text)' }}>{repo.name}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)', marginTop: 1 }}>{repo.path}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--dd-red)', marginRight: 8 }}>{repo.error}</div>
          <button className="btn btn-ghost btn-sm" onClick={onRemove} title="Remove">
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>
    );
  }

  const changes = repo.changes ?? { total: 0, staged: 0, unstaged: 0, untracked: 0 };
  const isClean = repo.clean;
  const ahead = repo.ahead ?? 0;
  const behind = repo.behind ?? 0;

  return (
    <div className="card" style={{
      padding: 0,
      borderLeft: `3px solid ${isClean ? 'var(--dd-green)' : 'var(--dd-amber)'}`,
      overflow: 'hidden',
    }}>
      {/* Main row */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Repo info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--dd-text)' }}>{repo.name}</span>
            <span style={{
              fontSize: 11, fontFamily: 'var(--font-mono)',
              padding: '1px 8px', borderRadius: 10,
              background: 'var(--dd-accent-dim)',
              color: 'var(--dd-accent-bright)',
            }}>
              {repo.branch}
            </span>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {repo.path}
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isClean ? (
            <Badge icon="check_circle" text="Clean" color="var(--dd-green)" />
          ) : (
            <>
              {changes.staged > 0 && <Badge icon="add_circle" text={`${changes.staged} staged`} color="var(--dd-green)" />}
              {changes.unstaged > 0 && <Badge icon="edit" text={`${changes.unstaged} modified`} color="var(--dd-amber)" />}
              {changes.untracked > 0 && <Badge icon="help" text={`${changes.untracked} untracked`} color="var(--dd-text-4)" />}
            </>
          )}
          {ahead > 0 && <Badge icon="arrow_upward" text={`${ahead}`} color="#60a5fa" />}
          {behind > 0 && <Badge icon="arrow_downward" text={`${behind}`} color="var(--dd-red)" />}
          {(repo.stashCount ?? 0) > 0 && <Badge icon="inventory_2" text={`${repo.stashCount}`} color="var(--dd-text-4)" />}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onFetch}
            disabled={!!actionLoading}
            title="Fetch"
            style={{ padding: '3px 6px' }}
          >
            <Icon name="cloud_download" size={15} style={actionLoading === 'fetch' ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onPull}
            disabled={!!actionLoading}
            title="Pull"
            style={{ padding: '3px 6px' }}
          >
            <Icon name="download" size={15} style={actionLoading === 'pull' ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
        </div>

        <Icon name={expanded ? 'expand_less' : 'expand_more'} size={18} style={{ color: 'var(--dd-text-4)', flexShrink: 0 }} />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding: '0 16px 14px',
          borderTop: '1px solid var(--dd-line)',
          display: 'flex', flexDirection: 'column', gap: 10,
          paddingTop: 12,
        }}>
          {/* Last commit */}
          {repo.lastCommit && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <Icon name="commit" size={16} style={{ color: 'var(--dd-text-4)', marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--dd-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {repo.lastCommit.message}
                </div>
                <div style={{ fontSize: 11, color: 'var(--dd-text-4)', marginTop: 2, display: 'flex', gap: 8 }}>
                  <span className="mono">{repo.lastCommit.sha}</span>
                  <span>{repo.lastCommit.author}</span>
                  <span>{repo.lastCommit.relativeTime}</span>
                </div>
              </div>
            </div>
          )}

          {/* Changes breakdown */}
          {!isClean && (
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--dd-text-3)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--dd-green)' }} />
                {changes.staged} staged
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--dd-text-3)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--dd-amber)' }} />
                {changes.unstaged} modified
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--dd-text-3)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--dd-text-4)' }} />
                {changes.untracked} untracked
              </div>
            </div>
          )}

          {/* Remote + stash info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
            {repo.remoteUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--dd-text-4)', overflow: 'hidden' }}>
                <Icon name="link" size={13} />
                <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {repo.remoteUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '')}
                </span>
              </div>
            )}
            {ahead > 0 && <span style={{ color: '#60a5fa' }}>{ahead} commit{ahead !== 1 ? 's' : ''} ahead</span>}
            {behind > 0 && <span style={{ color: 'var(--dd-red)' }}>{behind} commit{behind !== 1 ? 's' : ''} behind</span>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={onRemove} style={{ fontSize: 11, color: 'var(--dd-red)', opacity: 0.7 }}>
              <Icon name="delete" size={13} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────

function Badge({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 8,
      fontSize: 11, fontWeight: 500,
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      color,
    }}>
      <Icon name={icon} size={12} />
      {text}
    </span>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ onAdd, onScan }: { onAdd: () => void; onScan: () => void }) {
  return (
    <div className="card" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flex: 1, gap: 16, color: 'var(--dd-text-4)', padding: 40,
    }}>
      <Icon name="fork_right" size={40} style={{ opacity: 0.2 }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dd-text-3)', marginBottom: 4 }}>
          No repositories tracked
        </div>
        <div style={{ fontSize: 13 }}>
          Add repos manually or scan a directory to find them
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={onAdd}>
          <Icon name="add" size={15} /> Add Repo
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onScan}>
          <Icon name="search" size={15} /> Scan Directory
        </button>
      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div className="card" style={{ width: 480, maxHeight: '80vh', overflow: 'auto', padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--dd-text)', flex: 1 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 2 }}>
            <Icon name="close" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
