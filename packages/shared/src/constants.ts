export const AGENT_STATUSES = ["active", "idle", "offline", "error"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const AGENT_ROLES = [
  "engineer",
  "designer",
  "pm",
  "qa",
  "devops",
  "general",
] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export const ISSUE_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_PRIORITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const GOAL_LEVELS = ["company", "team", "agent", "task"] as const;
export type GoalLevel = (typeof GOAL_LEVELS)[number];
