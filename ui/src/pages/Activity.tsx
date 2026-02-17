import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { activityApi } from "../api/activity";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { timeAgo } from "../lib/timeAgo";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History, Bot, User, Settings } from "lucide-react";

function formatAction(action: string, entityType: string, entityId: string): string {
  const actionMap: Record<string, string> = {
    "company.created": "Company created",
    "agent.created": `Agent created`,
    "agent.updated": `Agent updated`,
    "agent.paused": `Agent paused`,
    "agent.resumed": `Agent resumed`,
    "agent.terminated": `Agent terminated`,
    "agent.key_created": `API key created for agent`,
    "issue.created": `Issue created`,
    "issue.updated": `Issue updated`,
    "issue.checked_out": `Issue checked out`,
    "issue.released": `Issue released`,
    "issue.commented": `Comment added to issue`,
    "heartbeat.invoked": `Heartbeat invoked`,
    "heartbeat.completed": `Heartbeat completed`,
    "heartbeat.failed": `Heartbeat failed`,
    "approval.created": `Approval requested`,
    "approval.approved": `Approval granted`,
    "approval.rejected": `Approval rejected`,
    "project.created": `Project created`,
    "project.updated": `Project updated`,
    "goal.created": `Goal created`,
    "goal.updated": `Goal updated`,
    "cost.recorded": `Cost recorded`,
  };
  return actionMap[action] ?? `${action.replace(/[._]/g, " ")}`;
}

function actorIcon(entityType: string) {
  if (entityType === "agent") return <Bot className="h-4 w-4 text-muted-foreground" />;
  if (entityType === "company" || entityType === "approval")
    return <User className="h-4 w-4 text-muted-foreground" />;
  return <Settings className="h-4 w-4 text-muted-foreground" />;
}

function entityLink(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "issue":
      return `/issues/${entityId}`;
    case "agent":
      return `/agents/${entityId}`;
    case "project":
      return `/projects/${entityId}`;
    case "goal":
      return `/goals/${entityId}`;
    case "approval":
      return `/approvals/${entityId}`;
    default:
      return null;
  }
}

export function Activity() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setBreadcrumbs([{ label: "Activity" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={History} message="Select a company to view activity." />;
  }

  const filtered =
    data && filter !== "all"
      ? data.filter((e) => e.entityType === filter)
      : data;

  const entityTypes = data
    ? [...new Set(data.map((e) => e.entityType))].sort()
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Activity</h2>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {entityTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {filtered && filtered.length === 0 && (
        <EmptyState icon={History} message="No activity yet." />
      )}

      {filtered && filtered.length > 0 && (
        <div className="border border-border rounded-md divide-y divide-border">
          {filtered.map((event) => {
            const link = entityLink(event.entityType, event.entityId);
            return (
              <div
                key={event.id}
                className={`px-4 py-3 flex items-center justify-between gap-4 ${
                  link ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""
                }`}
                onClick={link ? () => navigate(link) : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {actorIcon(event.entityType)}
                  <span className="text-sm">
                    {formatAction(event.action, event.entityType, event.entityId)}
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {event.entityType}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono truncate">
                    {event.entityId.slice(0, 8)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {timeAgo(event.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
