import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@paperclip/shared";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "../lib/utils";
import { goalsApi } from "../api/goals";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Star, Trash2, X } from "lucide-react";

interface ProjectPropertiesProps {
  project: Project;
  onUpdate?: (data: Record<string, unknown>) => void;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0 w-20">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">{children}</div>
    </div>
  );
}

export function ProjectProperties({ project, onUpdate }: ProjectPropertiesProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [goalOpen, setGoalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceCwd, setWorkspaceCwd] = useState("");
  const [workspaceRepoUrl, setWorkspaceRepoUrl] = useState("");

  const { data: allGoals } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const linkedGoalIds = project.goalIds.length > 0
    ? project.goalIds
    : project.goalId
      ? [project.goalId]
      : [];

  const linkedGoals = project.goals.length > 0
    ? project.goals
    : linkedGoalIds.map((id) => ({
        id,
        title: allGoals?.find((g) => g.id === id)?.title ?? id.slice(0, 8),
      }));

  const availableGoals = (allGoals ?? []).filter((g) => !linkedGoalIds.includes(g.id));
  const workspaces = project.workspaces ?? [];

  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) });
    if (selectedCompanyId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(selectedCompanyId) });
    }
  };

  const createWorkspace = useMutation({
    mutationFn: (data: Record<string, unknown>) => projectsApi.createWorkspace(project.id, data),
    onSuccess: () => {
      setWorkspaceName("");
      setWorkspaceCwd("");
      setWorkspaceRepoUrl("");
      invalidateProject();
    },
  });

  const updateWorkspace = useMutation({
    mutationFn: (input: { workspaceId: string; data: Record<string, unknown> }) =>
      projectsApi.updateWorkspace(project.id, input.workspaceId, input.data),
    onSuccess: invalidateProject,
  });

  const removeWorkspace = useMutation({
    mutationFn: (workspaceId: string) => projectsApi.removeWorkspace(project.id, workspaceId),
    onSuccess: invalidateProject,
  });

  const removeGoal = (goalId: string) => {
    if (!onUpdate) return;
    onUpdate({ goalIds: linkedGoalIds.filter((id) => id !== goalId) });
  };

  const addGoal = (goalId: string) => {
    if (!onUpdate || linkedGoalIds.includes(goalId)) return;
    onUpdate({ goalIds: [...linkedGoalIds, goalId] });
    setGoalOpen(false);
  };

  const submitWorkspace = () => {
    if (!workspaceName.trim() || !workspaceCwd.trim()) return;
    createWorkspace.mutate({
      name: workspaceName.trim(),
      cwd: workspaceCwd.trim(),
      repoUrl: workspaceRepoUrl.trim() || null,
      isPrimary: workspaces.length === 0,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <PropertyRow label="Status">
          <StatusBadge status={project.status} />
        </PropertyRow>
        {project.leadAgentId && (
          <PropertyRow label="Lead">
            <span className="text-sm font-mono">{project.leadAgentId.slice(0, 8)}</span>
          </PropertyRow>
        )}
        <div className="py-1.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs text-muted-foreground">Goals</span>
            <div className="flex flex-col items-end gap-1.5">
              {linkedGoals.length === 0 ? (
                <span className="text-sm text-muted-foreground">None</span>
              ) : (
                <div className="flex flex-wrap justify-end gap-1.5 max-w-[220px]">
                  {linkedGoals.map((goal) => (
                    <span
                      key={goal.id}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
                    >
                      <Link to={`/goals/${goal.id}`} className="hover:underline max-w-[140px] truncate">
                        {goal.title}
                      </Link>
                      {onUpdate && (
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          type="button"
                          onClick={() => removeGoal(goal.id)}
                          aria-label={`Remove goal ${goal.title}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {onUpdate && (
                <Popover open={goalOpen} onOpenChange={setGoalOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="xs"
                      className="h-6 px-2"
                      disabled={availableGoals.length === 0}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Goal
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1" align="end">
                    {availableGoals.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        All goals linked.
                      </div>
                    ) : (
                      availableGoals.map((goal) => (
                        <button
                          key={goal.id}
                          className="flex items-center w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                          onClick={() => addGoal(goal.id)}
                        >
                          {goal.title}
                        </button>
                      ))
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </div>
        {project.targetDate && (
          <PropertyRow label="Target Date">
            <span className="text-sm">{formatDate(project.targetDate)}</span>
          </PropertyRow>
        )}
      </div>

      <Separator />

      <div className="space-y-1">
        <div className="py-1.5 space-y-2">
          <div className="text-xs text-muted-foreground">Workspaces</div>
          {workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">No project workspaces configured.</p>
          ) : (
            <div className="space-y-2">
              {workspaces.map((workspace) => (
                <div key={workspace.id} className="rounded-md border border-border p-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{workspace.name}</span>
                    <div className="flex items-center gap-1">
                      {workspace.isPrimary ? (
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border border-border text-muted-foreground">
                          <Star className="h-2.5 w-2.5" />
                          Primary
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="xs"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={() => updateWorkspace.mutate({ workspaceId: workspace.id, data: { isPrimary: true } })}
                        >
                          Set primary
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeWorkspace.mutate(workspace.id)}
                        aria-label={`Delete workspace ${workspace.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground break-all">{workspace.cwd}</p>
                  {workspace.repoUrl && (
                    <p className="text-xs text-muted-foreground truncate">{workspace.repoUrl}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1.5 rounded-md border border-border p-2">
            <input
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs outline-none"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Workspace name"
            />
            <input
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
              value={workspaceCwd}
              onChange={(e) => setWorkspaceCwd(e.target.value)}
              placeholder="/absolute/path/to/workspace"
            />
            <input
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs outline-none"
              value={workspaceRepoUrl}
              onChange={(e) => setWorkspaceRepoUrl(e.target.value)}
              placeholder="Repo URL (optional)"
            />
            <Button
              variant="outline"
              size="xs"
              className="h-6 px-2"
              disabled={!workspaceName.trim() || !workspaceCwd.trim() || createWorkspace.isPending}
              onClick={submitWorkspace}
            >
              Add workspace
            </Button>
          </div>
        </div>

        <Separator />

        <PropertyRow label="Created">
          <span className="text-sm">{formatDate(project.createdAt)}</span>
        </PropertyRow>
        <PropertyRow label="Updated">
          <span className="text-sm">{formatDate(project.updatedAt)}</span>
        </PropertyRow>
      </div>
    </div>
  );
}
