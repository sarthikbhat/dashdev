import { useParams } from "react-router-dom";

export default function WorkflowEditor() {
  const { id } = useParams<{ id: string }>();
  return (
    <div style={{ padding: "24px" }}>
      <h2 style={{ color: "var(--dd-text)", marginBottom: "8px" }}>Workflow Editor</h2>
      <p style={{ color: "var(--dd-text-2)" }}>Editing workflow: {id}</p>
    </div>
  );
}
