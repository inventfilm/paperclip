import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Companies } from "./pages/Companies";
import { Agents } from "./pages/Agents";
import { AgentDetail } from "./pages/AgentDetail";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Issues } from "./pages/Issues";
import { IssueDetail } from "./pages/IssueDetail";
import { Goals } from "./pages/Goals";
import { GoalDetail } from "./pages/GoalDetail";
import { Approvals } from "./pages/Approvals";
import { ApprovalDetail } from "./pages/ApprovalDetail";
import { Costs } from "./pages/Costs";
import { Activity } from "./pages/Activity";
import { Inbox } from "./pages/Inbox";
import { CompanySettings } from "./pages/CompanySettings";
import { DesignGuide } from "./pages/DesignGuide";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="company/settings" element={<CompanySettings />} />
        <Route path="org" element={<Navigate to="/agents/all" replace />} />
        <Route path="agents" element={<Navigate to="/agents/all" replace />} />
        <Route path="agents/all" element={<Agents />} />
        <Route path="agents/active" element={<Agents />} />
        <Route path="agents/paused" element={<Agents />} />
        <Route path="agents/error" element={<Agents />} />
        <Route path="agents/:agentId" element={<AgentDetail />} />
        <Route path="agents/:agentId/:tab" element={<AgentDetail />} />
        <Route path="agents/:agentId/runs/:runId" element={<AgentDetail />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="issues" element={<Navigate to="/issues/active" replace />} />
        <Route path="issues/all" element={<Issues />} />
        <Route path="issues/active" element={<Issues />} />
        <Route path="issues/backlog" element={<Issues />} />
        <Route path="issues/done" element={<Issues />} />
        <Route path="issues/:issueId" element={<IssueDetail />} />
        <Route path="goals" element={<Goals />} />
        <Route path="goals/:goalId" element={<GoalDetail />} />
        <Route path="approvals" element={<Navigate to="/approvals/pending" replace />} />
        <Route path="approvals/pending" element={<Approvals />} />
        <Route path="approvals/all" element={<Approvals />} />
        <Route path="approvals/:approvalId" element={<ApprovalDetail />} />
        <Route path="costs" element={<Costs />} />
        <Route path="activity" element={<Activity />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="design-guide" element={<DesignGuide />} />
      </Route>
    </Routes>
  );
}
