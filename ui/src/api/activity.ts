import type { ActivityEvent } from "@paperclip/shared";
import { api } from "./client";

export interface RunForIssue {
  runId: string;
  status: string;
  agentId: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  invocationSource: string;
}

export interface IssueForRun {
  issueId: string;
  title: string;
  status: string;
  priority: string;
}

export const activityApi = {
  list: (companyId: string) => api.get<ActivityEvent[]>(`/companies/${companyId}/activity`),
  forIssue: (issueId: string) => api.get<ActivityEvent[]>(`/issues/${issueId}/activity`),
  runsForIssue: (issueId: string) => api.get<RunForIssue[]>(`/issues/${issueId}/runs`),
  issuesForRun: (runId: string) => api.get<IssueForRun[]>(`/heartbeat-runs/${runId}/issues`),
};
