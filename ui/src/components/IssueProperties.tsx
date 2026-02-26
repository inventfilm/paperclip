import { useState } from "react";
import { Link } from "react-router-dom";
import type { Issue } from "@paperclip/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
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
import { User, Hexagon, ArrowUpRight, Tag, Plus, Trash2 } from "lucide-react";
import { AgentIcon } from "./AgentIconPicker";

interface IssuePropertiesProps {
  issue: Issue;
  onUpdate: (data: Record<string, unknown>) => void;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0 w-20">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function IssueProperties({ issue, onUpdate }: IssuePropertiesProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const companyId = issue.companyId ?? selectedCompanyId;
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6366f1");

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId!),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(companyId!),
    queryFn: () => projectsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: labels } = useQuery({
    queryKey: queryKeys.issues.labels(companyId!),
    queryFn: () => issuesApi.listLabels(companyId!),
    enabled: !!companyId,
  });

  const createLabel = useMutation({
    mutationFn: (data: { name: string; color: string }) => issuesApi.createLabel(companyId!, data),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.issues.labels(companyId!) });
      onUpdate({ labelIds: [...(issue.labelIds ?? []), created.id] });
      setNewLabelName("");
    },
  });

  const deleteLabel = useMutation({
    mutationFn: (labelId: string) => issuesApi.deleteLabel(labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.labels(companyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(companyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(issue.id) });
    },
  });

  const toggleLabel = (labelId: string) => {
    const ids = issue.labelIds ?? [];
    const next = ids.includes(labelId)
      ? ids.filter((id) => id !== labelId)
      : [...ids, labelId];
    onUpdate({ labelIds: next });
  };

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

        <PropertyRow label="Labels">
          <Popover open={labelsOpen} onOpenChange={(open) => { setLabelsOpen(open); if (!open) setLabelSearch(""); }}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 transition-colors min-w-0 max-w-full">
                {(issue.labels ?? []).length > 0 ? (
                  <div className="flex items-center gap-1 flex-wrap">
                    {(issue.labels ?? []).slice(0, 3).map((label) => (
                      <span
                        key={label.id}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border"
                        style={{
                          borderColor: label.color,
                          backgroundColor: `${label.color}22`,
                          color: label.color,
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                    {(issue.labels ?? []).length > 3 && (
                      <span className="text-xs text-muted-foreground">+{(issue.labels ?? []).length - 3}</span>
                    )}
                  </div>
                ) : (
                  <>
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">No labels</span>
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-1" align="end" collisionPadding={16}>
              <input
                className="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
                placeholder="Search labels..."
                value={labelSearch}
                onChange={(e) => setLabelSearch(e.target.value)}
                autoFocus
              />
              <div className="max-h-44 overflow-y-auto overscroll-contain space-y-0.5">
                {(labels ?? [])
                  .filter((label) => {
                    if (!labelSearch.trim()) return true;
                    return label.name.toLowerCase().includes(labelSearch.toLowerCase());
                  })
                  .map((label) => {
                    const selected = (issue.labelIds ?? []).includes(label.id);
                    return (
                      <div key={label.id} className="flex items-center gap-1">
                        <button
                          className={cn(
                            "flex items-center gap-2 flex-1 px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-left",
                            selected && "bg-accent"
                          )}
                          onClick={() => toggleLabel(label.id)}
                        >
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                          <span className="truncate">{label.name}</span>
                        </button>
                        <button
                          type="button"
                          className="p-1 text-muted-foreground hover:text-destructive rounded"
                          onClick={() => deleteLabel.mutate(label.id)}
                          title={`Delete ${label.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
              </div>
              <div className="mt-2 border-t border-border pt-2 space-y-1">
                <div className="flex items-center gap-1">
                  <input
                    className="h-7 w-7 p-0 rounded bg-transparent"
                    type="color"
                    value={newLabelColor}
                    onChange={(e) => setNewLabelColor(e.target.value)}
                  />
                  <input
                    className="flex-1 px-2 py-1.5 text-xs bg-transparent outline-none rounded placeholder:text-muted-foreground/50"
                    placeholder="New label"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                  />
                </div>
                <button
                  className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 text-xs rounded border border-border hover:bg-accent/50 disabled:opacity-50"
                  disabled={!newLabelName.trim() || createLabel.isPending}
                  onClick={() =>
                    createLabel.mutate({
                      name: newLabelName.trim(),
                      color: newLabelColor,
                    })
                  }
                >
                  <Plus className="h-3 w-3" />
                  {createLabel.isPending ? "Creating..." : "Create label"}
                </button>
              </div>
            </PopoverContent>
          </Popover>
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
            <PopoverContent className="w-52 p-1" align="end" collisionPadding={16}>
              <input
                className="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
                placeholder="Search agents..."
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
                autoFocus
              />
              <div className="max-h-48 overflow-y-auto overscroll-contain">
                <button
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    !issue.assigneeAgentId && !issue.assigneeUserId && "bg-accent"
                  )}
                  onClick={() => { onUpdate({ assigneeAgentId: null, assigneeUserId: null }); setAssigneeOpen(false); }}
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
                    onClick={() => { onUpdate({ assigneeAgentId: a.id, assigneeUserId: null }); setAssigneeOpen(false); }}
                  >
                    <AgentIcon icon={a.icon} className="shrink-0 h-3 w-3 text-muted-foreground" />
                    {a.name}
                  </button>
                ))}
              </div>
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
              <button className="inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 transition-colors min-w-0 max-w-full">
                {issue.projectId ? (
                  <>
                    <span
                      className="shrink-0 h-3 w-3 rounded-sm"
                      style={{ backgroundColor: projects?.find((p) => p.id === issue.projectId)?.color ?? "#6366f1" }}
                    />
                    <span className="text-sm truncate">{projectName(issue.projectId)}</span>
                  </>
                ) : (
                  <>
                    <Hexagon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">No project</span>
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-fit min-w-[11rem] p-1" align="end" collisionPadding={16}>
              <input
                className="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
                placeholder="Search projects..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                autoFocus
              />
              <div className="max-h-48 overflow-y-auto overscroll-contain">
                <button
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 whitespace-nowrap",
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
                      "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 whitespace-nowrap",
                      p.id === issue.projectId && "bg-accent"
                    )}
                    onClick={() => { onUpdate({ projectId: p.id }); setProjectOpen(false); }}
                  >
                    <span
                      className="shrink-0 h-3 w-3 rounded-sm"
                      style={{ backgroundColor: p.color ?? "#6366f1" }}
                    />
                    {p.name}
                  </button>
                ))}
              </div>
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
              to={`/issues/${issue.ancestors?.[0]?.identifier ?? issue.parentId}`}
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
