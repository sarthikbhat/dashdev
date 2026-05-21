/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard,
   Dashboard, RunView, Editor, History, ParamModal, EmptyState,
   TweaksPanel, TweakSection, TweakColor, TweakRadio, useTweaks */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#60a5fa",
  "density": "cozy",
  "tint": "default"
}/*EDITMODE-END*/;

// Map accent → primary token override and named accent color tokens.
// Each option is the hex used as --dd-blue (primary) override.
const ACCENT_NAMES = {
  '#60a5fa': 'Sky',
  '#a78bfa': 'Violet',
  '#34d399': 'Mint',
  '#fbbf24': 'Amber',
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply accent globally to .dd surfaces via a stylesheet override.
  React.useEffect(() => {
    const id = 'dd-accent-overrides';
    let s = document.getElementById(id);
    if (!s) { s = document.createElement('style'); s.id = id; document.head.appendChild(s); }
    s.textContent = `.dd { --dd-blue: ${t.accent}; }`;
  }, [t.accent]);

  // Decorate all .dd roots with current density + tint after each render.
  React.useEffect(() => {
    document.querySelectorAll('.dd').forEach(el => {
      el.setAttribute('data-density', t.density);
      el.setAttribute('data-tint', t.tint);
    });
  });

  return (
    <>
      <DesignCanvas>
        <DCSection id="flow" title="Primary flow">
          <DCArtboard id="dashboard" label="01 · Dashboard" width={1280} height={820}>
            <Dashboard />
          </DCArtboard>
          <DCArtboard id="param-modal" label="02 · Param modal" width={1100} height={820}>
            <ParamModal />
          </DCArtboard>
          <DCArtboard id="run-view" label="03 · Run view" width={1280} height={820}>
            <RunView />
          </DCArtboard>
          <DCArtboard id="history" label="04 · Run history" width={1280} height={820}>
            <History />
          </DCArtboard>
          <DCArtboard id="editor" label="05 · Workflow editor" width={1280} height={820}>
            <Editor />
          </DCArtboard>
        </DCSection>

        <DCSection id="onboarding" title="Onboarding">
          <DCArtboard id="empty" label="06 · Empty / first run" width={1280} height={820}>
            <EmptyState />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Accent">
          <TweakColor
            label="Color"
            value={t.accent}
            options={Object.keys(ACCENT_NAMES)}
            onChange={v => setTweak('accent', v)}
          />
        </TweakSection>

        <TweakSection label="Layout">
          <TweakRadio
            label="Density"
            value={t.density}
            options={['cozy', 'compact']}
            onChange={v => setTweak('density', v)}
          />
        </TweakSection>

        <TweakSection label="Surface">
          <TweakRadio
            label="Tint"
            value={t.tint}
            options={['default', 'pure', 'warm', 'cool']}
            onChange={v => setTweak('tint', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
