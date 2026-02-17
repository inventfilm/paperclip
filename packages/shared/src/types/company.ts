import type { CompanyStatus } from "../constants.js";

export interface Company {
  id: string;
  name: string;
  description: string | null;
  status: CompanyStatus;
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
  createdAt: Date;
  updatedAt: Date;
}
