/* global React, Icon, Kbd, Badge, Tag, Spinner, Glyph */

function ParamModal() {
  const [skipTests, setSkipTests] = React.useState(false);
  const [region, setRegion] = React.useState('us-east-1');
  const [confirm, setConfirm] = React.useState(false);

  return (
    <div className="dd" style={{
      width: '100%', height: '100%',
      // backdrop: faded screenshot of dashboard behind a scrim
      background:
        `radial-gradient(circle at 30% 20%, rgba(96,165,250,0.06), transparent 50%),
         radial-gradient(circle at 80% 70%, rgba(167,139,250,0.05), transparent 60%),
         #0a0a0c`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Faded backdrop content (suggesting the dashboard behind) */}
      <BackdropHint />

      {/* Scrim */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(7,7,10,0.55)', backdropFilter: 'blur(4px)' }}></div>

      {/* Modal */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: 520, maxWidth: '90%',
        background: 'var(--dd-surface-2)',
        border: '1px solid var(--dd-line-2)',
        borderRadius: 10,
        boxShadow: '0 20px 60px -10px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02) inset',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--dd-line)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Glyph ch="D" color="var(--dd-amber)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dd-text)' }}>Run · Deploy to staging</div>
            <div style={{ fontSize: 11, color: 'var(--dd-text-3)', marginTop: 1 }}>3 parameters · ~2m 30s estimated</div>
          </div>
          <button style={{
            width: 24, height: 24, padding: 0, border: 0, background: 'transparent',
            color: 'var(--dd-text-3)', cursor: 'pointer', borderRadius: 4,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 18px 6px' }}>
          {/* branch — text */}
          <Field label="branch" type="text" required help="Git branch to deploy">
            <div style={{ position: 'relative' }}>
              <Icon name="fork_right" size={14} style={{ position: 'absolute', left: 9, top: 8, color: 'var(--dd-text-4)' }} />
              <input className="input mono" defaultValue="main" style={{ paddingLeft: 30, fontSize: 13 }} />
              <span style={{ position: 'absolute', right: 9, top: 6, fontSize: 10, color: 'var(--dd-text-4)', background: 'var(--dd-surface)', padding: '1px 6px', borderRadius: 3, border: '1px solid var(--dd-line)' }}>
                <Icon name="check" size={10} style={{ color: 'var(--dd-green)', verticalAlign: '-1px', marginRight: 3 }} />exists
              </span>
            </div>
          </Field>

          {/* skip_tests — toggle */}
          <Field label="skip_tests" type="toggle" help="Skip the unit test step. Use sparingly.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setSkipTests(v => !v)} style={{
                width: 32, height: 18, borderRadius: 9, padding: 2,
                background: skipTests ? 'var(--dd-amber)' : 'var(--dd-surface-3)',
                border: `1px solid ${skipTests ? 'var(--dd-amber)' : 'var(--dd-line-2)'}`,
                cursor: 'pointer', position: 'relative', transition: 'background 120ms',
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: 6,
                  background: skipTests ? '#0a0a0c' : 'var(--dd-text-3)',
                  transform: `translateX(${skipTests ? 14 : 0}px)`,
                  transition: 'transform 120ms',
                }}></div>
              </button>
              <span className="mono" style={{ fontSize: 12, color: skipTests ? 'var(--dd-amber)' : 'var(--dd-text-2)' }}>
                {skipTests ? 'true' : 'false'}
              </span>
              {skipTests && <span style={{ fontSize: 11, color: 'var(--dd-amber)' }}><Icon name="warning_amber" size={12} style={{ verticalAlign: '-2px', marginRight: 3 }} />tests will be skipped</span>}
            </div>
          </Field>

          {/* region — select */}
          <Field label="region" type="select" required help="Target deployment region">
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { v: 'us-east-1',  flag: '🇺🇸', label: 'Virginia' },
                { v: 'eu-west-1',  flag: '🇮🇪', label: 'Ireland' },
                { v: 'ap-south-1', flag: '🇮🇳', label: 'Mumbai' },
              ].map(o => (
                <button key={o.v} onClick={() => setRegion(o.v)} style={{
                  flex: 1, padding: '8px 10px',
                  background: region === o.v ? 'rgba(96,165,250,0.08)' : 'var(--dd-surface-3)',
                  border: `1px solid ${region === o.v ? 'var(--dd-blue)' : 'var(--dd-line)'}`,
                  borderRadius: 6, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                  fontFamily: 'inherit', color: 'var(--dd-text)',
                  textAlign: 'left',
                }}>
                  <span className="mono" style={{ fontSize: 12, color: region === o.v ? 'var(--dd-blue)' : 'var(--dd-text)' }}>{o.v}</span>
                  <span style={{ fontSize: 11, color: 'var(--dd-text-3)' }}>{o.label}</span>
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Env preview */}
        <details open style={{ padding: '4px 18px 12px' }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--dd-text-3)', marginBottom: 6 }}>
            <Icon name="expand_more" size={14} />
            <span>Will run as</span>
            <span className="mono">deploy-staging</span>
            <span style={{ flex: 1 }}></span>
            <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 10 }}><Icon name="content_copy" size={10} />Copy command</button>
          </summary>
          <div className="terminal" style={{ fontSize: 11, padding: '8px 10px', lineHeight: '18px' }}>
            <div className="term-line">
              <span className="prompt">$</span>{' '}
              <span style={{ color: 'var(--dd-text)' }}>devdash run</span>{' '}
              <span style={{ color: 'var(--dd-blue)' }}>deploy-staging</span>
              {' '}<span className="flag">--branch</span> <span className="str">main</span>
              {skipTests && <> <span className="flag">--skip-tests</span></>}
              {' '}<span className="flag">--region</span> <span className="str">{region}</span>
            </div>
          </div>
        </details>

        {/* Confirm checkbox + footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--dd-line)', background: 'var(--dd-surface)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--dd-text-2)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={confirm}
              onChange={e => setConfirm(e.target.checked)}
              style={{ accentColor: 'var(--dd-blue)' }}
            />
            <span>Save these values as the new defaults</span>
          </label>
          <span style={{ flex: 1 }}></span>
          <button className="btn btn-ghost" onClick={() => window.dcGoTo?.('dashboard')}>Cancel <Kbd>Esc</Kbd></button>
          <button className="btn btn-primary" onClick={() => window.dcGoTo?.('run-view')}><Icon name="play_arrow" size={14} />Run workflow<span style={{ marginLeft: 6, opacity: 0.6 }}><Kbd>⌘↵</Kbd></span></button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, required, help, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 12, color: 'var(--dd-text)' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--dd-purple)' }}>{type}</span>
        {required && <span style={{ fontSize: 10, color: 'var(--dd-amber)', fontWeight: 500 }}>required</span>}
        <span style={{ flex: 1 }}></span>
        {help && <span style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>{help}</span>}
      </div>
      {children}
    </div>
  );
}

// Subtle suggestion of the dashboard behind the modal
function BackdropHint() {
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 0.5, filter: 'blur(0.5px)', pointerEvents: 'none' }}>
      {/* Fake titlebar */}
      <div style={{ height: 32, background: '#07070a', borderBottom: '1px solid var(--dd-line)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 6, background: '#ff5f57' }}></span>
          <span style={{ width: 11, height: 11, borderRadius: 6, background: '#febc2e' }}></span>
          <span style={{ width: 11, height: 11, borderRadius: 6, background: '#28c840' }}></span>
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--dd-text-4)' }}>localhost:3847 › Deploy to staging</span>
      </div>
      {/* Fake sidebar suggestion */}
      <div style={{ position: 'absolute', top: 32, left: 0, width: 240, bottom: 28, background: 'var(--dd-surface-2)', borderRight: '1px solid var(--dd-line)' }}>
        <div style={{ padding: 12 }}>
          {[20, 32, 28, 36, 22, 30, 26].map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--dd-surface-3)' }}></div>
              <div style={{ flex: 1, height: 8, background: 'var(--dd-surface-3)', borderRadius: 2 }}></div>
            </div>
          ))}
        </div>
      </div>
      {/* Fake main heading */}
      <div style={{ position: 'absolute', top: 60, left: 264, right: 24 }}>
        <div style={{ width: 220, height: 18, background: 'var(--dd-surface-3)', borderRadius: 3, marginBottom: 8 }}></div>
        <div style={{ width: 360, height: 10, background: 'var(--dd-surface-3)', borderRadius: 3, opacity: 0.6 }}></div>
      </div>
      {/* Fake status bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, background: '#07070a', borderTop: '1px solid var(--dd-line)' }}></div>
    </div>
  );
}

window.ParamModal = ParamModal;
