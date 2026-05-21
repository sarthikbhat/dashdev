import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Titlebar, Sidebar, StatusBar, EmptyState } from '../components';
import WorkflowDetail from '../components/WorkflowDetail';
import ParamModal from '../components/ParamModal';
import RunView from '../components/RunView';
import { useWorkflows } from '../hooks/useWorkflows';
import { useRuns } from '../hooks/useRuns';
import { useProcesses } from '../hooks/useProcesses';
import Icon from '../components/Icon';
import { triggerRun, listRuns } from '../api';

// Stable color palette for workflow glyphs
const GLYPH_COLORS = [
  'var(--dd-blue)',
  'var(--dd-green)',
  'var(--dd-amber)',
  'var(--dd-purple)',
  'var(--dd-cyan)',
  'var(--dd-red)',
];

function assignColor(index: number): string {
  return GLYPH_COLORS[index % GLYPH_COLORS.length];
}

// Empty state when no workflow is selected
function EmptyPrompt() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--dd-text-4)', userSelect: 'none' }}>
      <Icon name="dashboard" size={40} style={{ color: 'var(--dd-line-2)' }} />
      <div style={{ fontSize: 14, color: 'var(--dd-text-3)', fontWeight: 500 }}>Select a workflow</div>
      <div style={{ fontSize: 12, color: 'var(--dd-text-4)', textAlign: 'center', maxWidth: 260 }}>
        Choose a workflow from the sidebar to view details, or create a new one to get started.
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { id: workflowId } = useParams<{ id: string }>();

  const { workflows, loading: wfLoading } = useWorkflows();
  const { processes } = useProcesses();
  const { runs } = useRuns(workflowId);

  // Auto-select first workflow when navigating to /
  useEffect(() => {
    if (!workflowId && workflows.length > 0) {
      navigate(`/workflow/${workflows[0].id}`, { replace: true });
    }
  }, [workflowId, workflows, navigate]);

  const selectedWorkflow = workflowId ? workflows.find((w) => w.id === workflowId) ?? null : null;

  // ParamModal + RunView state
  const [showParamModal, setShowParamModal] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runLaunching, setRunLaunching] = useState(false);

  // Sidebar entries
  const sidebarWorkflows = workflows.map((wf, i) => ({
    id: wf.id,
    name: wf.name,
    ch: (wf.name[0] ?? 'W').toUpperCase(),
    color: assignColor(i),
    tags: wf.tags ?? [],
    running: false,
  }));

  // Active runs count (processes count as proxy)
  const activeRuns = processes.filter((p) => p.status === 'running').length;

  function handleSelect(id: string) {
    navigate(`/workflow/${id}`);
  }

  function handleCreate() {
    // Navigate to a new workflow editor — id="new" is handled by WorkflowEditor
    navigate('/workflow/new/edit');
  }

  // After triggering a run, poll for the new run ID
  async function pollForRunId(wfId: string) {
    // API returns 202 without run_id; poll until we find the newest run
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const recentRuns = await listRuns(wfId);
        // Pick the most recent run (any status — it may already be done)
        if (recentRuns.length > 0) {
          setActiveRunId(recentRuns[0].id);
          return;
        }
      } catch (e) {
        console.error('Failed to poll for run ID:', e);
      }
    }
    // If we still can't find it, stop the spinner
    setRunLaunching(false);
  }

  function launchRun(wfId: string, params?: Record<string, string>) {
    setRunLaunching(true);
    triggerRun(wfId, params)
      .then(() => pollForRunId(wfId))
      .catch(console.error);
  }

  function handleRun() {
    if (!selectedWorkflow) return;
    if (selectedWorkflow.params && selectedWorkflow.params.length > 0) {
      setShowParamModal(true);
    } else {
      launchRun(selectedWorkflow.id);
    }
  }

  function handleParamRun(values: Record<string, string>) {
    if (!selectedWorkflow) return;
    setShowParamModal(false);
    launchRun(selectedWorkflow.id, values);
  }

  function handleParamCancel() {
    setShowParamModal(false);
  }

  function handleRunBack() {
    setActiveRunId(null);
    setRunLaunching(false);
  }

  function handleRunCancel() {
    setActiveRunId(null);
    setRunLaunching(false);
  }

  // Show EmptyState welcome screen when workflows have loaded and none exist
  if (!wfLoading && workflows.length === 0) {
    return (
      <EmptyState
        processCount={processes.length}
        activeRuns={activeRuns}
      />
    );
  }

  // If ParamModal is open, render it as full-screen overlay
  if (showParamModal && selectedWorkflow) {
    const wfIcon = {
      ch: (selectedWorkflow.name[0] ?? 'W').toUpperCase(),
      color: assignColor(workflows.indexOf(selectedWorkflow)),
    };
    return (
      <ParamModal
        workflow={{
          name: selectedWorkflow.name,
          icon: wfIcon,
          params: selectedWorkflow.params ?? [],
        }}
        onRun={handleParamRun}
        onCancel={handleParamCancel}
      />
    );
  }

  // Show launching state immediately while polling for run ID
  if (runLaunching && !activeRunId && selectedWorkflow) {
    return (
      <div className="dd" style={{ width: '100%', height: '100%' }}>
        <div className="app-window">
          <Titlebar path={`${selectedWorkflow.name} · launching...`} />
          <Sidebar workflows={sidebarWorkflows} activeId={workflowId} onSelect={handleSelect} onCreate={handleCreate} />
          <main className="main" style={{ gridArea: 'main', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
            <div style={{ fontSize: 14, color: 'var(--dd-text-2)' }}>Launching workflow...</div>
            <div style={{ fontSize: 12, color: 'var(--dd-text-4)' }}>Waiting for run to start</div>
          </main>
          <StatusBar processCount={processes.length} activeRuns={activeRuns} />
        </div>
      </div>
    );
  }

  // If a run is active, render RunView
  if (activeRunId && selectedWorkflow) {
    const wfIcon = {
      ch: (selectedWorkflow.name[0] ?? 'W').toUpperCase(),
      color: assignColor(workflows.indexOf(selectedWorkflow)),
    };
    return (
      <RunView
        runId={activeRunId}
        workflowName={selectedWorkflow.name}
        workflowIcon={wfIcon}
        onCancel={handleRunCancel}
        onBack={handleRunBack}
      />
    );
  }

  return (
    <div className="dd" style={{ width: '100%', height: '100%' }}>
      <div className="app-window">
        <Titlebar path={selectedWorkflow?.name ?? 'Dashboard'} />

        <Sidebar
          workflows={sidebarWorkflows}
          activeId={workflowId}
          onSelect={handleSelect}
          onCreate={handleCreate}
        />

        <main className="main" style={{ gridArea: 'main', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {wfLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--dd-text-4)', fontSize: 13 }}>
              Loading workflows…
            </div>
          ) : selectedWorkflow ? (
            <WorkflowDetail
              workflow={selectedWorkflow}
              runs={runs}
              glyphColor={assignColor(workflows.indexOf(selectedWorkflow))}
              onRun={handleRun}
            />
          ) : (
            <EmptyPrompt />
          )}
        </main>

        <StatusBar
          processCount={processes.length}
          activeRuns={activeRuns}
        />
      </div>
    </div>
  );
}
