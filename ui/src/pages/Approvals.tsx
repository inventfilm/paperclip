import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { approvalsApi } from "../api/approvals";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Clock, ShieldCheck } from "lucide-react";
import { Identity } from "../components/Identity";
import { typeLabel, typeIcon, defaultTypeIcon, ApprovalPayloadRenderer } from "../components/ApprovalPayload";
import type { Approval, Agent } from "@paperclip/shared";

type StatusFilter = "pending" | "all";

function statusIcon(status: string) {
  if (status === "approved") return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
  if (status === "rejected") return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  if (status === "revision_requested") return <Clock className="h-3.5 w-3.5 text-amber-400" />;
  if (status === "pending") return <Clock className="h-3.5 w-3.5 text-yellow-400" />;
  return null;
}

function ApprovalCard({
  approval,
  requesterAgent,
  onApprove,
  onReject,
  onOpen,
  isPending,
}: {
  approval: Approval;
  requesterAgent: Agent | null;
  onApprove: () => void;
  onReject: () => void;
  onOpen: () => void;
  isPending: boolean;
}) {
  const Icon = typeIcon[approval.type] ?? defaultTypeIcon;
  const label = typeLabel[approval.type] ?? approval.type;

  return (
    <div className="border border-border rounded-lg p-4 space-y-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{label}</span>
            {requesterAgent && (
              <span className="text-xs text-muted-foreground">
                requested by <Identity name={requesterAgent.name} size="sm" className="inline-flex" />
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {statusIcon(approval.status)}
          <span className="text-xs text-muted-foreground capitalize">{approval.status}</span>
          <span className="text-xs text-muted-foreground">· {timeAgo(approval.createdAt)}</span>
        </div>
      </div>

      {/* Payload */}
      <ApprovalPayloadRenderer type={approval.type} payload={approval.payload} />

      {/* Decision note */}
      {approval.decisionNote && (
        <div className="mt-3 text-xs text-muted-foreground italic border-t border-border pt-2">
          Note: {approval.decisionNote}
        </div>
      )}

      {/* Actions */}
      {(approval.status === "pending" || approval.status === "revision_requested") && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-border">
          <Button
            size="sm"
            className="bg-green-700 hover:bg-green-600 text-white"
            onClick={onApprove}
            disabled={isPending}
          >
            Approve
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onReject}
            disabled={isPending}
          >
            Reject
          </Button>
        </div>
      )}
      <div className="mt-3">
        <Button variant="ghost" size="sm" className="text-xs px-0" onClick={onOpen}>
          View details
        </Button>
      </div>
    </div>
  );
}

export function Approvals() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Approvals" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: (_approval, id) => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      navigate(`/approvals/${id}?resolved=approved`);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to approve");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to reject");
    },
  });

  const filtered = (data ?? []).filter(
    (a) => statusFilter === "all" || a.status === "pending" || a.status === "revision_requested",
  );

  const pendingCount = (data ?? []).filter(
    (a) => a.status === "pending" || a.status === "revision_requested",
  ).length;

  if (!selectedCompanyId) {
    return <p className="text-sm text-muted-foreground">Select a company first.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList variant="line">
            <TabsTrigger value="pending">
              Pending
              {pendingCount > 0 && (
                <span className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  "bg-yellow-500/20 text-yellow-500"
                )}>
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {statusFilter === "pending" ? "No pending approvals." : "No approvals yet."}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid gap-3">
          {filtered.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              requesterAgent={approval.requestedByAgentId ? (agents ?? []).find((a) => a.id === approval.requestedByAgentId) ?? null : null}
              onApprove={() => approveMutation.mutate(approval.id)}
              onReject={() => rejectMutation.mutate(approval.id)}
              onOpen={() => navigate(`/approvals/${approval.id}`)}
              isPending={approveMutation.isPending || rejectMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
