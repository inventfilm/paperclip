import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Companies } from "./pages/Companies";
import { Org } from "./pages/Org";
import { Agents } from "./pages/Agents";
import { Projects } from "./pages/Projects";
import { Issues } from "./pages/Issues";
import { Goals } from "./pages/Goals";
import { Approvals } from "./pages/Approvals";
import { Costs } from "./pages/Costs";
import { Activity } from "./pages/Activity";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="org" element={<Org />} />
        <Route path="agents" element={<Agents />} />
        <Route path="projects" element={<Projects />} />
        <Route path="tasks" element={<Issues />} />
        <Route path="goals" element={<Goals />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="costs" element={<Costs />} />
        <Route path="activity" element={<Activity />} />
      </Route>
    </Routes>
  );
}
