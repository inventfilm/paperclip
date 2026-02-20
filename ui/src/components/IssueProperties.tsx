import { useState } from "react";
import { Link } from "react-router-dom";
import type { Issue } from "@paperclip/shared";
import { useQuery } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { StatusIcon } from "./StatusIcon";
import { PriorityIcon } from "./PriorityIcon";
import { Identity } from "./Identity";
import { formatDate, cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { User, Hexagon, ArrowUpRight } from "lucide-react";

interface IssuePropertiesProps {
  issue: Issue;
  onUpdate: (data: Record<string, unknown>) => void;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0 w-20">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">{children}</div>
    </div>
  );
}

export function IssueProperties({ issue, onUpdate }: IssuePropertiesProps) {
  const { selectedCompanyId } = useCompany();
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    const agent = agents.find((a) => a.id === id);
    return agent?.name ?? id.slice(0, 8);
  };

  const projectName = (id: string | null) => {
    if (!id || !projects) return id?.slice(0, 8) ?? "None";
    const project = projects.find((p) => p.id === id);
    return project?.name ?? id.slice(0, 8);
  };

  const assignee = issue.assigneeAgentId
    ? agents?.find((a) => a.id === issue.assigneeAgentId)
    : null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <PropertyRow label="Status">
          <StatusIcon
            status={issue.status}
            onChange={(status) => onUpdate({ status })}
            showLabel
          />
        </PropertyRow>

        <PropertyRow label="Priority">
          <PriorityIcon
            priority={issue.priority}
            onChange={(priority) => onUpdate({ priority })}
            showLabel
          />
        </PropertyRow>

        <PropertyRow label="Assignee">
          <Popover open={assigneeOpen} onOpenChange={(open) => { setAssigneeOpen(open); if (!open) setAssigneeSearch(""); }}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 transition-colors">
                {assignee ? (
                  <Identity name={assignee.name} size="sm" />
                ) : (
                  <>
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1" align="end">
              <input
                className="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
                placeholder="Search agents..."
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
                autoFocus
              />
              <button
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                  !issue.assigneeAgentId && "bg-accent"
                )}
                onClick={() => { onUpdate({ assigneeAgentId: null }); setAssigneeOpen(false); }}
              >
                No assignee
              </button>
              {(agents ?? [])
                .filter((a) => a.status !== "terminated")
                .filter((a) => {
                  if (!assigneeSearch.trim()) return true;
                  const q = assigneeSearch.toLowerCase();
                  return a.name.toLowerCase().includes(q);
                })
                .map((a) => (
                <button
                  key={a.id}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    a.id === issue.assigneeAgentId && "bg-accent"
                  )}
                  onClick={() => { onUpdate({ assigneeAgentId: a.id }); setAssigneeOpen(false); }}
                >
                  {a.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          {issue.assigneeAgentId && (
            <Link
              to={`/agents/${issue.assigneeAgentId}`}
              className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </PropertyRow>

        <PropertyRow label="Project">
          <Popover open={projectOpen} onOpenChange={(open) => { setProjectOpen(open); if (!open) setProjectSearch(""); }}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 transition-colors">
                {issue.projectId ? (
                  <span className="text-sm">{projectName(issue.projectId)}</span>
                ) : (
                  <>
                    <Hexagon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">No project</span>
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1" align="end">
              <input
                className="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
                placeholder="Search projects..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                autoFocus
              />
              <button
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                  !issue.projectId && "bg-accent"
                )}
                onClick={() => { onUpdate({ projectId: null }); setProjectOpen(false); }}
              >
                No project
              </button>
              {(projects ?? [])
                .filter((p) => {
                  if (!projectSearch.trim()) return true;
                  const q = projectSearch.toLowerCase();
                  return p.name.toLowerCase().includes(q);
                })
                .map((p) => (
                <button
                  key={p.id}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    p.id === issue.projectId && "bg-accent"
                  )}
                  onClick={() => { onUpdate({ projectId: p.id }); setProjectOpen(false); }}
                >
                  {p.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          {issue.projectId && (
            <Link
              to={`/projects/${issue.projectId}`}
              className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </PropertyRow>

        {issue.parentId && (
          <PropertyRow label="Parent">
            <Link
              to={`/issues/${issue.parentId}`}
              className="text-sm hover:underline"
            >
              {issue.ancestors?.[0]?.title ?? issue.parentId.slice(0, 8)}
            </Link>
          </PropertyRow>
        )}

        {issue.requestDepth > 0 && (
          <PropertyRow label="Depth">
            <span className="text-sm font-mono">{issue.requestDepth}</span>
          </PropertyRow>
        )}
      </div>

      <Separator />

      <div className="space-y-1">
        {issue.startedAt && (
          <PropertyRow label="Started">
            <span className="text-sm">{formatDate(issue.startedAt)}</span>
          </PropertyRow>
        )}
        {issue.completedAt && (
          <PropertyRow label="Completed">
            <span className="text-sm">{formatDate(issue.completedAt)}</span>
          </PropertyRow>
        )}
        <PropertyRow label="Created">
          <span className="text-sm">{formatDate(issue.createdAt)}</span>
        </PropertyRow>
        <PropertyRow label="Updated">
          <span className="text-sm">{timeAgo(issue.updatedAt)}</span>
        </PropertyRow>
      </div>
    </div>
  );
}
