import type {
  HeartbeatInvocationSource,
  HeartbeatRunStatus,
} from "../constants.js";

export interface HeartbeatRun {
  id: string;
  companyId: string;
  agentId: string;
  invocationSource: HeartbeatInvocationSource;
  status: HeartbeatRunStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
  externalRunId: string | null;
  contextSnapshot: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
