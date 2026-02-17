import { useState, useCallback, useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BreadcrumbBar } from "./BreadcrumbBar";
import { PropertiesPanel } from "./PropertiesPanel";
import { CommandPalette } from "./CommandPalette";
import { NewIssueDialog } from "./NewIssueDialog";
import { NewProjectDialog } from "./NewProjectDialog";
import { NewAgentDialog } from "./NewAgentDialog";
import { OnboardingWizard } from "./OnboardingWizard";
import { useDialog } from "../context/DialogContext";
import { usePanel } from "../context/PanelContext";
import { useCompany } from "../context/CompanyContext";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { cn } from "../lib/utils";

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { openNewIssue, openOnboarding } = useDialog();
  const { panelContent, closePanel } = usePanel();
  const { companies, loading: companiesLoading } = useCompany();
  const onboardingTriggered = useRef(false);

  useEffect(() => {
    if (companiesLoading || onboardingTriggered.current) return;
    if (companies.length === 0) {
      onboardingTriggered.current = true;
      openOnboarding();
    }
  }, [companies, companiesLoading, openOnboarding]);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const togglePanel = useCallback(() => {
    if (panelContent) closePanel();
  }, [panelContent, closePanel]);

  useKeyboardShortcuts({
    onNewIssue: () => openNewIssue(),
    onToggleSidebar: toggleSidebar,
    onTogglePanel: togglePanel,
  });

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <div
        className={cn(
          "transition-all duration-200 ease-in-out shrink-0 h-full overflow-hidden",
          sidebarOpen ? "w-60" : "w-0"
        )}
      >
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <BreadcrumbBar />
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
          <PropertiesPanel />
        </div>
      </div>
      <CommandPalette />
      <NewIssueDialog />
      <NewProjectDialog />
      <NewAgentDialog />
      <OnboardingWizard />
    </div>
  );
}
