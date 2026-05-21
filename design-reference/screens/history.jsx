/* global React, Icon, Kbd, Badge, Tag, Spinner, Glyph, Titlebar, Sidebar, StatusBar */

function History() {
  const rows = [
    { id: 2476, wf: 'Deploy to staging',    ch: 'D', color: 'var(--dd-amber)',  st: 'run',   d: '1m 28s ', by: 'sarah', when: '14:24:12', date: 'Today',     br: 'main',         steps: '3/6' },
    { id: 2475, wf: 'Restart API services', ch: 'R', color: 'var(--dd-cyan)',   st: 'run',   d: '0m 22s ', by: 'cron',  when: '14:00:00', date: 'Today',     br: '—',            steps: '2/4' },
    { id: 2474, wf: 'Deploy to staging',    ch: 'D', color: 'var(--dd-amber)',  st: 'pass',  d: '2m 18s', by: 'sarah', when: '14:09:44', date: 'Today',     br: 'main',         steps: '6/6', expand: true },
    { id: 2473, wf: 'Toggle feature flags', ch: 'F', color: 'var(--dd-blue)',   st: 'pass',  d: '0m 03s', by: 'devon', when: '13:42:11', date: 'Today',     br: '—',            steps: '2/2' },
    { id: 2472, wf: 'Run DB migrations',    ch: 'M', color: 'var(--dd-purple)', st: 'pass',  d: '12.4s',  by: 'sarah', when: '13:20:08', date: 'Today',     br: 'main',         steps: '3/3' },
    { id: 2471, wf: 'Deploy to staging',    ch: 'D', color: 'var(--dd-amber)',  st: 'fail',  d: '0m 38s', by: 'devon', when: '12:14:32', date: 'Today',     br: 'feat/checkout', steps: '3/6' },
    { id: 2470, wf: 'Purge CDN cache',      ch: 'C', color: 'var(--dd-blue)',   st: 'pass',  d: '4.1s',   by: 'sarah', when: '11:58:01', date: 'Today',     br: '—',            steps: '2/2' },
    { id: 2469, wf: 'Deploy to production', ch: 'D', color: 'var(--dd-red)',    st: 'cancel',d: '0m 12s', by: 'sarah', when: '11:50:44', date: 'Today',     br: 'main',         steps: '1/8' },
    { id: 2468, wf: 'Seed dev database',    ch: 'S', color: 'var(--dd-green)',  st: 'pass',  d: '8.9s',   by: 'mira',  when: '10:22:30', date: 'Today',     br: '—',            steps: '4/4' },
    { id: 2467, wf: 'Rotate API keys',      ch: 'K', color: 'var(--dd-amber)',  st: 'pass',  d: '22.3s',  by: 'cron',  when: '04:00:00', date: 'Today',     br: '—',            steps: '5/5' },
    { id: 2466, wf: 'Deploy to staging',    ch: 'D', color: 'var(--dd-amber)',  st: 'pass',  d: '2m 24s', by: 'sarah', when: '18:24:01', date: 'Yesterday', br: 'main',         steps: '6/6' },
    { id: 2465, wf: 'Generate changelog',   ch: 'G', color: 'var(--dd-purple)', st: 'pass',  d: '1.8s',   by: 'mira',  when: '17:50:18', date: 'Yesterday', br: 'release/v2.4', steps: '2/2' },
    { id: 2464, wf: 'Run DB migrations',    ch: 'M', color: 'var(--dd-purple)', st: 'fail',  d: '4.6s',   by: 'devon', when: '17:22:14', date: 'Yesterday', br: 'main',         steps: '2/3' },
    { id: 2463, wf: 'Sync secrets from vault', ch: 'S', color: 'var(--dd-cyan)', st: 'pass', d: '6.2s',   by: 'cron',  when: '12:00:00', date: 'Yesterday', br: '—',            steps: '3/3' },
  ];

  return (
    <div className="dd" style={{ width: '100%', height: '100%' }}>
      <div className="app-window">
        <Titlebar path="History" />
        <Sidebar activeId="" />

        <main className="main">
          <div className="pg-head">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <h1><Icon name="history" size={18} style={{ color: 'var(--dd-text-3)' }} />Run history</h1>
                <p className="sub">All workflow runs · stored in <span className="mono">~/.devdash/history.sqlite</span></p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost"><Icon name="download" size={14} />Export</button>
                <button className="btn btn-secondary"><Icon name="delete_sweep" size={14} />Clear older than 30d</button>
              </div>
            </div>

            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '0 1 260px' }}>
                <Icon name="search" size={13} style={{ position: 'absolute', left: 8, top: 7, color: 'var(--dd-text-4)' }} />
                <input className="input" style={{ paddingLeft: 26, fontSize: 12 }} placeholder="Search by id, workflow, branch…" defaultValue="" />
              </div>
              <Pill icon="filter_alt" label="All workflows" caret />
              <Pill label="Last 7 days" caret />
              <FilterChip color="var(--dd-green)" label="Pass" count="184" active />
              <FilterChip color="var(--dd-red)" label="Fail" count="38" active />
              <FilterChip color="var(--dd-amber)" label="Running" count="2" active />
              <FilterChip color="var(--dd-text-3)" label="Cancelled" count="23" />
              <span style={{ flex: 1 }}></span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>247 runs · 92.4% pass</span>
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table className="dd-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th style={{ width: 70 }}>ID</th>
                  <th>Workflow</th>
                  <th style={{ width: 80 }}>Status</th>
                  <th style={{ width: 80 }}>Duration</th>
                  <th style={{ width: 70 }}>Steps</th>
                  <th>Branch</th>
                  <th style={{ width: 90 }}>By</th>
                  <th style={{ width: 110 }}>When</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const prevDate = i > 0 ? rows[i - 1].date : null;
                  return (
                    <React.Fragment key={r.id}>
                      {r.date !== prevDate && (
                        <tr>
                          <td colSpan="10" style={{ padding: '12px 14px 6px', background: 'var(--dd-bg)', fontSize: 10, fontWeight: 600, color: 'var(--dd-text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--dd-line)' }}>
                            {r.date}
                          </td>
                        </tr>
                      )}
                      <tr className={r.expand ? 'expanded' : ''} style={{ cursor: 'pointer' }} onClick={() => window.dcGoTo?.('run-view')}>
                        <td><StatusIcon st={r.st} /></td>
                        <td className="mono" style={{ color: 'var(--dd-text)' }}>#{r.id}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <Glyph ch={r.ch} color={r.color} />
                            <span style={{ color: 'var(--dd-text)' }}>{r.wf}</span>
                          </span>
                        </td>
                        <td><StatusBadge st={r.st} /></td>
                        <td className="mono">{r.d}</td>
                        <td className="mono" style={{ color: 'var(--dd-text-3)' }}>{r.steps}</td>
                        <td className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>{r.br}</td>
                        <td>{r.by}</td>
                        <td className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>{r.when}</td>
                        <td><Icon name={r.expand ? 'expand_less' : 'chevron_right'} size={14} style={{ color: 'var(--dd-text-4)' }} /></td>
                      </tr>
                      {r.expand && <ExpandedRow />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ borderTop: '1px solid var(--dd-line)', padding: '8px 22px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--dd-text-3)', fontFamily: 'var(--font-mono)' }}>
            <span>Showing 1–14 of 247</span>
            <span style={{ flex: 1 }}></span>
            <button className="btn btn-ghost btn-sm"><Icon name="chevron_left" size={12} />Prev</button>
            <span>Page 1 / 18</span>
            <button className="btn btn-ghost btn-sm">Next<Icon name="chevron_right" size={12} /></button>
          </div>
        </main>

        <StatusBar />
      </div>
    </div>
  );
}

function Pill({ icon, label, caret }) {
  return (
    <button className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}>
      {icon && <Icon name={icon} size={12} style={{ color: 'var(--dd-text-3)' }} />}
      {label}
      {caret && <Icon name="expand_more" size={12} style={{ color: 'var(--dd-text-4)' }} />}
    </button>
  );
}

function FilterChip({ color, label, count, active }) {
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', fontSize: 12, fontFamily: 'inherit',
      background: active ? 'var(--dd-surface-3)' : 'transparent',
      border: `1px solid ${active ? 'var(--dd-line-2)' : 'var(--dd-line)'}`,
      borderRadius: 999, cursor: 'pointer',
      color: active ? 'var(--dd-text)' : 'var(--dd-text-3)',
      opacity: active ? 1 : 0.7,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: color }}></span>
      {label}
      <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>{count}</span>
    </button>
  );
}

function StatusIcon({ st }) {
  if (st === 'pass')   return <Icon name="check_circle" size={14} fill style={{ color: 'var(--dd-green)' }} />;
  if (st === 'fail')   return <Icon name="cancel" size={14} fill style={{ color: 'var(--dd-red)' }} />;
  if (st === 'run')    return <Spinner />;
  if (st === 'cancel') return <Icon name="do_not_disturb_on" size={14} fill style={{ color: 'var(--dd-text-3)' }} />;
  return null;
}

function StatusBadge({ st }) {
  if (st === 'pass')   return <Badge kind="success">Passed</Badge>;
  if (st === 'fail')   return <Badge kind="fail">Failed</Badge>;
  if (st === 'run')    return <Badge kind="run">Running</Badge>;
  if (st === 'cancel') return <Badge kind="pending">Cancelled</Badge>;
  return null;
}

function ExpandedRow() {
  const steps = [
    { i: 1, name: 'Verify clean git tree',       t: '0.1s',  st: 'done' },
    { i: 2, name: 'Install dependencies',        t: '24.0s', st: 'done' },
    { i: 3, name: 'Run unit tests',              t: '38.4s', st: 'done' },
    { i: 4, name: 'Build production bundle',     t: '52.1s', st: 'done' },
    { i: 5, name: 'Push to staging cluster',     t: '17.8s', st: 'done' },
    { i: 6, name: 'Notify Slack channel',        t: '0.3s',  st: 'done' },
  ];
  return (
    <tr>
      <td colSpan="10" style={{ padding: 0, background: 'var(--dd-surface-2)', borderBottom: '1px solid var(--dd-line)' }}>
        <div style={{ padding: '14px 14px 14px 56px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Steps recap */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dd-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Steps · 6 passed</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {steps.map(s => (
                <div key={s.i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
                  <span className="step-marker done" style={{ width: 14, height: 14 }}>
                    <Icon name="check" size={9} style={{ fontVariationSettings: "'wght' 700" }} />
                  </span>
                  <span style={{ color: 'var(--dd-text)' }}>{s.name}</span>
                  <span style={{ flex: 1 }}></span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>{s.t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Log preview */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--dd-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Log tail · step 5</span>
              <span style={{ flex: 1 }}></span>
              <button className="btn btn-ghost btn-sm"><Icon name="open_in_new" size={11} />Open full run</button>
            </div>
            <div className="terminal" style={{ fontSize: 11, padding: '8px 10px', maxHeight: 150, overflow: 'hidden' }}>
              <div className="term-line"><span className="ts">14:11:48</span><span className="prompt">$ kubectl apply -f k8s/staging/*.yaml</span></div>
              <div className="term-line"><span className="ts">14:11:48</span>deployment.apps/devdash-app configured</div>
              <div className="term-line"><span className="ts">14:11:48</span>service/devdash-app unchanged</div>
              <div className="term-line"><span className="ts">14:11:49</span>configmap/devdash-config configured</div>
              <div className="term-line"><span className="ts">14:11:49</span>ingress.networking/devdash unchanged</div>
              <div className="term-line"><span className="ts">14:11:54</span><span className="info">→ rolling out deployment/devdash-app</span></div>
              <div className="term-line"><span className="ts">14:12:02</span>Waiting for rollout to finish: 1 of 3 updated replicas are available...</div>
              <div className="term-line"><span className="ts">14:12:06</span>Waiting for rollout to finish: 2 of 3 updated replicas are available...</div>
              <div className="term-line"><span className="ts">14:12:11</span><span className="info">deployment "devdash-app" successfully rolled out</span></div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

window.History = History;
