import { useState } from "react";
import { useCompany } from "../context/CompanyContext";
import { formatCents } from "../lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Companies() {
  const {
    companies,
    selectedCompanyId,
    setSelectedCompanyId,
    createCompany,
    loading,
    error,
    reloadCompanies,
  } = useCompany();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await createCompany({
        name: name.trim(),
        description: description.trim() || null,
        budgetMonthlyCents: Number(budget) || 0,
      });
      setName("");
      setDescription("");
      setBudget("0");
      await reloadCompanies();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Companies</h2>
        <p className="text-muted-foreground">Create and select the company you are operating.</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold">Create Company</h3>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <Input
                placeholder="Company name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Input
                placeholder="Monthly budget (cents)"
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Company"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading && <p className="text-muted-foreground">Loading companies...</p>}
      {error && <p className="text-destructive">{error.message}</p>}

      <div className="grid gap-3">
        {companies.map((company) => {
          const selected = company.id === selectedCompanyId;
          return (
            <button
              key={company.id}
              onClick={() => setSelectedCompanyId(company.id)}
              className={`text-left bg-card border rounded-lg p-4 ${
                selected ? "border-primary ring-1 ring-primary" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{company.name}</h3>
                  {company.description && (
                    <p className="text-sm text-muted-foreground mt-1">{company.description}</p>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatCents(company.spentMonthlyCents)} / {formatCents(company.budgetMonthlyCents)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
