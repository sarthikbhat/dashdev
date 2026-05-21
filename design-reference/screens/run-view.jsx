/* global React, Icon, Kbd, Badge, Tag, Spinner, Glyph, Titlebar, Sidebar, StatusBar */

function RunView() {
  // Mixed-state run: 3 done, 1 running, 2 pending
  const steps = [
    { i: 1, name: 'Verify clean git tree', cmd: 'git status --porcelain', wd: '/', state: 'done', t: '0.1s', logs: [
      { t: '14:23:01', text: '$ git status --porcelain', kind: 'prompt' },
      { t: '14:23:01', text: 'Working tree clean.', kind: 'dim' },
    ]},
    { i: 2, name: 'Install dependencies', cmd: 'npm ci --prefer-offline', wd: '~/app', state: 'done', t: '23.8s' },
    { i: 3, name: 'Run unit tests', cmd: 'npm test -- --coverage', wd: '~/app', state: 'done', t: '38.4s' },
    { i: 4, name: 'Build production bundle', cmd: 'npm run build:staging', wd: '~/app', state: 'run', t: '— running 28s', current: true },
    { i: 5, name: 'Push to staging cluster', cmd: 'kubectl apply -f "k8s/staging/*.yaml"', wd: '~/infra', state: 'pending', t: '~18s' },
    { i: 6, name: 'Notify Slack channel', cmd: 'curl -X POST $SLACK_HOOK', wd: '/', state: 'pending', t: '~0.3s' },
  ];

  const logLines = [
    { ts: '14:23:54.012', kind: 'prompt', text: '$ npm run build:staging' },
    { ts: '14:23:54.218', kind: 'dim',    text: '> devdash-app@2.4.1 build:staging' },
    { ts: '14:23:54.218', kind: 'dim',    text: '> NODE_ENV=staging vite build --mode staging' },
    { ts: '14:23:54.844', kind: '',       text: 'vite v5.0.10 building for staging...' },
    { ts: '14:23:55.102', kind: 'info',   text: '✓ 47 modules transformed.' },
    { ts: '14:23:55.310', kind: '',       text: '  rendering chunks...' },
    { ts: '14:23:56.421', kind: 'info',   text: '  computing gzip size...' },
    { ts: '14:23:57.014', kind: '',       text: 'dist/index.html                          0.62 kB │ gzip:  0.41 kB' },
    { ts: '14:23:57.014', kind: '',       text: 'dist/assets/index-DkU2x4l1.css          12.04 kB │ gzip:  3.18 kB' },
    { ts: '14:23:57.014', kind: '',       text: 'dist/assets/runtime-CkP9bX2v.js          4.21 kB │ gzip:  1.92 kB' },
    { ts: '14:23:57.014', kind: '',       text: 'dist/assets/vendor-BqLm84vA.js         142.18 kB │ gzip: 45.82 kB' },
    { ts: '14:23:57.014', kind: '',       text: 'dist/assets/index-Bv9KpQrT.js          218.44 kB │ gzip: 68.91 kB' },
    { ts: '14:23:57.918', kind: 'warn',   text: '⚠ chunk size > 200 kB (set chunkSizeWarningLimit to suppress)' },
    { ts: '14:23:58.001', kind: 'info',   text: '✓ built in 3.78s' },
    { ts: '14:23:58.220', kind: 'dim',    text: '> postbuild: copying public assets' },
    { ts: '14:23:58.840', kind: '',       text: 'Generating service worker...' },
    { ts: '14:24:01.144', kind: 'info',   text: '✓ sw.js generated (4 precached entries)' },
    { ts: '14:24:01.451', kind: 'dim',    text: '> compressing artifacts → dist.tar.gz' },
    { ts: '14:24:15.882', kind: 'info',   text: '✓ artifact: dist.tar.gz (3.4 MB)' },
    { ts: '14:24:15.910', kind: 'dim',    text: '> uploading to artifact store' },
    { ts: '14:24:17.003', kind: '',       text: 'PUT https://artifacts.devdash.local/build/2476.tar.gz' },
  ];

  return (
    <div className="dd" style={{ width: '100%', height: '100%' }}>
      <div className="app-window">
        <Titlebar path="Deploy to staging · run #2476" />
        <Sidebar activeId="deploy-staging" />

        <main className="main">
          <div className="pg-head">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <Glyph ch="D" color="var(--dd-amber)" />
                  <h1>Deploy to staging</h1>
                  <Badge kind="run">
                    <span className="dot" style={{ background: 'var(--dd-amber)', boxShadow: '0 0 6px var(--dd-amber)' }}></span>
                    Running
                  </Badge>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>#2476</span>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--dd-text-3)' }}>
                  <span><Icon name="schedule" size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Started 1m 28s ago · 14:23:01</span>
                  <span><Icon name="person" size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Triggered by sarah.c</span>
                  <span><Icon name="terminal" size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />PID 28194</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-ghost"><Icon name="download" size={14} />Download logs</button>
                <button className="btn btn-secondary"><Icon name="pause" size={14} />Pause</button>
                <button className="btn btn-danger" onClick={() => window.dcGoTo?.('dashboard')}><Icon name="stop" size={14} />Cancel run</button>
              </div>
            </div>

            {/* Params used */}
            <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: 'var(--dd-text-4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Params</span>
              {[
                { k: 'branch', v: 'main' },
                { k: 'skip_tests', v: 'false' },
                { k: 'region', v: 'us-east-1' },
                { k: 'notify_channel', v: '#deploys' },
              ].map(p => (
                <span key={p.k} className="mono" style={{ fontSize: 11, padding: '2px 8px', background: 'var(--dd-surface-3)', border: '1px solid var(--dd-line)', borderRadius: 4, color: 'var(--dd-text-2)' }}>
                  <span style={{ color: 'var(--dd-text-4)' }}>{p.k}=</span>
                  <span style={{ color: p.v === 'false' ? 'var(--dd-red)' : 'var(--dd-green)' }}>{p.v}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Progress strip */}
          <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--dd-line)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)', minWidth: 50 }}>3 / 6</span>
            <div style={{ flex: 1, height: 4, background: 'var(--dd-surface-3)', borderRadius: 2, overflow: 'hidden', display: 'flex', gap: 2 }}>
              {steps.map(s => (
                <div key={s.i} style={{
                  flex: 1, borderRadius: 2,
                  background: s.state === 'done' ? 'var(--dd-green)' :
                              s.state === 'run' ? 'var(--dd-amber)' :
                              s.state === 'fail' ? 'var(--dd-red)' :
                              'var(--dd-line-2)',
                  opacity: s.state === 'run' ? 0.9 : 1,
                  animation: s.state === 'run' ? 'dd-blink 1.6s ease-in-out infinite' : 'none',
                }} />
              ))}
            </div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>elapsed 1m 28s · ETA ~52s</span>
          </div>

          {/* Body: steps + log */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '360px 1fr', overflow: 'hidden', minHeight: 0 }}>
            {/* Steps */}
            <div style={{ borderRight: '1px solid var(--dd-line)', overflow: 'auto', padding: '12px 12px', background: 'var(--dd-surface)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dd-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 6px 10px' }}>Steps</div>
              {steps.map(step => (
                <div key={step.i} className={`step ${step.state === 'pending' ? 'pending' : ''} ${step.current ? 'active' : ''}`}>
                  <span className={`step-marker ${step.state}`}>
                    {step.state === 'done'    && <Icon name="check" size={11} style={{ fontVariationSettings: "'wght' 700" }} />}
                    {step.state === 'run'     && <Spinner />}
                    {step.state === 'pending' && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{step.i}</span>}
                    {step.state === 'fail'    && <Icon name="close" size={11} />}
                  </span>
                  <div className="step-body">
                    <div className="step-title">{step.name}</div>
                    <div className="step-cmd mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--dd-text-4)' }}>$ </span>{step.cmd}
                    </div>
                  </div>
                  <span className="step-time" style={{ color: step.state === 'run' ? 'var(--dd-amber)' : undefined }}>{step.t}</span>
                </div>
              ))}
            </div>

            {/* Log panel */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#07070a' }}>
              {/* Log header */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid var(--dd-line)', background: 'var(--dd-surface)', gap: 12 }}>
                <Icon name="terminal" size={14} style={{ color: 'var(--dd-text-3)' }} />
                <span style={{ fontSize: 12, fontWeight: 500 }}>Step 4 · Build production bundle</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>stdout + stderr · live</span>
                <span style={{ flex: 1 }}></span>
                <button className="btn btn-ghost btn-sm"><Icon name="wrap_text" size={12} />Wrap</button>
                <button className="btn btn-ghost btn-sm"><Icon name="vertical_align_bottom" size={12} />Follow</button>
                <button className="btn btn-ghost btn-sm"><Icon name="search" size={12} /></button>
                <button className="btn btn-ghost btn-sm"><Icon name="content_copy" size={12} /></button>
              </div>
              {/* Log body */}
              <div className="terminal" style={{ flex: 1, borderRadius: 0, border: 0, overflow: 'auto', padding: '10px 14px' }}>
                {logLines.map((l, i) => (
                  <div key={i} className="term-line">
                    <span className="ts">{l.ts}</span>
                    <span className={l.kind}>{l.text}</span>
                  </div>
                ))}
                <div className="term-line">
                  <span className="ts">14:24:18.221</span>
                  <span>Upload progress: 78% (2.6 MB / 3.4 MB)</span>
                  <span className="term-cursor" style={{ marginLeft: 4 }}></span>
                </div>
              </div>
              {/* Log footer */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '6px 14px', borderTop: '1px solid var(--dd-line)', background: 'var(--dd-surface)', fontSize: 11, color: 'var(--dd-text-4)', fontFamily: 'var(--font-mono)', gap: 16 }}>
                <span><span style={{ color: 'var(--dd-green)' }}>●</span> connected</span>
                <span>847 lines</span>
                <span>0 errors</span>
                <span style={{ color: 'var(--dd-amber)' }}>1 warning</span>
                <span style={{ flex: 1 }}></span>
                <span>scrolled to bottom</span>
              </div>
            </div>
          </div>
        </main>

        <StatusBar extra={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--dd-amber)' }}>
            <Spinner />Running #2476 · step 4/6
          </span>
        } />
      </div>
    </div>
  );
}

window.RunView = RunView;
