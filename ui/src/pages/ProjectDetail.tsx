import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PROJECT_COLORS } from "@paperclip/shared";
import { projectsApi } from "../api/projects";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { assetsApi } from "../api/assets";
import { usePanel } from "../context/PanelContext";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ProjectProperties } from "../components/ProjectProperties";
import { InlineEditor } from "../components/InlineEditor";
import { StatusBadge } from "../components/StatusBadge";
import { IssuesList } from "../components/IssuesList";

/* ── Top-level tab types ── */

type ProjectTab = "overview" | "list";

function resolveProjectTab(pathname: string, projectId: string): ProjectTab | null {
  const prefix = `/projects/${projectId}`;
  if (pathname === `${prefix}/overview`) return "overview";
  if (pathname.startsWith(`${prefix}/issues`)) return "list";
  return null;
}

/* ── Overview tab content ── */

function OverviewContent({
  project,
  onUpdate,
  imageUploadHandler,
}: {
  project: { description: string | null; status: string; targetDate: string | null };
  onUpdate: (data: Record<string, unknown>) => void;
  imageUploadHandler?: (file: File) => Promise<string>;
}) {
  return (
    <div className="space-y-6">
      <InlineEditor
        value={project.description ?? ""}
        onSave={(description) => onUpdate({ description })}
        as="p"
        className="text-sm text-muted-foreground"
        placeholder="Add a description..."
        multiline
        imageUploadHandler={imageUploadHandler}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Status</span>
          <div className="mt-1">
            <StatusBadge status={project.status} />
          </div>
        </div>
        {project.targetDate && (
          <div>
            <span className="text-muted-foreground">Target Date</span>
            <p>{project.targetDate}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Color picker popover ── */

function ColorPicker({
  currentColor,
  onSelect,
}: {
  currentColor: string;
  onSelect: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="shrink-0 h-5 w-5 rounded-md cursor-pointer hover:ring-2 hover:ring-foreground/20 transition-all"
        style={{ backgroundColor: currentColor }}
        aria-label="Change project color"
      />
      {open && (
        <div className="absolute top-full left-0 mt-2 p-2 bg-popover border border-border rounded-lg shadow-lg z-50">
          <div className="grid grid-cols-5 gap-1.5">
            {PROJECT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  onSelect(color);
                  setOpen(false);
                }}
                className={`h-6 w-6 rounded-md cursor-pointer transition-all hover:scale-110 ${
                  color === currentColor
                    ? "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                    : "hover:ring-2 hover:ring-foreground/30"
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── List (issues) tab content ── */

function ProjectIssuesList({ projectId }: { projectId: string }) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5000,
  });

  const liveIssueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of liveRuns ?? []) {
      if (run.issueId) ids.add(run.issueId);
    }
    return ids;
  }, [liveRuns]);

  const { data: issues, isLoading, error } = useQuery({
    queryKey: queryKeys.issues.listByProject(selectedCompanyId!, projectId),
    queryFn: () => issuesApi.list(selectedCompanyId!, { projectId }),
    enabled: !!selectedCompanyId,
  });

  const updateIssue = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      issuesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.listByProject(selectedCompanyId!, projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    },
  });

  return (
    <IssuesList
      issues={issues ?? []}
      isLoading={isLoading}
      error={error as Error | null}
      agents={agents}
      liveIssueIds={liveIssueIds}
      projectId={projectId}
      viewStateKey={`paperclip:project-view:${projectId}`}
      onUpdateIssue={(id, data) => updateIssue.mutate({ id, data })}
    />
  );
}

/* ── Main project page ── */

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedCompanyId } = useCompany();
  const { openPanel, closePanel } = usePanel();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = projectId ? resolveProjectTab(location.pathname, projectId) : null;

  const { data: project, isLoading, error } = useQuery({
    queryKey: queryKeys.projects.detail(projectId!),
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId!) });
    if (selectedCompanyId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(selectedCompanyId) });
    }
  };

  const updateProject = useMutation({
    mutationFn: (data: Record<string, unknown>) => projectsApi.update(projectId!, data),
    onSuccess: invalidateProject,
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedCompanyId) throw new Error("No company selected");
      return assetsApi.uploadImage(selectedCompanyId, file, `projects/${projectId ?? "draft"}`);
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Projects", href: "/projects" },
      { label: project?.name ?? projectId ?? "Project" },
    ]);
  }, [setBreadcrumbs, project, projectId]);

  useEffect(() => {
    if (project) {
      openPanel(<ProjectProperties project={project} onUpdate={(data) => updateProject.mutate(data)} />);
    }
    return () => closePanel();
  }, [project]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect bare /projects/:id to /projects/:id/issues
  if (projectId && activeTab === null) {
    return <Navigate to={`/projects/${projectId}/issues`} replace />;
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!project) return null;

  const handleTabChange = (tab: ProjectTab) => {
    if (tab === "overview") {
      navigate(`/projects/${projectId}/overview`);
    } else {
      navigate(`/projects/${projectId}/issues`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ColorPicker
          currentColor={project.color ?? "#6366f1"}
          onSelect={(color) => updateProject.mutate({ color })}
        />
        <InlineEditor
          value={project.name}
          onSave={(name) => updateProject.mutate({ name })}
          as="h2"
          className="text-xl font-bold"
        />
      </div>

      {/* Top-level project tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "overview"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTabChange("overview")}
        >
          Overview
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "list"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTabChange("list")}
        >
          List
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewContent
          project={project}
          onUpdate={(data) => updateProject.mutate(data)}
          imageUploadHandler={async (file) => {
            const asset = await uploadImage.mutateAsync(file);
            return asset.contentPath;
          }}
        />
      )}

      {activeTab === "list" && projectId && (
        <ProjectIssuesList projectId={projectId} />
      )}
    </div>
  );
}
