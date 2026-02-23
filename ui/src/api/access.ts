import type { JoinRequest } from "@paperclip/shared";
import { api } from "./client";

type InviteSummary = {
  id: string;
  companyId: string | null;
  inviteType: "company_join" | "bootstrap_ceo";
  allowedJoinTypes: "human" | "agent" | "both";
  expiresAt: string;
};

type AcceptInviteInput =
  | { requestType: "human" }
  | {
    requestType: "agent";
    agentName: string;
    adapterType?: string;
    capabilities?: string | null;
    agentDefaultsPayload?: Record<string, unknown> | null;
  };

export const accessApi = {
  createCompanyInvite: (
    companyId: string,
    input: {
      allowedJoinTypes?: "human" | "agent" | "both";
      expiresInHours?: number;
      defaultsPayload?: Record<string, unknown> | null;
    } = {},
  ) =>
    api.post<{
      id: string;
      token: string;
      inviteUrl: string;
      expiresAt: string;
      allowedJoinTypes: "human" | "agent" | "both";
    }>(`/companies/${companyId}/invites`, input),

  getInvite: (token: string) => api.get<InviteSummary>(`/invites/${token}`),

  acceptInvite: (token: string, input: AcceptInviteInput) =>
    api.post<JoinRequest | { bootstrapAccepted: true; userId: string }>(`/invites/${token}/accept`, input),

  listJoinRequests: (companyId: string, status: "pending_approval" | "approved" | "rejected" = "pending_approval") =>
    api.get<JoinRequest[]>(`/companies/${companyId}/join-requests?status=${status}`),

  approveJoinRequest: (companyId: string, requestId: string) =>
    api.post<JoinRequest>(`/companies/${companyId}/join-requests/${requestId}/approve`, {}),

  rejectJoinRequest: (companyId: string, requestId: string) =>
    api.post<JoinRequest>(`/companies/${companyId}/join-requests/${requestId}/reject`, {}),
};
