import type { Project } from "@paperclip/shared";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "../lib/utils";
import { Separator } from "@/components/ui/separator";

interface ProjectPropertiesProps {
  project: Project;
  onUpdate?: (data: Record<string, unknown>) => void;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

export function ProjectProperties({ project, onUpdate }: ProjectPropertiesProps) {
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
        {project.goalId && (
          <PropertyRow label="Goal">
            <span className="text-sm font-mono">{project.goalId.slice(0, 8)}</span>
          </PropertyRow>
        )}
        {project.targetDate && (
          <PropertyRow label="Target Date">
            <span className="text-sm">{formatDate(project.targetDate)}</span>
          </PropertyRow>
        )}
      </div>

      <Separator />

      <div className="space-y-1">
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
