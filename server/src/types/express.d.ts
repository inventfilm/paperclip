export {};

declare global {
  namespace Express {
    interface Request {
      actor: {
        type: "board" | "agent";
        userId?: string;
        agentId?: string;
        companyId?: string;
        keyId?: string;
        runId?: string;
      };
    }
  }
}
