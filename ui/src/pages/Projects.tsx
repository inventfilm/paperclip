import { useCallback } from "react";
import { projectsApi } from "../api/projects";
import { useApi } from "../hooks/useApi";
import { formatDate } from "../lib/utils";

export function Projects() {
  const fetcher = useCallback(() => projectsApi.list(), []);
  const { data: projects, loading, error } = useApi(fetcher);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Projects</h2>
      {loading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-600">{error.message}</p>}
      {projects && projects.length === 0 && <p className="text-gray-500">No projects yet.</p>}
      {projects && projects.length > 0 && (
        <div className="grid gap-4">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{project.name}</h3>
                  {project.description && (
                    <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                  )}
                </div>
                <span className="text-sm text-gray-400">{formatDate(project.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
