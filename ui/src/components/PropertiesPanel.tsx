import { X } from "lucide-react";
import { usePanel } from "../context/PanelContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function PropertiesPanel() {
  const { panelContent, closePanel } = usePanel();

  if (!panelContent) return null;

  return (
    <aside className="w-80 border-l border-border bg-card flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-sm font-medium">Properties</span>
        <Button variant="ghost" size="icon-xs" onClick={closePanel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">{panelContent}</div>
      </ScrollArea>
    </aside>
  );
}
