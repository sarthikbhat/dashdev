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
import { triggerRun } from '../api';

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
  const { runs, refresh: refreshRuns } = useRuns(workflowId);

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
    // When switching workflows, close any active run view
    setActiveRunId(null);
    navigate(`/workflow/${id}`);
  }

  function handleCreate() {
    navigate('/workflow/new/edit');
  }

  // Launch a run: call the API which now returns run_id synchronously
  async function launchRun(wfId: string, params?: Record<string, string>) {
    try {
      const result = await triggerRun(wfId, params);
      setActiveRunId(result.run_id);
    } catch (e) {
      console.error('Failed to trigger run:', e);
    }
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
    refreshRuns();
  }

  function handleRunCancel() {
    setActiveRunId(null);
    refreshRuns();
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

  // Determine titlebar path
  let titlePath = selectedWorkflow?.name ?? 'Dashboard';
  if (activeRunId && selectedWorkflow) {
    titlePath = `${selectedWorkflow.name} · run #${activeRunId.slice(0, 6)}`;
  }

  return (
    <div className="dd" style={{ width: '100%', height: '100%' }}>
      <div className="app-window">
        <Titlebar path={titlePath} />

        <Sidebar
          workflows={sidebarWorkflows}
          activeId={workflowId}
          onSelect={handleSelect}
          onCreate={handleCreate}
        />

        <main className="main" style={{ gridArea: 'main', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {wfLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--dd-text-4)', fontSize: 13 }}>
              Loading workflows...
            </div>
          ) : activeRunId && selectedWorkflow ? (
            <RunView
              runId={activeRunId}
              workflowName={selectedWorkflow.name}
              workflowIcon={{
                ch: (selectedWorkflow.name[0] ?? 'W').toUpperCase(),
                color: assignColor(workflows.indexOf(selectedWorkflow)),
              }}
              onCancel={handleRunCancel}
              onBack={handleRunBack}
            />
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

      {/* ParamModal renders as a true overlay ON TOP of the whole dashboard */}
      {showParamModal && selectedWorkflow && (
        <ParamModal
          workflow={{
            name: selectedWorkflow.name,
            icon: {
              ch: (selectedWorkflow.name[0] ?? 'W').toUpperCase(),
              color: assignColor(workflows.indexOf(selectedWorkflow)),
            },
            params: selectedWorkflow.params ?? [],
          }}
          onRun={handleParamRun}
          onCancel={handleParamCancel}
        />
      )}
    </div>
  );
}
