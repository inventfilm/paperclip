import { Command } from "commander";
import type { Company } from "@paperclip/shared";
import {
  addCommonClientOptions,
  formatInlineRecord,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface CompanyCommandOptions extends BaseClientOptions {}

export function registerCompanyCommands(program: Command): void {
  const company = program.command("company").description("Company operations");

  addCommonClientOptions(
    company
      .command("list")
      .description("List companies")
      .action(async (opts: CompanyCommandOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const rows = (await ctx.api.get<Company[]>("/api/companies")) ?? [];
          if (ctx.json) {
            printOutput(rows, { json: true });
            return;
          }

          if (rows.length === 0) {
            printOutput([], { json: false });
            return;
          }

          const formatted = rows.map((row) => ({
            id: row.id,
            name: row.name,
            status: row.status,
            budgetMonthlyCents: row.budgetMonthlyCents,
            spentMonthlyCents: row.spentMonthlyCents,
            requireBoardApprovalForNewAgents: row.requireBoardApprovalForNewAgents,
          }));
          for (const row of formatted) {
            console.log(formatInlineRecord(row));
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );

  addCommonClientOptions(
    company
      .command("get")
      .description("Get one company")
      .argument("<companyId>", "Company ID")
      .action(async (companyId: string, opts: CompanyCommandOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const row = await ctx.api.get<Company>(`/api/companies/${companyId}`);
          printOutput(row, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
  );
}
