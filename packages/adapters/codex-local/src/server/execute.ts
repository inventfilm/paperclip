import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclip/adapter-utils";
import {
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  parseObject,
  buildPaperclipEnv,
  redactEnvForLogs,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  renderTemplate,
  runChildProcess,
} from "@paperclip/adapter-utils/server-utils";
import { parseCodexJsonl } from "./parse.js";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta } = ctx;

  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.",
  );
  const bootstrapTemplate = asString(config.bootstrapPromptTemplate, promptTemplate);
  const command = asString(config.command, "codex");
  const model = asString(config.model, "");
  const search = asBoolean(config.search, false);
  const bypass = asBoolean(config.dangerouslyBypassApprovalsAndSandbox, false);

  const cwd = asString(config.cwd, process.cwd());
  await ensureAbsoluteDirectory(cwd);
  const envConfig = parseObject(config.env);
  const env: Record<string, string> = { ...buildPaperclipEnv(agent) };
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  await ensureCommandResolvable(command, cwd, runtimeEnv);

  const timeoutSec = asNumber(config.timeoutSec, 1800);
  const graceSec = asNumber(config.graceSec, 20);
  const extraArgs = (() => {
    const fromExtraArgs = asStringArray(config.extraArgs);
    if (fromExtraArgs.length > 0) return fromExtraArgs;
    return asStringArray(config.args);
  })();

  const sessionId = runtime.sessionId;
  const template = sessionId ? promptTemplate : bootstrapTemplate;
  const prompt = renderTemplate(template, {
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  });

  const args = ["exec", "--json"];
  if (search) args.unshift("--search");
  if (bypass) args.push("--dangerously-bypass-approvals-and-sandbox");
  if (model) args.push("--model", model);
  if (extraArgs.length > 0) args.push(...extraArgs);
  if (sessionId) args.push("resume", sessionId, prompt);
  else args.push(prompt);

  if (onMeta) {
    await onMeta({
      adapterType: "codex_local",
      command,
      cwd,
      commandArgs: args.map((value, idx) => {
        if (!sessionId && idx === args.length - 1) return `<prompt ${prompt.length} chars>`;
        if (sessionId && idx === args.length - 1) return `<prompt ${prompt.length} chars>`;
        return value;
      }),
      env: redactEnvForLogs(env),
      prompt,
      context,
    });
  }

  const proc = await runChildProcess(runId, command, args, {
    cwd,
    env,
    timeoutSec,
    graceSec,
    onLog,
  });

  if (proc.timedOut) {
    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: true,
      errorMessage: `Timed out after ${timeoutSec}s`,
    };
  }

  const parsed = parseCodexJsonl(proc.stdout);

  return {
    exitCode: proc.exitCode,
    signal: proc.signal,
    timedOut: false,
    errorMessage: (proc.exitCode ?? 0) === 0 ? null : `Codex exited with code ${proc.exitCode ?? -1}`,
    usage: parsed.usage,
    sessionId: parsed.sessionId ?? runtime.sessionId,
    provider: "openai",
    model,
    costUsd: null,
    resultJson: {
      stdout: proc.stdout,
      stderr: proc.stderr,
    },
    summary: parsed.summary,
  };
}
