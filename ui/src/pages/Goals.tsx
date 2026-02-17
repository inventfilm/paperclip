import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { goalsApi } from "../api/goals";
import { useApi } from "../hooks/useApi";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { GoalTree } from "../components/GoalTree";
import { EmptyState } from "../components/EmptyState";
import { Target } from "lucide-react";

export function Goals() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  useEffect(() => {
    setBreadcrumbs([{ label: "Goals" }]);
  }, [setBreadcrumbs]);

  const fetcher = useCallback(() => {
    if (!selectedCompanyId) return Promise.resolve([]);
    return goalsApi.list(selectedCompanyId);
  }, [selectedCompanyId]);

  const { data: goals, loading, error } = useApi(fetcher);

  if (!selectedCompanyId) {
    return <EmptyState icon={Target} message="Select a company to view goals." />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Goals</h2>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {goals && goals.length === 0 && (
        <EmptyState
          icon={Target}
          message="No goals yet."
          action="Add Goal"
          onAction={() => {/* TODO: goal creation */}}
        />
      )}

      {goals && goals.length > 0 && (
        <GoalTree goals={goals} onSelect={(goal) => navigate(`/goals/${goal.id}`)} />
      )}
    </div>
  );
}
