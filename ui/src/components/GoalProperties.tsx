import type { Goal } from "@paperclip/shared";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "../lib/utils";
import { Separator } from "@/components/ui/separator";

interface GoalPropertiesProps {
  goal: Goal;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

export function GoalProperties({ goal }: GoalPropertiesProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <PropertyRow label="Status">
          <StatusBadge status={goal.status} />
        </PropertyRow>
        <PropertyRow label="Level">
          <span className="text-sm capitalize">{goal.level}</span>
        </PropertyRow>
        {goal.ownerAgentId && (
          <PropertyRow label="Owner">
            <span className="text-sm font-mono">{goal.ownerAgentId.slice(0, 8)}</span>
          </PropertyRow>
        )}
        {goal.parentId && (
          <PropertyRow label="Parent Goal">
            <span className="text-sm font-mono">{goal.parentId.slice(0, 8)}</span>
          </PropertyRow>
        )}
      </div>

      <Separator />

      <div className="space-y-1">
        <PropertyRow label="Created">
          <span className="text-sm">{formatDate(goal.createdAt)}</span>
        </PropertyRow>
        <PropertyRow label="Updated">
          <span className="text-sm">{formatDate(goal.updatedAt)}</span>
        </PropertyRow>
      </div>
    </div>
  );
}
