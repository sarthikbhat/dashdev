import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Icon from '../components/Icon';
import { DialogModal } from '../components/DialogModal';
import { Toasts, useToasts } from '../components/Toast';
import {
  getGitHubSettings,
  setGitHubToken,
  deleteGitHubToken,
  listGitHubRepos,
  setTrackedRepos,
  getGitHubStatus,
} from '../api';
import type {
  GitHubSettings,
  GitHubRepo,
  GitHubPR,
  GitHubCIRunWithRepo,
  GitHubStatusResponse,
  PRReview,
} from '../types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ciColor(conclusion: string | null, status: string): string {
  if (status === 'in_progress' || status === 'queued') return 'var(--dd-amber)';
  if (conclusion === 'success') return 'var(--dd-green)';
  if (conclusion === 'failure') return 'var(--dd-red)';
  return 'var(--dd-text-3)';
}

function ciIcon(conclusion: string | null, status: string): string {
  if (status === 'in_progress') return 'pending';
  if (status === 'queued') return 'schedule';
  if (conclusion === 'success') return 'check_circle';
  if (conclusion === 'failure') return 'cancel';
  if (conclusion === 'cancelled') return 'block';
  return 'help';
}

function ciBg(conclusion: string | null, status: string): string {
  if (status === 'in_progress' || status === 'queued') return 'var(--dd-amber-dim)';
  if (conclusion === 'success') return 'var(--dd-green-dim)';
  if (conclusion === 'failure') return 'var(--dd-red-dim)';
  return 'rgba(255,255,255,0.04)';
}

function latestReviewPerUser(reviews: PRReview[]): PRReview[] {
  const map = new Map<string, PRReview>();
  for (const r of reviews) {
    if (r.state === 'COMMENTED' || r.state === 'PENDING') continue;
    const existing = map.get(r.user);
    if (!existing || new Date(r.submitted_at) > new Date(existing.submitted_at)) {
      map.set(r.user, r);
    }
  }
  return Array.from(map.values());
}

function reviewSummary(pr: GitHubPR): { label: string; color: string; icon: string } {
  const latest = latestReviewPerUser(pr.reviews ?? []);
  const approved = latest.filter((r) => r.state === 'APPROVED').length;
  const changesReq = latest.filter((r) => r.state === 'CHANGES_REQUESTED').length;
  const pendingReviewers = pr.requested_reviewers.length;

  if (changesReq > 0) return { label: 'Changes requested', color: 'var(--dd-red)', icon: 'edit' };
  if (approved > 0 && pendingReviewers === 0) return { label: `${approved} approved`, color: 'var(--dd-green)', icon: 'check_circle' };
  if (approved > 0 && pendingReviewers > 0) return { label: `${approved} approved · ${pendingReviewers} pending`, color: 'var(--dd-amber)', icon: 'pending' };
  if (pendingReviewers > 0) return { label: `${pendingReviewers} reviewer(s) pending`, color: 'var(--dd-amber)', icon: 'rate_review' };
  return { label: 'No reviews', color: 'var(--dd-text-3)', icon: 'visibility_off' };
}

// ── Setup Screen ────────────────────────────────────────────────────────────

function TokenSetup({ onSaved }: { onSaved: () => void }) {
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const { toasts, addToast, dismissToast } = useToasts();

  const handleSave = async () => {
    if (!token.trim()) return;
    setSaving(true);
    try {
      await setGitHubToken(token.trim());
      addToast('GitHub token saved securely', 'success');
      onSaved();
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center' }}>
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'var(--dd-accent-dim)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
      }}>
        <Icon name="rocket_launch" size={32} style={{ color: 'var(--dd-accent)' }} />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Connect GitHub</h2>
      <p style={{ color: 'var(--dd-text-2)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        Enter a GitHub Personal Access Token to view CI/CD status,
        pull requests, and workflow runs for your repos.
      </p>
      <input
        className="input"
        type="password"
        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        style={{ marginBottom: 12, fontFamily: 'var(--font-mono)', fontSize: 13 }}
      />
      <p style={{
        color: 'var(--dd-text-3)', fontSize: 11, marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <Icon name="lock" size={13} />
        Stored encrypted (AES-256-CBC) in your local DevDash database only
      </p>
      <button className="btn btn-primary" onClick={handleSave} disabled={saving || !token.trim()}>
        <Icon name="key" size={15} />
        {saving ? 'Saving...' : 'Save Token'}
      </button>
      <div style={{ marginTop: 32, textAlign: 'left', padding: '20px 24px', background: 'var(--dd-surface)', borderRadius: 'var(--dd-radius-sm)', border: '1px solid var(--dd-line)' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--dd-text-2)', marginBottom: 8 }}>Required scopes:</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['repo', 'read:org', 'workflow'].map((s) => (
            <span key={s} className="tag" style={{ fontSize: 11 }}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Repo Picker ─────────────────────────────────────────────────────────────

function RepoPicker({ onDone, currentRepos }: { onDone: () => void; currentRepos: string[] }) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(currentRepos));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const { toasts, addToast, dismissToast } = useToasts();

  useEffect(() => {
    listGitHubRepos().then(setRepos).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setTrackedRepos(Array.from(selected));
      addToast(`Tracking ${selected.size} repo(s)`, 'success');
      setTimeout(onDone, 600);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const filtered = repos.filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Select Repos to Track</h2>
          <p style={{ color: 'var(--dd-text-3)', fontSize: 13, marginTop: 4 }}>
            Choose which repositories to monitor for CI/CD status and PRs.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || selected.size === 0}>
          <Icon name="check" size={15} />
          {saving ? 'Saving...' : `Track ${selected.size} repo(s)`}
        </button>
      </div>
      <input
        className="input"
        placeholder="Search repos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16 }}
      />
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--dd-text-3)' }}>Loading repos from GitHub...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 480, overflowY: 'auto' }}>
          {filtered.map((r) => (
            <label
              key={r.full_name}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderRadius: 'var(--dd-radius-sm)', cursor: 'pointer',
                background: selected.has(r.full_name) ? 'var(--dd-accent-dim)' : 'var(--dd-surface)',
                border: `1px solid ${selected.has(r.full_name) ? 'rgba(139,92,246,0.25)' : 'var(--dd-line)'}`,
                transition: 'all 150ms ease',
              }}
            >
              <input type="checkbox" checked={selected.has(r.full_name)} onChange={() => toggle(r.full_name)} style={{ accentColor: 'var(--dd-accent)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{r.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--dd-text-3)', marginTop: 2 }}>
                  {r.private ? 'Private' : 'Public'} · {r.default_branch} · {timeAgo(r.updated_at)}
                </div>
              </div>
              {r.private && <Icon name="lock" size={14} style={{ color: 'var(--dd-text-4)' }} />}
            </label>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--dd-text-3)' }}>
              {search ? 'No matching repos' : 'No repos found'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── My PR Card ──────────────────────────────────────────────────────────────

function MyPRCard({ pr }: { pr: GitHubPR }) {
  const review = reviewSummary(pr);
  const checks = pr.checks;
  const repoShort = pr.repo.split('/')[1];

  return (
    <a
      href={pr.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="card"
      style={{
        display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px',
        textDecoration: 'none', color: 'inherit',
        transition: 'border-color 150ms ease',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Icon name={pr.draft ? 'edit_note' : 'merge'} size={18} style={{ color: pr.draft ? 'var(--dd-text-3)' : 'var(--dd-green)', marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pr.title}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--dd-text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{repoShort}</span>
            <span>#{pr.number}</span>
            <span>·</span>
            <span>{pr.head_branch} → {pr.base_branch}</span>
            <span>·</span>
            <span>{timeAgo(pr.updated_at)}</span>
          </div>
        </div>
      </div>

      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 28 }}>
        {/* Review status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500,
          padding: '3px 10px', borderRadius: 'var(--dd-radius-full)',
          background: `${review.color}15`, color: review.color,
        }}>
          <Icon name={review.icon} size={13} />
          {review.label}
        </div>

        {/* CI checks */}
        {checks && checks.total > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500,
            padding: '3px 10px', borderRadius: 'var(--dd-radius-full)',
            background: checks.failure > 0 ? 'var(--dd-red-dim)' : checks.pending > 0 ? 'var(--dd-amber-dim)' : 'var(--dd-green-dim)',
            color: checks.failure > 0 ? 'var(--dd-red)' : checks.pending > 0 ? 'var(--dd-amber)' : 'var(--dd-green)',
          }}>
            <Icon name={checks.failure > 0 ? 'cancel' : checks.pending > 0 ? 'pending' : 'check_circle'} size={13} />
            {checks.failure > 0
              ? `${checks.failure}/${checks.total} failed`
              : checks.pending > 0
                ? `${checks.pending} running`
                : `${checks.success}/${checks.total} passed`}
          </div>
        )}

        {/* Labels */}
        {pr.labels.map((l) => (
          <span key={l.name} style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 'var(--dd-radius-full)',
            background: `#${l.color}22`, color: `#${l.color}`, fontWeight: 600,
          }}>
            {l.name}
          </span>
        ))}

        {/* Diff */}
        <span style={{ fontSize: 10, color: 'var(--dd-green)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
          +{pr.additions ?? 0}
        </span>
        <span style={{ fontSize: 10, color: 'var(--dd-red)', fontFamily: 'var(--font-mono)' }}>
          -{pr.deletions ?? 0}
        </span>
      </div>

      {/* Individual reviewers */}
      {(pr.reviews?.length > 0 || pr.requested_reviewers.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 28, flexWrap: 'wrap' }}>
          {latestReviewPerUser(pr.reviews ?? []).map((r) => (
            <span key={r.user} style={{
              fontSize: 10, display: 'flex', alignItems: 'center', gap: 4,
              color: r.state === 'APPROVED' ? 'var(--dd-green)' : r.state === 'CHANGES_REQUESTED' ? 'var(--dd-red)' : 'var(--dd-text-3)',
            }}>
              <Icon name={r.state === 'APPROVED' ? 'check_circle' : r.state === 'CHANGES_REQUESTED' ? 'edit' : 'chat'} size={11} />
              {r.user}
            </span>
          ))}
          {pr.requested_reviewers.map((u) => (
            <span key={u} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--dd-text-4)' }}>
              <Icon name="schedule" size={11} />
              {u}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}

// ── Review Request Card ─────────────────────────────────────────────────────

function ReviewRequestCard({ pr }: { pr: GitHubPR }) {
  const repoShort = pr.repo.split('/')[1];
  return (
    <a
      href={pr.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="card"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        textDecoration: 'none', color: 'inherit',
        transition: 'border-color 150ms ease',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 'var(--dd-radius-xs)',
        background: 'var(--dd-amber-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name="rate_review" size={17} style={{ color: 'var(--dd-amber)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pr.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--dd-text-3)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span>{pr.user}</span>
          <span>·</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{repoShort}</span>
          <span>#{pr.number}</span>
          <span>·</span>
          <span>{pr.head_branch}</span>
          <span>·</span>
          <span>{timeAgo(pr.created_at)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {pr.labels.map((l) => (
          <span key={l.name} style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 'var(--dd-radius-full)',
            background: `#${l.color}22`, color: `#${l.color}`, fontWeight: 600,
          }}>
            {l.name}
          </span>
        ))}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--dd-green)', fontFamily: 'var(--font-mono)' }}>+{pr.additions ?? 0}</span>{' '}
        <span style={{ fontSize: 10, color: 'var(--dd-red)', fontFamily: 'var(--font-mono)' }}>-{pr.deletions ?? 0}</span>
      </div>
    </a>
  );
}

// ── CI Run Row (with repo label) ───────────────────────────────────────────

function CIRunWithRepoRow({ run }: { run: GitHubCIRunWithRepo }) {
  const color = ciColor(run.conclusion, run.status);
  const icon = ciIcon(run.conclusion, run.status);
  const bg = ciBg(run.conclusion, run.status);
  const repoShort = run.repo.split('/')[1];
  return (
    <a
      href={run.html_url} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
        borderRadius: 'var(--dd-radius-xs)', textDecoration: 'none', color: 'inherit',
        transition: 'background 150ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ width: 28, height: 28, borderRadius: 'var(--dd-radius-xs)', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={16} style={{ color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.name}</div>
        <div style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{repoShort}</span> · #{run.run_number} · {run.branch} · {run.event}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--dd-text-3)', textAlign: 'right', flexShrink: 0 }}>
        {timeAgo(run.created_at)}
      </div>
    </a>
  );
}

// ── Main CI/CD Page ─────────────────────────────────────────────────────────

export default function CICD() {
  const [settings, setSettings] = useState<GitHubSettings | null>(null);
  const [statusData, setStatusData] = useState<GitHubStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [view, setView] = useState<'dashboard' | 'repos'>('dashboard');
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'my-prs' | 'review' | 'actions'>('my-prs');
  const [tabSearch, setTabSearch] = useState('');
  const [repoFilter, setRepoFilter] = useState<string>('all');
  const { toasts, addToast, dismissToast } = useToasts();

  const loadSettings = useCallback(async () => {
    try {
      const s = await getGitHubSettings();
      setSettings(s);
      return s;
    } catch {
      setSettings({ hasToken: false, tokenPreview: null, repos: [] });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await getGitHubStatus();
      setStatusData(data);
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings().then((s) => {
      if (s?.hasToken && s.repos.length > 0) loadStatus();
    });
  }, []);

  const refreshRef = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => {
    if (view === 'dashboard' && settings?.hasToken && (settings?.repos?.length ?? 0) > 0) {
      refreshRef.current = setInterval(() => {
        getGitHubStatus().then(setStatusData).catch(() => {});
      }, 60000);
    }
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [view, settings]);

  const handleTokenSaved = async () => {
    const s = await loadSettings();
    if (s?.repos?.length === 0) setView('repos');
    setShowTokenDialog(false);
  };

  const handleRemoveToken = async () => {
    try {
      await deleteGitHubToken();
      addToast('GitHub token removed', 'info');
      setSettings({ hasToken: false, tokenPreview: null, repos: [] });
      setStatusData(null);
      setShowRemoveConfirm(false);
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const handleReposDone = async () => {
    setView('dashboard');
    await loadSettings();
    await loadStatus();
  };

  // Derived data (must be before early returns for hooks rules)
  const myPRs = statusData?.myPRs ?? [];
  const reviewRequests = statusData?.reviewRequests ?? [];
  const repos = statusData?.repos ?? [];
  const myCIRuns = statusData?.myCIRuns ?? [];
  const recentCIRuns = statusData?.recentCIRuns ?? [];
  const currentUser = statusData?.currentUser ?? '';
  const totalRuns = repos.reduce((n, r) => n + (r.ciSummary?.total ?? 0), 0);
  const failedRuns = repos.reduce((n, r) => n + (r.ciSummary?.failure ?? 0), 0);

  const allRepoNames = useMemo(() => {
    const s = new Set<string>();
    myPRs.forEach((pr) => s.add(pr.repo));
    reviewRequests.forEach((pr) => s.add(pr.repo));
    myCIRuns.forEach((r) => s.add(r.repo));
    recentCIRuns.forEach((r) => s.add(r.repo));
    return Array.from(s).sort();
  }, [myPRs, reviewRequests, myCIRuns, recentCIRuns]);

  const q = tabSearch.toLowerCase();

  const filteredMyPRs = useMemo(() => myPRs.filter((pr) =>
    (repoFilter === 'all' || pr.repo === repoFilter) && (pr.title.toLowerCase().includes(q) || pr.repo.toLowerCase().includes(q) || pr.head_branch.toLowerCase().includes(q) || `#${pr.number}`.includes(q))
  ), [myPRs, q, repoFilter]);

  const filteredReviews = useMemo(() => reviewRequests.filter((pr) =>
    (repoFilter === 'all' || pr.repo === repoFilter) && (pr.title.toLowerCase().includes(q) || pr.user.toLowerCase().includes(q) || pr.repo.toLowerCase().includes(q) || pr.head_branch.toLowerCase().includes(q) || `#${pr.number}`.includes(q))
  ), [reviewRequests, q, repoFilter]);

  const filteredMyCIRuns = useMemo(() => myCIRuns.filter((r) =>
    (repoFilter === 'all' || r.repo === repoFilter) && (r.name.toLowerCase().includes(q) || r.repo.toLowerCase().includes(q) || r.branch.toLowerCase().includes(q))
  ), [myCIRuns, q, repoFilter]);

  const filteredTeamCI = useMemo(() => recentCIRuns.filter((r) =>
    (repoFilter === 'all' || r.repo === repoFilter) && (r.name.toLowerCase().includes(q) || r.repo.toLowerCase().includes(q) || r.branch.toLowerCase().includes(q) || (r.actor ?? '').toLowerCase().includes(q))
  ), [recentCIRuns, q, repoFilter]);

  type Tab = 'my-prs' | 'review' | 'actions';
  const tabs: { key: Tab; label: string; icon: string; count: number }[] = [
    { key: 'my-prs', label: 'My PRs', icon: 'merge', count: myPRs.length },
    { key: 'review', label: 'Needs Review', icon: 'rate_review', count: reviewRequests.length },
    { key: 'actions', label: 'Actions', icon: 'play_circle', count: totalRuns },
  ];

  // Early returns (after all hooks)
  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--dd-text-3)' }}>Loading...</div>;
  }

  if (!settings?.hasToken) {
    return <TokenSetup onSaved={handleTokenSaved} />;
  }

  if (view === 'repos' || settings.repos.length === 0) {
    return <RepoPicker onDone={handleReposDone} currentRepos={settings.repos} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toasts toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>CI/CD</h1>
            <p style={{ color: 'var(--dd-text-3)', fontSize: 12, marginTop: 2 }}>
              {currentUser && <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--dd-accent-bright)' }}>@{currentUser}</span>}
              {currentUser && ' · '}
              {settings.repos.length} repo(s) tracked
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setView('repos')}>
              <Icon name="tune" size={14} /> Repos
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowTokenDialog(true)}>
              <Icon name="key" size={14} /> Token
            </button>
            <button className="btn btn-secondary btn-sm" onClick={loadStatus} disabled={statusLoading}>
              <Icon name="refresh" size={14} /> {statusLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stat tiles */}
        {statusLoading && !statusData ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--dd-text-3)', fontSize: 13 }}>Fetching status from GitHub...</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'My Open PRs', value: myPRs.length, icon: 'merge', color: 'var(--dd-blue)' },
              { label: 'Needs My Review', value: reviewRequests.length, icon: 'rate_review', color: 'var(--dd-amber)' },
              { label: 'CI Runs', value: totalRuns, icon: 'play_circle', color: 'var(--dd-green)' },
              { label: 'Failed', value: failedRuns, icon: 'cancel', color: 'var(--dd-red)' },
            ].map((s) => (
              <div key={s.label} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Icon name={s.icon} size={14} style={{ color: s.color }} />
                  <span style={{ fontSize: 10, color: 'var(--dd-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab bar + search/filter */}
        {statusData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid var(--dd-line)' }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setTabSearch(''); setRepoFilter('all'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 18px', fontSize: 13, fontWeight: 500,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: activeTab === t.key ? 'var(--dd-accent-bright)' : 'var(--dd-text-3)',
                  borderBottom: activeTab === t.key ? '2px solid var(--dd-accent)' : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'color 150ms ease',
                }}
              >
                <Icon name={t.icon} size={16} />
                {t.label}
                <span style={{
                  fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)',
                  padding: '1px 7px', borderRadius: 'var(--dd-radius-full)',
                  background: activeTab === t.key ? 'var(--dd-accent-dim)' : 'rgba(255,255,255,0.06)',
                  color: activeTab === t.key ? 'var(--dd-accent-bright)' : 'var(--dd-text-4)',
                }}>
                  {t.count}
                </span>
              </button>
            ))}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 6 }}>
              <select
                value={repoFilter}
                onChange={(e) => setRepoFilter(e.target.value)}
                style={{
                  background: 'var(--dd-surface)', color: 'var(--dd-text-2)',
                  border: '1px solid var(--dd-line)', borderRadius: 'var(--dd-radius-xs)',
                  padding: '5px 8px', fontSize: 11, fontFamily: 'var(--font-mono)',
                  cursor: 'pointer', maxWidth: 200,
                }}
              >
                <option value="all">All repos</option>
                {allRepoNames.map((r) => (
                  <option key={r} value={r}>{r.split('/')[1]}</option>
                ))}
              </select>
              <div style={{ position: 'relative' }}>
                <Icon name="search" size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--dd-text-4)', pointerEvents: 'none' }} />
                <input
                  className="input"
                  value={tabSearch}
                  onChange={(e) => setTabSearch(e.target.value)}
                  placeholder="Search..."
                  style={{ paddingLeft: 28, height: 30, fontSize: 12, width: 200 }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab content — scrollable */}
      {statusData && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px 28px 28px' }}>
          {activeTab === 'my-prs' && (
            <>
              {filteredMyPRs.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--dd-text-3)', fontSize: 13 }}>
                  {myPRs.length === 0 ? 'No open pull requests by you' : 'No PRs match your search'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredMyPRs.map((pr) => <MyPRCard key={`${pr.repo}-${pr.number}`} pr={pr} />)}
                </div>
              )}
            </>
          )}

          {activeTab === 'review' && (
            <>
              {filteredReviews.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--dd-text-3)', fontSize: 13 }}>
                  {reviewRequests.length === 0 ? 'No PRs waiting for your review' : 'No PRs match your search'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredReviews.map((pr) => <ReviewRequestCard key={`${pr.repo}-${pr.number}`} pr={pr} />)}
                </div>
              )}
            </>
          )}

          {activeTab === 'actions' && (
            <>
              {filteredMyCIRuns.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 600, color: 'var(--dd-text-2)' }}>
                    <Icon name="person" size={15} /> My Runs ({filteredMyCIRuns.length})
                  </div>
                  <div className="card" style={{ padding: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {filteredMyCIRuns.map((r) => <CIRunWithRepoRow key={r.id} run={r} />)}
                    </div>
                  </div>
                </div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 600, color: 'var(--dd-text-2)' }}>
                  <Icon name="groups" size={15} /> Team Activity ({filteredTeamCI.length})
                </div>
                {filteredTeamCI.length === 0 ? (
                  <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--dd-text-3)', fontSize: 13 }}>
                    {recentCIRuns.length === 0 ? 'No recent CI runs' : 'No runs match your search'}
                  </div>
                ) : (
                  <div className="card" style={{ padding: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {filteredTeamCI.map((r) => <CIRunWithRepoRow key={r.id} run={r} />)}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Token dialogs */}
      {showTokenDialog && (
        <DialogModal
          mode="prompt"
          title="Update GitHub Token"
          message="Enter a new token. It will be encrypted and stored locally."
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          onConfirm={async (val) => {
            if (val) {
              try {
                await setGitHubToken(val);
                addToast('Token updated', 'success');
                loadSettings();
              } catch (e: any) {
                addToast(e.message, 'error');
              }
            }
            setShowTokenDialog(false);
          }}
          onCancel={() => setShowTokenDialog(false)}
          confirmLabel="Update"
        />
      )}
      {showRemoveConfirm && (
        <DialogModal
          mode="confirm"
          title="Remove GitHub Token"
          description="This will remove your token and disable CI/CD tracking. You can re-add it later."
          danger
          onConfirm={handleRemoveToken}
          onCancel={() => setShowRemoveConfirm(false)}
          confirmLabel="Remove"
        />
      )}
    </div>
  );
}
