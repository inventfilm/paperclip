import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { groupBy } from "../lib/groupBy";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { EntityRow } from "../components/EntityRow";
import { EmptyState } from "../components/EmptyState";
import { PageTabBar } from "../components/PageTabBar";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { CircleDot, Plus } from "lucide-react";
import { formatDate } from "../lib/utils";
import type { Issue } from "@paperclip/shared";

const statusOrder = ["in_progress", "todo", "backlog", "in_review", "blocked", "done", "cancelled"];

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type TabFilter = "all" | "active" | "backlog" | "done";

const issueTabItems = [
  { value: "all", label: "All Issues" },
  { value: "active", label: "Active" },
  { value: "backlog", label: "Backlog" },
  { value: "done", label: "Done" },
] as const;

function parseIssueTab(value: string | null): TabFilter {
  if (value === "active" || value === "backlog" || value === "done") return value;
  return "all";
}

function filterIssues(issues: Issue[], tab: TabFilter): Issue[] {
  switch (tab) {
    case "active":
      return issues.filter((i) => ["todo", "in_progress", "in_review", "blocked"].includes(i.status));
    case "backlog":
      return issues.filter((i) => i.status === "backlog");
    case "done":
      return issues.filter((i) => ["done", "cancelled"].includes(i.status));
    default:
      return issues;
  }
}

export function Issues() {
  const { selectedCompanyId } = useCompany();
  const { openNewIssue } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseIssueTab(searchParams.get("tab"));

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Issues" }]);
  }, [setBreadcrumbs]);

  const { data: issues, isLoading, error } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      issuesApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    },
  });

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  if (!selectedCompanyId) {
    return <EmptyState icon={CircleDot} message="Select a company to view issues." />;
  }

  const filtered = filterIssues(issues ?? [], tab);
  const grouped = groupBy(filtered, (i) => i.status);
  const orderedGroups = statusOrder
    .filter((s) => grouped[s]?.length)
    .map((s) => ({ status: s, items: grouped[s]! }));

  const setTab = (nextTab: TabFilter) => {
    const next = new URLSearchParams(searchParams);
    if (nextTab === "all") next.delete("tab");
    else next.set("tab", nextTab);
    setSearchParams(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
          <PageTabBar items={[...issueTabItems]} />
        </Tabs>
        <Button size="sm" onClick={() => openNewIssue()}>
          <Plus className="h-4 w-4 mr-1" />
          New Issue
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {issues && filtered.length === 0 && (
        <EmptyState
          icon={CircleDot}
          message="No issues found."
          action="Create Issue"
          onAction={() => openNewIssue()}
        />
      )}

      {orderedGroups.map(({ status, items }) => (
        <div key={status}>
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50">
            <StatusIcon status={status} />
            <span className="text-xs font-semibold uppercase tracking-wide">
              {statusLabel(status)}
            </span>
            <span className="text-xs text-muted-foreground">{items.length}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="ml-auto text-muted-foreground"
              onClick={() => openNewIssue({ status })}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="border border-border">
            {items.map((issue) => (
              <EntityRow
                key={issue.id}
                identifier={issue.id.slice(0, 8)}
                title={issue.title}
                onClick={() => navigate(`/issues/${issue.id}`)}
                leading={
                  <>
                    <PriorityIcon priority={issue.priority} />
                    <StatusIcon
                      status={issue.status}
                      onChange={(s) => updateStatus.mutate({ id: issue.id, status: s })}
                    />
                  </>
                }
                trailing={
                  <div className="flex items-center gap-3">
                    {issue.assigneeAgentId && (
                      <span className="text-xs text-muted-foreground">
                        {agentName(issue.assigneeAgentId) ?? issue.assigneeAgentId.slice(0, 8)}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(issue.createdAt)}
                    </span>
                  </div>
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
