import type { Issue } from "@paperclip/shared";
import { StatusIcon } from "./StatusIcon";
import { PriorityIcon } from "./PriorityIcon";
import { formatDate } from "../lib/utils";
import { Separator } from "@/components/ui/separator";

interface IssuePropertiesProps {
  issue: Issue;
  onUpdate: (data: Record<string, unknown>) => void;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function priorityLabel(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function IssueProperties({ issue, onUpdate }: IssuePropertiesProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <PropertyRow label="Status">
          <StatusIcon
            status={issue.status}
            onChange={(status) => onUpdate({ status })}
          />
          <span className="text-sm">{statusLabel(issue.status)}</span>
        </PropertyRow>

        <PropertyRow label="Priority">
          <PriorityIcon
            priority={issue.priority}
            onChange={(priority) => onUpdate({ priority })}
          />
          <span className="text-sm">{priorityLabel(issue.priority)}</span>
        </PropertyRow>

        {issue.assigneeAgentId && (
          <PropertyRow label="Assignee">
            <span className="text-sm font-mono">{issue.assigneeAgentId.slice(0, 8)}</span>
          </PropertyRow>
        )}

        {issue.projectId && (
          <PropertyRow label="Project">
            <span className="text-sm font-mono">{issue.projectId.slice(0, 8)}</span>
          </PropertyRow>
        )}
      </div>

      <Separator />

      <div className="space-y-1">
        <PropertyRow label="ID">
          <span className="text-sm font-mono">{issue.id.slice(0, 8)}</span>
        </PropertyRow>
        <PropertyRow label="Created">
          <span className="text-sm">{formatDate(issue.createdAt)}</span>
        </PropertyRow>
        <PropertyRow label="Updated">
          <span className="text-sm">{formatDate(issue.updatedAt)}</span>
        </PropertyRow>
      </div>
    </div>
  );
}
