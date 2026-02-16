import { useAgents } from "../hooks/useAgents";
import { StatusBadge } from "../components/StatusBadge";
import { formatCents } from "../lib/utils";

export function Agents() {
  const { data: agents, loading, error } = useAgents();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Agents</h2>
      {loading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-600">{error.message}</p>}
      {agents && agents.length === 0 && <p className="text-gray-500">No agents yet.</p>}
      {agents && agents.length > 0 && (
        <div className="grid gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{agent.name}</h3>
                  <p className="text-sm text-gray-500">{agent.role}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {formatCents(agent.spentCents)} / {formatCents(agent.budgetCents)}
                  </span>
                  <StatusBadge status={agent.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
