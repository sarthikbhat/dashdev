import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import Redis from "./pages/Redis";
import WorkflowBuilder from "./pages/WorkflowBuilder";
import RunHistory from "./pages/RunHistory";
import CICD from "./pages/CICD";
import GitStatus from "./pages/GitStatus";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/services" element={<Services />} />
          <Route path="/redis" element={<Redis />} />
          <Route path="/cicd" element={<CICD />} />
          <Route path="/git" element={<GitStatus />} />
          <Route path="/workflows" element={<Dashboard />} />
          <Route path="/workflow/:id" element={<Dashboard />} />
          <Route path="/workflow/:id/edit" element={<WorkflowBuilder />} />
          <Route path="/history" element={<RunHistory />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
