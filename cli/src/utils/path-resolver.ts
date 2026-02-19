import fs from "node:fs";
import path from "node:path";

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

export function resolveRuntimeLikePath(value: string, configPath?: string): string {
  if (path.isAbsolute(value)) return value;

  const cwd = process.cwd();
  const configDir = configPath ? path.dirname(configPath) : null;
  const workspaceRoot = configDir ? path.resolve(configDir, "..") : cwd;

  const candidates = unique([
    path.resolve(workspaceRoot, "server", value),
    path.resolve(workspaceRoot, value),
    path.resolve(cwd, value),
    ...(configDir ? [path.resolve(configDir, value)] : []),
  ]);

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}
