import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCompany } from "../context/CompanyContext";

const STORAGE_KEY = "paperclip.companyPaths";

function getCompanyPaths(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function saveCompanyPath(companyId: string, path: string) {
  const paths = getCompanyPaths();
  paths[companyId] = path;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

/**
 * Remembers the last visited page per company and navigates to it on company switch.
 * Falls back to /dashboard if no page was previously visited for a company.
 */
export function useCompanyPageMemory() {
  const { selectedCompanyId } = useCompany();
  const location = useLocation();
  const navigate = useNavigate();
  const prevCompanyId = useRef<string | null>(selectedCompanyId);

  // Save current path for current company on every location change.
  // Uses prevCompanyId ref so we save under the correct company even
  // during the render where selectedCompanyId has already changed.
  const fullPath = location.pathname + location.search;
  useEffect(() => {
    const companyId = prevCompanyId.current;
    if (companyId) {
      saveCompanyPath(companyId, fullPath);
    }
  }, [fullPath]);

  // Navigate to saved path when company changes
  useEffect(() => {
    if (!selectedCompanyId) return;

    if (
      prevCompanyId.current !== null &&
      selectedCompanyId !== prevCompanyId.current
    ) {
      const paths = getCompanyPaths();
      const savedPath = paths[selectedCompanyId];
      navigate(savedPath || "/dashboard", { replace: true });
    }
    prevCompanyId.current = selectedCompanyId;
  }, [selectedCompanyId, navigate]);
}
