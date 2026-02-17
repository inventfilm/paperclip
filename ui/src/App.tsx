import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Companies } from "./pages/Companies";
import { Org } from "./pages/Org";
import { Agents } from "./pages/Agents";
import { AgentDetail } from "./pages/AgentDetail";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Issues } from "./pages/Issues";
import { IssueDetail } from "./pages/IssueDetail";
import { Goals } from "./pages/Goals";
import { GoalDetail } from "./pages/GoalDetail";
import { Approvals } from "./pages/Approvals";
import { Costs } from "./pages/Costs";
import { Activity } from "./pages/Activity";
import { Inbox } from "./pages/Inbox";
import { MyIssues } from "./pages/MyIssues";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="org" element={<Org />} />
        <Route path="agents" element={<Agents />} />
        <Route path="agents/:agentId" element={<AgentDetail />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="tasks" element={<Issues />} />
        <Route path="issues/:issueId" element={<IssueDetail />} />
        <Route path="goals" element={<Goals />} />
        <Route path="goals/:goalId" element={<GoalDetail />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="costs" element={<Costs />} />
        <Route path="activity" element={<Activity />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="my-issues" element={<MyIssues />} />
      </Route>
    </Routes>
  );
}
