import { useCallback } from "react";
import { agentsApi, type OrgNode } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";

function OrgTree({ nodes, depth = 0 }: { nodes: OrgNode[]; depth?: number }) {
  return (
    <div className="space-y-2">
      {nodes.map((node) => (
        <div key={node.id}>
          <Card style={{ marginLeft: `${depth * 20}px` }}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{node.name}</p>
                <p className="text-xs text-muted-foreground">{node.role}</p>
              </div>
              <StatusBadge status={node.status} />
            </CardContent>
          </Card>
          {node.reports.length > 0 && <OrgTree nodes={node.reports} depth={depth + 1} />}
        </div>
      ))}
    </div>
  );
}

export function Org() {
  const { selectedCompanyId } = useCompany();

  const fetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve([] as OrgNode[]);
    return agentsApi.org(selectedCompanyId);
  }, [selectedCompanyId]);

  const { data, loading, error } = useApi(fetcher);

  if (!selectedCompanyId) {
    return <p className="text-muted-foreground">Select a company first.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Org Chart</h2>
      {loading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {data && data.length === 0 && <p className="text-muted-foreground">No agents in org.</p>}
      {data && data.length > 0 && <OrgTree nodes={data} />}
    </div>
  );
}
