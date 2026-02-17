import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Company } from "@paperclip/shared";
import { companiesApi } from "../api/companies";

interface CompanyContextValue {
  companies: Company[];
  selectedCompanyId: string | null;
  selectedCompany: Company | null;
  loading: boolean;
  error: Error | null;
  setSelectedCompanyId: (companyId: string) => void;
  reloadCompanies: () => Promise<void>;
  createCompany: (data: {
    name: string;
    description?: string | null;
    budgetMonthlyCents?: number;
  }) => Promise<Company>;
}

const STORAGE_KEY = "paperclip.selectedCompanyId";

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const setSelectedCompanyId = useCallback((companyId: string) => {
    setSelectedCompanyIdState(companyId);
    localStorage.setItem(STORAGE_KEY, companyId);
  }, []);

  const reloadCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await companiesApi.list();
      setCompanies(rows);

      if (rows.length === 0) {
        setSelectedCompanyIdState(null);
        return;
      }

      const stored = localStorage.getItem(STORAGE_KEY);
      const next = rows.some((company) => company.id === stored)
        ? stored
        : selectedCompanyId && rows.some((company) => company.id === selectedCompanyId)
          ? selectedCompanyId
          : rows[0]!.id;

      if (next) {
        setSelectedCompanyIdState(next);
        localStorage.setItem(STORAGE_KEY, next);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load companies"));
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void reloadCompanies();
  }, [reloadCompanies]);

  const createCompany = useCallback(
    async (data: { name: string; description?: string | null; budgetMonthlyCents?: number }) => {
      const company = await companiesApi.create(data);
      await reloadCompanies();
      setSelectedCompanyId(company.id);
      return company;
    },
    [reloadCompanies, setSelectedCompanyId],
  );

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  const value = useMemo(
    () => ({
      companies,
      selectedCompanyId,
      selectedCompany,
      loading,
      error,
      setSelectedCompanyId,
      reloadCompanies,
      createCompany,
    }),
    [
      companies,
      selectedCompanyId,
      selectedCompany,
      loading,
      error,
      setSelectedCompanyId,
      reloadCompanies,
      createCompany,
    ],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error("useCompany must be used within CompanyProvider");
  }
  return ctx;
}
