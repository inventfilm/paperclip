import { useCallback } from "react";
import { goalsApi } from "../api/goals";
import { useApi } from "../hooks/useApi";
import { cn } from "../lib/utils";

const levelColors: Record<string, string> = {
  company: "bg-purple-100 text-purple-800",
  team: "bg-blue-100 text-blue-800",
  agent: "bg-indigo-100 text-indigo-800",
  task: "bg-gray-100 text-gray-600",
};

export function Goals() {
  const fetcher = useCallback(() => goalsApi.list(), []);
  const { data: goals, loading, error } = useApi(fetcher);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Goals</h2>
      {loading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-600">{error.message}</p>}
      {goals && goals.length === 0 && <p className="text-gray-500">No goals yet.</p>}
      {goals && goals.length > 0 && (
        <div className="grid gap-4">
          {goals.map((goal) => (
            <div key={goal.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{goal.title}</h3>
                  {goal.description && (
                    <p className="text-sm text-gray-500 mt-1">{goal.description}</p>
                  )}
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    levelColors[goal.level] ?? "bg-gray-100 text-gray-600"
                  )}
                >
                  {goal.level}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
