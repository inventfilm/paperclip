import { useCallback, useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BreadcrumbBar } from "./BreadcrumbBar";
import { PropertiesPanel } from "./PropertiesPanel";
import { CommandPalette } from "./CommandPalette";
import { NewIssueDialog } from "./NewIssueDialog";
import { NewProjectDialog } from "./NewProjectDialog";
import { NewGoalDialog } from "./NewGoalDialog";
import { NewAgentDialog } from "./NewAgentDialog";
import { OnboardingWizard } from "./OnboardingWizard";
import { ToastViewport } from "./ToastViewport";
import { useDialog } from "../context/DialogContext";
import { usePanel } from "../context/PanelContext";
import { useCompany } from "../context/CompanyContext";
import { useSidebar } from "../context/SidebarContext";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { cn } from "../lib/utils";

export function Layout() {
  const { sidebarOpen, setSidebarOpen, toggleSidebar, isMobile } = useSidebar();
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
      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {isMobile ? (
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-60 transition-transform duration-200 ease-in-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar />
        </div>
      ) : (
        <div
          className={cn(
            "shrink-0 h-full overflow-hidden transition-all duration-200 ease-in-out",
            sidebarOpen ? "w-60" : "w-0"
          )}
        >
          <Sidebar />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <BreadcrumbBar />
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
          <PropertiesPanel />
        </div>
      </div>
      <CommandPalette />
      <NewIssueDialog />
      <NewProjectDialog />
      <NewGoalDialog />
      <NewAgentDialog />
      <OnboardingWizard />
      <ToastViewport />
    </div>
  );
}
