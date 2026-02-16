import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Agents } from "./pages/Agents";
import { Projects } from "./pages/Projects";
import { Issues } from "./pages/Issues";
import { Goals } from "./pages/Goals";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="agents" element={<Agents />} />
        <Route path="projects" element={<Projects />} />
        <Route path="issues" element={<Issues />} />
        <Route path="goals" element={<Goals />} />
      </Route>
    </Routes>
  );
}
