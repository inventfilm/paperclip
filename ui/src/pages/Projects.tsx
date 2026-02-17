import { useCallback } from "react";
import { projectsApi } from "../api/projects";
import { useApi } from "../hooks/useApi";
import { formatDate } from "../lib/utils";
import { StatusBadge } from "../components/StatusBadge";
import { useCompany } from "../context/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";

export function Projects() {
  const { selectedCompanyId } = useCompany();

  const fetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve([]);
    return projectsApi.list(selectedCompanyId);
  }, [selectedCompanyId]);

  const { data: projects, loading, error } = useApi(fetcher);

  if (!selectedCompanyId) {
    return <p className="text-muted-foreground">Select a company first.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Projects</h2>
      {loading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {projects && projects.length === 0 && <p className="text-muted-foreground">No projects yet.</p>}
      {projects && projects.length > 0 && (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                    )}
                    {project.targetDate && (
                      <p className="text-xs text-muted-foreground mt-2">Target: {formatDate(project.targetDate)}</p>
                    )}
                  </div>
                  <StatusBadge status={project.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
