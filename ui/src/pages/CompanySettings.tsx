import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { companiesApi } from "../api/companies";
import { accessApi } from "../api/access";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

export function CompanySettings() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [joinType, setJoinType] = useState<"human" | "agent" | "both">("both");
  const [expiresInHours, setExpiresInHours] = useState(72);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const settingsMutation = useMutation({
    mutationFn: (requireApproval: boolean) =>
      companiesApi.update(selectedCompanyId!, {
        requireBoardApprovalForNewAgents: requireApproval,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      accessApi.createCompanyInvite(selectedCompanyId!, {
        allowedJoinTypes: joinType,
        expiresInHours,
      }),
    onSuccess: (invite) => {
      setInviteError(null);
      const base = window.location.origin.replace(/\/+$/, "");
      const absoluteUrl = invite.inviteUrl.startsWith("http")
        ? invite.inviteUrl
        : `${base}${invite.inviteUrl}`;
      setInviteLink(absoluteUrl);
      queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId!) });
    },
    onError: (err) => {
      setInviteError(err instanceof Error ? err.message : "Failed to create invite");
    },
  });

  const inviteExpiryHint = useMemo(() => {
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    return expiresAt.toLocaleString();
  }, [expiresInHours]);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: "Settings" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  if (!selectedCompany) {
    return (
      <div className="text-sm text-muted-foreground">
        No company selected. Select a company from the switcher above.
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Company Settings</h1>
      </div>

      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Hiring
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3">
          <div>
            <div className="text-sm font-medium">
              Require board approval for new hires
            </div>
            <div className="text-xs text-muted-foreground">
              New agent hires stay pending until approved by board.
            </div>
          </div>
          <Button
            size="sm"
            variant={
              selectedCompany.requireBoardApprovalForNewAgents
                ? "default"
                : "outline"
            }
            onClick={() =>
              settingsMutation.mutate(
                !selectedCompany.requireBoardApprovalForNewAgents,
              )
            }
            disabled={settingsMutation.isPending}
          >
            {selectedCompany.requireBoardApprovalForNewAgents ? "On" : "Off"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Invites
        </div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Allowed join type</span>
              <select
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                value={joinType}
                onChange={(event) => setJoinType(event.target.value as "human" | "agent" | "both")}
              >
                <option value="both">Human or agent</option>
                <option value="human">Human only</option>
                <option value="agent">Agent only</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Expires in hours</span>
              <input
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                type="number"
                min={1}
                max={720}
                value={expiresInHours}
                onChange={(event) => setExpiresInHours(Math.max(1, Math.min(720, Number(event.target.value) || 72)))}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">Invite will expire around {inviteExpiryHint}.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? "Creating..." : "Create invite link"}
            </Button>
            {inviteLink && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteLink);
                }}
              >
                Copy link
              </Button>
            )}
          </div>
          {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
          {inviteLink && (
            <div className="rounded-md border border-border bg-muted/30 p-2">
              <div className="text-xs text-muted-foreground">Share link</div>
              <div className="mt-1 break-all font-mono text-xs">{inviteLink}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
