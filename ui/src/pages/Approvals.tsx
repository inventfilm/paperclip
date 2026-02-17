import { useCallback, useState } from "react";
import { approvalsApi } from "../api/approvals";
import { useCompany } from "../context/CompanyContext";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function Approvals() {
  const { selectedCompanyId } = useCompany();
  const [actionError, setActionError] = useState<string | null>(null);

  const fetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve([]);
    return approvalsApi.list(selectedCompanyId);
  }, [selectedCompanyId]);

  const { data, loading, error, reload } = useApi(fetcher);

  async function approve(id: string) {
    setActionError(null);
    try {
      await approvalsApi.approve(id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve");
    }
  }

  async function reject(id: string) {
    setActionError(null);
    try {
      await approvalsApi.reject(id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reject");
    }
  }

  if (!selectedCompanyId) {
    return <p className="text-muted-foreground">Select a company first.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Approvals</h2>
      {loading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {actionError && <p className="text-destructive">{actionError}</p>}

      {data && data.length === 0 && <p className="text-muted-foreground">No approvals.</p>}

      {data && data.length > 0 && (
        <div className="grid gap-3">
          {data.map((approval) => (
            <Card key={approval.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{approval.type}</p>
                    <p className="text-xs text-muted-foreground">{approval.id}</p>
                  </div>
                  <StatusBadge status={approval.status} />
                </div>
                {approval.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-green-700 text-green-400 hover:bg-green-900/50"
                      onClick={() => approve(approval.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => reject(approval.id)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
