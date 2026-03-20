import { Command } from "commander";
import {
  removeMaintainerOnlySkillSymlinks,
  resolvePaperclipSkillsDir,
} from "@paperclipai/adapter-utils/server-utils";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addCommonClientOptions,
  handleCommandError,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface BoardSetupOptions extends BaseClientOptions {
  companyId?: string;
  installSkills?: boolean;
}

interface SkillsInstallSummary {
  tool: string;
  target: string;
  linked: string[];
  removed: string[];
  skipped: string[];
  failed: Array<{ name: string; error: string }>;
}

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

function claudeSkillsHome(): string {
  const fromEnv = process.env.CLAUDE_HOME?.trim();
  const base = fromEnv && fromEnv.length > 0 ? fromEnv : path.join(os.homedir(), ".claude");
  return path.join(base, "skills");
}

async function installSkillsForTarget(
  sourceSkillsDir: string,
  targetSkillsDir: string,
  tool: string,
): Promise<SkillsInstallSummary> {
  const summary: SkillsInstallSummary = {
    tool,
    target: targetSkillsDir,
    linked: [],
    removed: [],
    skipped: [],
    failed: [],
  };

  await fs.mkdir(targetSkillsDir, { recursive: true });
  const entries = await fs.readdir(sourceSkillsDir, { withFileTypes: true });
  summary.removed = await removeMaintainerOnlySkillSymlinks(
    targetSkillsDir,
    entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
  );

  // Only install the board skill
  const boardEntry = entries.find((e) => e.isDirectory() && e.name === "paperclip-board");
  if (!boardEntry) {
    summary.failed.push({ name: "paperclip-board", error: "Skill directory not found" });
    return summary;
  }

  const source = path.join(sourceSkillsDir, boardEntry.name);
  const target = path.join(targetSkillsDir, boardEntry.name);
  const existing = await fs.lstat(target).catch(() => null);

  if (existing) {
    if (existing.isSymbolicLink()) {
      await fs.unlink(target);
    } else {
      summary.skipped.push(boardEntry.name);
      return summary;
    }
  }

  try {
    await fs.symlink(source, target);
    summary.linked.push(boardEntry.name);
  } catch (err) {
    summary.failed.push({
      name: boardEntry.name,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return summary;
}

function buildBoardEnvExports(input: { apiBase: string; companyId?: string }): string {
  const escaped = (value: string) => value.replace(/'/g, "'\"'\"'");
  const lines = [`export PAPERCLIP_API_URL='${escaped(input.apiBase)}'`];
  if (input.companyId) {
    lines.push(`export PAPERCLIP_COMPANY_ID='${escaped(input.companyId)}'`);
  }
  return lines.join("\n");
}

export function registerBoardCommands(program: Command): void {
  const board = program.command("board").description("Board member operations");

  addCommonClientOptions(
    board
      .command("setup")
      .description(
        "Install the board-member skill for Claude Code and print shell exports for managing your Paperclip company",
      )
      .option("-C, --company-id <id>", "Company ID (if you already have one)")
      .option("--no-install-skills", "Skip installing the board skill into ~/.claude/skills")
      .action(async (opts: BoardSetupOptions) => {
        try {
          const ctx = resolveCommandContext(opts);

          // Attempt to auto-detect company if not provided
          let companyId = opts.companyId?.trim() || ctx.companyId;
          if (!companyId) {
            try {
              const companies = await ctx.api.get<Array<{ id: string; name: string }>>(
                "/api/companies",
              );
              if (companies && companies.length === 1) {
                companyId = companies[0].id;
                console.log(`Auto-detected company: ${companies[0].name} (${companyId})`);
              } else if (companies && companies.length > 1) {
                console.log(
                  "Multiple companies found. Pass --company-id or set PAPERCLIP_COMPANY_ID:",
                );
                for (const c of companies) {
                  console.log(`  ${c.id}  ${c.name}`);
                }
              }
            } catch {
              // Server might not be running yet — that's OK
            }
          }

          // Install skills
          const installSummaries: SkillsInstallSummary[] = [];
          if (opts.installSkills !== false) {
            const skillsDir = await resolvePaperclipSkillsDir(__moduleDir, [
              path.resolve(process.cwd(), "skills"),
            ]);
            if (!skillsDir) {
              console.log(
                "Warning: Could not locate skills directory. Skipping skill installation.",
              );
            } else {
              installSummaries.push(
                await installSkillsForTarget(skillsDir, claudeSkillsHome(), "claude"),
              );
            }
          }

          const exportsText = buildBoardEnvExports({
            apiBase: ctx.api.apiBase,
            companyId,
          });

          if (ctx.json) {
            const output = {
              companyId,
              skills: installSummaries,
              exports: exportsText,
            };
            console.log(JSON.stringify(output, null, 2));
            return;
          }

          // Print summary
          console.log("");
          console.log("Board setup complete!");
          console.log("");

          if (installSummaries.length > 0) {
            for (const summary of installSummaries) {
              if (summary.linked.length > 0) {
                console.log(
                  `Skill installed: ${summary.linked.join(", ")} → ${summary.target}`,
                );
              }
              for (const failed of summary.failed) {
                console.log(`  Failed: ${failed.name}: ${failed.error}`);
              }
            }
            console.log("");
          }

          console.log("# Run this in your shell before launching Claude Code:");
          console.log(exportsText);
          console.log("");
          console.log("# Then start Claude Code:");
          console.log("claude");
          if (!companyId) {
            console.log("");
            console.log(
              "Note: No company detected. Claude Code will guide you through creating one.",
            );
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );
}
