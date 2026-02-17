import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { CompanyProvider } from "./context/CompanyContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CompanyProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </CompanyProvider>
  </StrictMode>
);
