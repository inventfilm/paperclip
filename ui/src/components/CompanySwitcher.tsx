import { ChevronsUpDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../context/CompanyContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

function statusDotColor(status?: string): string {
  switch (status) {
    case "active":
      return "bg-green-400";
    case "paused":
      return "bg-yellow-400";
    case "archived":
      return "bg-neutral-400";
    default:
      return "bg-green-400";
  }
}

export function CompanySwitcher() {
  const { companies, selectedCompany, setSelectedCompanyId } = useCompany();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-2 py-1.5 h-auto text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            {selectedCompany && (
              <span className={`h-2 w-2 rounded-full shrink-0 ${statusDotColor(selectedCompany.status)}`} />
            )}
            <span className="text-sm font-medium truncate">
              {selectedCompany?.name ?? "Select company"}
            </span>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel>Companies</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => setSelectedCompanyId(company.id)}
            className={company.id === selectedCompany?.id ? "bg-accent" : ""}
          >
            <span className={`h-2 w-2 rounded-full shrink-0 mr-2 ${statusDotColor(company.status)}`} />
            <span className="truncate">{company.name}</span>
          </DropdownMenuItem>
        ))}
        {companies.length === 0 && (
          <DropdownMenuItem disabled>No companies</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/companies")}>
          <Plus className="h-4 w-4 mr-2" />
          Manage Companies
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
