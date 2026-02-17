import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { CompanyProvider } from "./context/CompanyContext";
import { BreadcrumbProvider } from "./context/BreadcrumbContext";
import { PanelProvider } from "./context/PanelContext";
import { DialogProvider } from "./context/DialogContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CompanyProvider>
      <BrowserRouter>
        <TooltipProvider>
          <BreadcrumbProvider>
            <PanelProvider>
              <DialogProvider>
                <App />
              </DialogProvider>
            </PanelProvider>
          </BreadcrumbProvider>
        </TooltipProvider>
      </BrowserRouter>
    </CompanyProvider>
  </StrictMode>
);
