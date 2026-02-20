import {
  Inbox,
  CircleDot,
  Hexagon,
  Target,
  LayoutDashboard,
  Bot,
  DollarSign,
  History,
  Search,
  SquarePen,
  ShieldCheck,
  BookOpen,
  Paperclip,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CompanySwitcher } from "./CompanySwitcher";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { sidebarBadgesApi } from "../api/sidebarBadges";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Sidebar() {
  const { openNewIssue } = useDialog();
  const { selectedCompanyId } = useCompany();
  const { data: sidebarBadges } = useQuery({
    queryKey: queryKeys.sidebarBadges(selectedCompanyId!),
    queryFn: () => sidebarBadgesApi.get(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  return (
    <aside className="w-60 h-full border-r border-border bg-background flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Paperclip className="h-5 w-5 text-foreground" />
        <span className="text-sm font-semibold tracking-tight text-foreground">Paperclip</span>
      </div>

      {/* Company switcher + actions */}
      <div className="flex items-center gap-1 px-3 pb-3">
        <div className="flex-1 min-w-0">
          <CompanySwitcher />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={openSearch}
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={() => openNewIssue()}
        >
          <SquarePen className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-4 px-3 py-2">
          <div className="flex flex-col gap-0.5">
            <SidebarNavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} />
            <SidebarNavItem
              to="/inbox"
              label="Inbox"
              icon={Inbox}
              badge={sidebarBadges?.inbox}
              badgeTone={sidebarBadges?.failedRuns ? "danger" : "default"}
              alert={(sidebarBadges?.failedRuns ?? 0) > 0}
            />
          </div>

          <SidebarSection label="Work">
            <SidebarNavItem to="/issues" label="Issues" icon={CircleDot} />
            <SidebarNavItem to="/projects" label="Projects" icon={Hexagon} />
            <SidebarNavItem to="/goals" label="Goals" icon={Target} />
          </SidebarSection>

          <SidebarSection label="Company">
            <SidebarNavItem to="/agents" label="Agents" icon={Bot} />
            <SidebarNavItem
              to="/approvals"
              label="Approvals"
              icon={ShieldCheck}
              badge={sidebarBadges?.approvals}
            />
            <SidebarNavItem to="/costs" label="Costs" icon={DollarSign} />
            <SidebarNavItem to="/activity" label="Activity" icon={History} />
          </SidebarSection>
        </nav>
      </ScrollArea>

      {/* Bottom links */}
      <div className="border-t border-border px-3 py-2">
        <SidebarNavItem to="/docs" label="Documentation" icon={BookOpen} />
      </div>
    </aside>
  );
}
