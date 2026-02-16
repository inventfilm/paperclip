export const API_PREFIX = "/api";

export const API = {
  health: `${API_PREFIX}/health`,
  agents: `${API_PREFIX}/agents`,
  projects: `${API_PREFIX}/projects`,
  issues: `${API_PREFIX}/issues`,
  goals: `${API_PREFIX}/goals`,
  activity: `${API_PREFIX}/activity`,
} as const;
