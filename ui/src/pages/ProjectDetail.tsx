import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { issuesApi } from "../api/issues";
import { usePanel } from "../context/PanelContext";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ProjectProperties } from "../components/ProjectProperties";
import { StatusBadge } from "../components/StatusBadge";
import { EntityRow } from "../components/EntityRow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Issue } from "@paperclip/shared";

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedCompanyId } = useCompany();
  const { openPanel, closePanel } = usePanel();
  const { setBreadcrumbs } = useBreadcrumbs();

  const { data: project, isLoading, error } = useQuery({
    queryKey: queryKeys.projects.detail(projectId!),
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: allIssues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const projectIssues = (allIssues ?? []).filter((i) => i.projectId === projectId);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Projects", href: "/projects" },
      { label: project?.name ?? projectId ?? "Project" },
    ]);
  }, [setBreadcrumbs, project, projectId]);

  useEffect(() => {
    if (project) {
      openPanel(<ProjectProperties project={project} />);
    }
    return () => closePanel();
  }, [project]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!project) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{project.name}</h2>
        {project.description && (
          <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">Issues ({projectIssues.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
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
        </TabsContent>

        <TabsContent value="issues" className="mt-4">
          {projectIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issues in this project.</p>
          ) : (
            <div className="border border-border">
              {projectIssues.map((issue) => (
                <EntityRow
                  key={issue.id}
                  identifier={issue.identifier ?? issue.id.slice(0, 8)}
                  title={issue.title}
                  trailing={<StatusBadge status={issue.status} />}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
