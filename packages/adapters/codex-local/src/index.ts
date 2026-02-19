export const type = "codex_local";
export const label = "Codex (local)";

export const models = [
  { id: "o4-mini", label: "o4-mini" },
  { id: "o3", label: "o3" },
  { id: "codex-mini-latest", label: "Codex Mini" },
];

export const agentConfigurationDoc = `# codex_local agent configuration

Adapter: codex_local

Core fields:
- cwd (string, required): absolute working directory for the agent process
- model (string, optional): Codex model id
- promptTemplate (string, optional): run prompt template
- bootstrapPromptTemplate (string, optional): first-run prompt template
- search (boolean, optional): run codex with --search
- dangerouslyBypassApprovalsAndSandbox (boolean, optional): run with bypass flag
- command (string, optional): defaults to "codex"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds
`;
