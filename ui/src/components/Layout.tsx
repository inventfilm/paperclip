import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useCompany } from "../context/CompanyContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function Layout() {
  const { companies, selectedCompanyId, setSelectedCompanyId } = useCompany();

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <header className="bg-card border-b border-border px-8 py-3 flex items-center justify-end">
          <label className="text-xs text-muted-foreground mr-2">Company</label>
          <Select
            value={selectedCompanyId ?? ""}
            onValueChange={(value) => setSelectedCompanyId(value)}
          >
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue placeholder="No companies" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
