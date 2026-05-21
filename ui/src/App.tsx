import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import WorkflowEditor from "./pages/WorkflowEditor";
import RunHistory from "./pages/RunHistory";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/workflow/:id" element={<Dashboard />} />
        <Route path="/workflow/:id/edit" element={<WorkflowEditor />} />
        <Route path="/history" element={<RunHistory />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
