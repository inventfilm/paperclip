import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface PanelContextValue {
  panelContent: ReactNode | null;
  openPanel: (content: ReactNode) => void;
  closePanel: () => void;
}

const PanelContext = createContext<PanelContextValue | null>(null);

export function PanelProvider({ children }: { children: ReactNode }) {
  const [panelContent, setPanelContent] = useState<ReactNode | null>(null);

  const openPanel = useCallback((content: ReactNode) => {
    setPanelContent(content);
  }, []);

  const closePanel = useCallback(() => {
    setPanelContent(null);
  }, []);

  return (
    <PanelContext.Provider value={{ panelContent, openPanel, closePanel }}>
      {children}
    </PanelContext.Provider>
  );
}

export function usePanel() {
  const ctx = useContext(PanelContext);
  if (!ctx) {
    throw new Error("usePanel must be used within PanelProvider");
  }
  return ctx;
}
