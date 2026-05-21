/* global React, Icon, Kbd, Badge, Tag, Spinner, Glyph, Titlebar, Sidebar, StatusBar */

function Dashboard() {
  return (
    <div className="dd" style={{ width: '100%', height: '100%' }}>
      <div className="app-window">
        <Titlebar path="Deploy to staging" />
        <Sidebar activeId="deploy-staging" />

        <main className="main">
          <div className="pg-head">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Glyph ch="D" color="var(--dd-amber)" />
                  <h1>Deploy to staging</h1>
                  <div style={{ display: 'flex', gap: 4 }}><Tag>deploy</Tag><Tag>staging</Tag></div>
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--dd-text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="schedule" size={12} />Last run 14m ago · <span className="mono" style={{ color: 'var(--dd-green)' }}>✓ passed</span>
                  </span>
                </div>
                <p className="sub">Builds the app, runs smoke tests, and pushes to staging cluster. Notifies #deploys on completion.</p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-ghost" onClick={() => window.dcGoTo?.('history')}><Icon name="history" size={14} />Logs</button>
                <button className="btn btn-secondary" onClick={() => window.dcGoTo?.('editor')}><Icon name="edit" size={14} />Edit</button>
                <button className="btn btn-primary" onClick={() => window.dcGoTo?.('param-modal')}><Icon name="play_arrow" size={14} />Run<span style={{ marginLeft: 6, opacity: 0.6 }}><Kbd>⌘R</Kbd></span></button>
              </div>
            </div>
          </div>

          {/* Body — 2-column */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
            {/* Left: steps + params */}
            <div style={{ padding: '16px 22px', overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dd-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steps</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>6 · ~2m 30s total</span>
                </div>
                <div style={{ display: 'flex', gap: 4, fontSize: 11, color: 'var(--dd-text-3)' }}>
                  <button className="btn btn-ghost btn-sm"><Icon name="visibility" size={12} />Dry run</button>
                </div>
              </div>

              <div className="card" style={{ padding: 4, marginBottom: 18 }}>
                {[
                  { i: 1, name: 'Verify clean git tree', cmd: ['git ', { v: 'status' }, ' --porcelain'], wd: '/', t: '0.1s' },
                  { i: 2, name: 'Install dependencies', cmd: ['npm ', { v: 'ci' }, ' --prefer-offline'], wd: '~/app', t: '24s' },
                  { i: 3, name: 'Run unit tests', cmd: ['npm ', { v: 'test' }, ' -- ', { f: '--coverage' }], wd: '~/app', t: '38s' },
                  { i: 4, name: 'Build production bundle', cmd: ['npm run ', { v: 'build' }, ':staging'], wd: '~/app', t: '52s' },
                  { i: 5, name: 'Push to staging cluster', cmd: ['kubectl apply -f ', { s: '"k8s/staging/*.yaml"' }], wd: '~/infra', t: '18s' },
                  { i: 6, name: 'Notify Slack channel', cmd: ['curl ', { f: '-X POST' }, ' ', { v: '$SLACK_HOOK' }], wd: '/', t: '0.3s' },
                ].map(step => (
                  <div key={step.i} className="step">
                    <span className="step-marker pending" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{step.i}</span>
                    <div className="step-body">
                      <div className="step-title">{step.name}</div>
                      <div className="step-cmd">
                        <span style={{ color: 'var(--dd-text-4)' }}>$ </span>
                        {step.cmd.map((part, i) => {
                          if (typeof part === 'string') return <span key={i}>{part}</span>;
                          if (part.v) return <span key={i} className="var">{part.v}</span>;
                          if (part.f) return <span key={i} className="flag">{part.f}</span>;
                          if (part.s) return <span key={i} className="str">{part.s}</span>;
                          return null;
                        })}
                        <span style={{ marginLeft: 10, color: 'var(--dd-text-4)' }}>· cwd <span style={{ color: 'var(--dd-text-3)' }}>{step.wd}</span></span>
                      </div>
                    </div>
                    <span className="step-time">{step.t}</span>
                  </div>
                ))}
              </div>

              {/* Parameters */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dd-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parameters</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>3 inputs</span>
              </div>
              <div className="card" style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                {[
                  { k: 'branch', v: 'text', def: 'main', help: 'Git branch to deploy' },
                  { k: 'skip_tests', v: 'toggle', def: 'false' },
                  { k: 'region', v: 'select', def: 'us-east-1', help: '3 options' },
                ].map(p => (
                  <div key={p.k} style={{ background: 'var(--dd-surface-3)', border: '1px solid var(--dd-line)', borderRadius: 6, padding: '8px 10px' }}>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--dd-text)' }}>{p.k}</div>
                    <div style={{ fontSize: 11, color: 'var(--dd-text-3)', marginTop: 2 }}>
                      <span style={{ color: 'var(--dd-purple)' }}>{p.v}</span>
                      <span style={{ color: 'var(--dd-text-4)' }}> = </span>
                      <span className="mono">{p.def}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent runs strip */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dd-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent runs</span>
                <a style={{ fontSize: 11, color: 'var(--dd-blue)', textDecoration: 'none' }}>View all →</a>
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="dd-table">
                  <tbody>
                    {[
                      { t: '14m ago', st: 'pass', d: '2m 18s', who: 'sarah', br: 'main' },
                      { t: '2h ago',  st: 'pass', d: '2m 22s', who: 'sarah', br: 'main' },
                      { t: '5h ago',  st: 'fail', d: '0m 38s', who: 'devon', br: 'feat/checkout' },
                      { t: '1d ago',  st: 'pass', d: '2m 14s', who: 'sarah', br: 'main' },
                    ].map((r, i) => (
                      <tr key={i}>
                        <td style={{ width: 22, padding: '8px 0 8px 14px' }}>
                          {r.st === 'pass' ? <Icon name="check_circle" size={14} fill style={{ color: 'var(--dd-green)' }} /> :
                           <Icon name="cancel" size={14} fill style={{ color: 'var(--dd-red)' }} />}
                        </td>
                        <td className="mono" style={{ color: 'var(--dd-text)' }}>#247{4-i}</td>
                        <td>{r.t}</td>
                        <td className="mono" style={{ color: 'var(--dd-text-3)' }}>{r.d}</td>
                        <td>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>{r.br}</span>
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--dd-text-3)' }}>by {r.who}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: details inspector */}
            <aside style={{ borderLeft: '1px solid var(--dd-line)', background: 'var(--dd-surface-2)', overflow: 'auto', padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dd-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Details</div>

              <dl style={{ margin: 0, fontSize: 12, display: 'grid', gridTemplateColumns: '90px 1fr', rowGap: 10, columnGap: 12 }}>
                <dt style={{ color: 'var(--dd-text-4)' }}>ID</dt>
                <dd className="mono" style={{ margin: 0, color: 'var(--dd-text-2)' }}>deploy-staging</dd>

                <dt style={{ color: 'var(--dd-text-4)' }}>File</dt>
                <dd className="mono" style={{ margin: 0, color: 'var(--dd-text-2)' }}>workflows/deploy-staging.js</dd>

                <dt style={{ color: 'var(--dd-text-4)' }}>Created</dt>
                <dd style={{ margin: 0, color: 'var(--dd-text-2)' }}>Mar 14, 2026</dd>

                <dt style={{ color: 'var(--dd-text-4)' }}>Author</dt>
                <dd style={{ margin: 0, color: 'var(--dd-text-2)' }}>sarah.c</dd>

                <dt style={{ color: 'var(--dd-text-4)' }}>Total runs</dt>
                <dd className="mono" style={{ margin: 0, color: 'var(--dd-text-2)' }}>2,474</dd>

                <dt style={{ color: 'var(--dd-text-4)' }}>Pass rate</dt>
                <dd style={{ margin: 0, color: 'var(--dd-green)' }}>94.2% <span style={{ color: 'var(--dd-text-4)' }}>(30d)</span></dd>

                <dt style={{ color: 'var(--dd-text-4)' }}>Avg duration</dt>
                <dd className="mono" style={{ margin: 0, color: 'var(--dd-text-2)' }}>2m 24s</dd>

                <dt style={{ color: 'var(--dd-text-4)' }}>Timeout</dt>
                <dd className="mono" style={{ margin: 0, color: 'var(--dd-text-2)' }}>10m</dd>

                <dt style={{ color: 'var(--dd-text-4)' }}>On failure</dt>
                <dd style={{ margin: 0, color: 'var(--dd-text-2)' }}>abort + notify</dd>

                <dt style={{ color: 'var(--dd-text-4)' }}>Schedule</dt>
                <dd style={{ margin: 0, color: 'var(--dd-text-3)' }}>—</dd>
              </dl>

              {/* Run trend sparkline */}
              <div style={{ marginTop: 18, padding: '12px 12px 14px', background: 'var(--dd-surface-3)', borderRadius: 6, border: '1px solid var(--dd-line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11 }}>
                  <span style={{ color: 'var(--dd-text-3)' }}>Duration trend</span>
                  <span className="mono" style={{ color: 'var(--dd-text-2)' }}>14d</span>
                </div>
                <svg viewBox="0 0 280 60" style={{ width: '100%', height: 50 }}>
                  <polyline
                    fill="none" stroke="var(--dd-blue)" strokeWidth="1.5"
                    points="0,32 20,28 40,30 60,24 80,26 100,22 120,28 140,18 160,24 180,20 200,26 220,16 240,22 260,14 280,18"
                  />
                  <polyline
                    fill="rgba(96,165,250,0.08)" stroke="none"
                    points="0,60 0,32 20,28 40,30 60,24 80,26 100,22 120,28 140,18 160,24 180,20 200,26 220,16 240,22 260,14 280,18 280,60"
                  />
                  {[14, 20, 22, 16, 18].map((y, i) => (
                    <circle key={i} cx={i * 60 + 40} cy={y + 5} r="2" fill="var(--dd-blue)" />
                  ))}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--dd-text-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  <span>Mar 7</span><span>Mar 14</span><span>Mar 20</span>
                </div>
              </div>

              {/* Triggers */}
              <div style={{ marginTop: 18, fontSize: 11, fontWeight: 600, color: 'var(--dd-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Triggers</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--dd-surface-3)', borderRadius: 5, border: '1px solid var(--dd-line)' }}>
                  <Icon name="keyboard" size={14} style={{ color: 'var(--dd-text-3)' }} />
                  <span style={{ fontSize: 12, flex: 1 }}>Keyboard shortcut</span>
                  <Kbd>⌘⇧S</Kbd>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--dd-surface-3)', borderRadius: 5, border: '1px solid var(--dd-line)' }}>
                  <Icon name="webhook" size={14} style={{ color: 'var(--dd-text-3)' }} />
                  <span style={{ fontSize: 12, flex: 1 }}>Webhook</span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--dd-text-4)' }}>/hook/ds</span>
                </div>
              </div>
            </aside>
          </div>
        </main>

        <StatusBar />
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
