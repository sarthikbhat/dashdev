import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import WorkflowEditor from "./pages/WorkflowEditor";
import RunHistory from "./pages/RunHistory";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/services" element={<Services />} />
        <Route path="/workflows" element={<Dashboard />} />
        <Route path="/workflow/:id" element={<Dashboard />} />
        <Route path="/workflow/:id/edit" element={<WorkflowEditor />} />
        <Route path="/history" element={<RunHistory />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
