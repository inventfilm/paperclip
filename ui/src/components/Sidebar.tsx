import {
  Inbox,
  CircleDot,
  Hexagon,
  Target,
  LayoutDashboard,
  GitBranch,
  Bot,
  DollarSign,
  History,
  Search,
  SquarePen,
  Building2,
  ListTodo,
  LayoutList,
} from "lucide-react";
import { CompanySwitcher } from "./CompanySwitcher";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { useDialog } from "../context/DialogContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Sidebar() {
  const { openNewIssue } = useDialog();

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  return (
    <aside className="w-60 h-full border-r border-border bg-card flex flex-col">
      <div className="flex items-center gap-1 p-3">
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

      <Separator />

      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-3 p-3">
          <div className="flex flex-col gap-0.5">
            <SidebarNavItem to="/inbox" label="Inbox" icon={Inbox} />
            <SidebarNavItem to="/my-issues" label="My Issues" icon={ListTodo} />
          </div>

          <SidebarSection label="Work">
            <SidebarNavItem to="/issues" label="Issues" icon={CircleDot} />
            <SidebarNavItem to="/projects" label="Projects" icon={Hexagon} />
            <SidebarNavItem to="/goals" label="Goals" icon={Target} />
          </SidebarSection>

          <SidebarSection label="Company">
            <SidebarNavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} />
            <SidebarNavItem to="/org" label="Org Chart" icon={GitBranch} />
            <SidebarNavItem to="/agents" label="Agents" icon={Bot} />
            <SidebarNavItem to="/costs" label="Costs" icon={DollarSign} />
            <SidebarNavItem to="/activity" label="Activity" icon={History} />
            <SidebarNavItem to="/companies" label="Companies" icon={Building2} />
          </SidebarSection>
        </nav>
      </ScrollArea>
    </aside>
  );
}
