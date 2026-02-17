import { useState, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BreadcrumbBar } from "./BreadcrumbBar";
import { PropertiesPanel } from "./PropertiesPanel";
import { CommandPalette } from "./CommandPalette";
import { NewIssueDialog } from "./NewIssueDialog";
import { useDialog } from "../context/DialogContext";
import { usePanel } from "../context/PanelContext";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { cn } from "../lib/utils";

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { openNewIssue } = useDialog();
  const { panelContent, closePanel } = usePanel();

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
    <div className="flex h-screen bg-background text-foreground">
      <div
        className={cn(
          "transition-all duration-200 ease-in-out shrink-0 overflow-hidden",
          sidebarOpen ? "w-60" : "w-0"
        )}
      >
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <BreadcrumbBar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
          <PropertiesPanel />
        </div>
      </div>
      <CommandPalette />
      <NewIssueDialog />
    </div>
  );
}
