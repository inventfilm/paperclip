import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const mockIssueService = vi.hoisted(() => ({
  getLabelById: vi.fn(),
  deleteLabel: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  accessService: () => ({
    canUser: vi.fn(),
    hasPermission: vi.fn(),
  }),
  agentService: () => ({
    getById: vi.fn(),
  }),
  documentService: () => ({}),
  executionWorkspaceService: () => ({}),
  goalService: () => ({}),
  heartbeatService: () => ({
    wakeup: vi.fn(async () => undefined),
    reportRunActivity: vi.fn(async () => undefined),
  }),
  issueApprovalService: () => ({}),
  issueService: () => mockIssueService,
  logActivity: vi.fn(async () => undefined),
  projectService: () => ({}),
  routineService: () => ({
    syncRunStatusForIssue: vi.fn(async () => undefined),
  }),
  workProductService: () => ({}),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "local-board",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

describe("issue label route validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssueService.getLabelById.mockResolvedValue(null);
    mockIssueService.deleteLabel.mockResolvedValue(null);
  });

  it("returns 400 for malformed label ids instead of querying the DB", async () => {
    const res = await request(createApp()).delete("/api/labels/not-a-uuid");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid labelId");
    expect(mockIssueService.getLabelById).not.toHaveBeenCalled();
    expect(mockIssueService.deleteLabel).not.toHaveBeenCalled();
  });
});
