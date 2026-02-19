import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { companiesApi } from "../api/companies";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

export function CompanySettings() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const settingsMutation = useMutation({
    mutationFn: (requireApproval: boolean) =>
      companiesApi.update(selectedCompanyId!, {
        requireBoardApprovalForNewAgents: requireApproval,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: "Settings" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  if (!selectedCompany) {
    return (
      <div className="text-sm text-muted-foreground">
        No company selected. Select a company from the switcher above.
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Company Settings</h1>
      </div>

      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Hiring
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3">
          <div>
            <div className="text-sm font-medium">
              Require board approval for new hires
            </div>
            <div className="text-xs text-muted-foreground">
              New agent hires stay pending until approved by board.
            </div>
          </div>
          <Button
            size="sm"
            variant={
              selectedCompany.requireBoardApprovalForNewAgents
                ? "default"
                : "outline"
            }
            onClick={() =>
              settingsMutation.mutate(
                !selectedCompany.requireBoardApprovalForNewAgents,
              )
            }
            disabled={settingsMutation.isPending}
          >
            {selectedCompany.requireBoardApprovalForNewAgents ? "On" : "Off"}
          </Button>
        </div>
      </div>
    </div>
  );
}
