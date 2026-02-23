import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useSidebar } from "../context/SidebarContext";
import { projectsApi } from "../api/projects";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Project } from "@paperclip/shared";

export function SidebarProjects() {
  const [open, setOpen] = useState(true);
  const { selectedCompanyId } = useCompany();
  const { openNewProject } = useDialog();
  const { isMobile, setSidebarOpen } = useSidebar();
  const location = useLocation();

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Filter out archived projects
  const visibleProjects = (projects ?? []).filter(
    (p: Project) => !p.archivedAt
  );

  // Extract current projectId from URL
  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const activeProjectId = projectMatch?.[1] ?? null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group">
        <div className="flex items-center px-3 py-1.5">
          <CollapsibleTrigger className="flex items-center gap-1 flex-1 min-w-0">
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground/60 transition-transform opacity-0 group-hover:opacity-100",
                open && "rotate-90"
              )}
            />
            <span className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
              Projects
            </span>
          </CollapsibleTrigger>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openNewProject();
            }}
            className="flex items-center justify-center h-4 w-4 rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 transition-colors"
            aria-label="New project"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      <CollapsibleContent>
        <div className="flex flex-col gap-0.5 mt-0.5">
          {visibleProjects.map((project: Project) => (
            <NavLink
              key={project.id}
              to={`/projects/${project.id}/issues`}
              onClick={() => {
                if (isMobile) setSidebarOpen(false);
              }}
              className={cn(
                "flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors",
                activeProjectId === project.id
                  ? "bg-accent text-foreground"
                  : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <span
                className="shrink-0 h-3.5 w-3.5 rounded-sm"
                style={{
                  backgroundColor: project.color ?? "#6366f1",
                }}
              />
              <span className="flex-1 truncate">{project.name}</span>
            </NavLink>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
