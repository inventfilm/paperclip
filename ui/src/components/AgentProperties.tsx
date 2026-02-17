import type { Agent } from "@paperclip/shared";
import { StatusBadge } from "./StatusBadge";
import { formatCents, formatDate } from "../lib/utils";
import { Separator } from "@/components/ui/separator";

interface AgentPropertiesProps {
  agent: Agent;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

export function AgentProperties({ agent }: AgentPropertiesProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <PropertyRow label="Status">
          <StatusBadge status={agent.status} />
        </PropertyRow>
        <PropertyRow label="Role">
          <span className="text-sm">{agent.role}</span>
        </PropertyRow>
        {agent.title && (
          <PropertyRow label="Title">
            <span className="text-sm">{agent.title}</span>
          </PropertyRow>
        )}
        <PropertyRow label="Adapter">
          <span className="text-sm font-mono">{agent.adapterType}</span>
        </PropertyRow>
        <PropertyRow label="Context">
          <span className="text-sm">{agent.contextMode}</span>
        </PropertyRow>
      </div>

      <Separator />

      <div className="space-y-1">
        <PropertyRow label="Budget">
          <span className="text-sm">
            {formatCents(agent.spentMonthlyCents)} / {formatCents(agent.budgetMonthlyCents)}
          </span>
        </PropertyRow>
        <PropertyRow label="Utilization">
          <span className="text-sm">
            {agent.budgetMonthlyCents > 0
              ? Math.round((agent.spentMonthlyCents / agent.budgetMonthlyCents) * 100)
              : 0}
            %
          </span>
        </PropertyRow>
      </div>

      <Separator />

      <div className="space-y-1">
        {agent.lastHeartbeatAt && (
          <PropertyRow label="Last Heartbeat">
            <span className="text-sm">{formatDate(agent.lastHeartbeatAt)}</span>
          </PropertyRow>
        )}
        {agent.reportsTo && (
          <PropertyRow label="Reports To">
            <span className="text-sm font-mono">{agent.reportsTo.slice(0, 8)}</span>
          </PropertyRow>
        )}
        <PropertyRow label="Created">
          <span className="text-sm">{formatDate(agent.createdAt)}</span>
        </PropertyRow>
      </div>
    </div>
  );
}
