import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { AGENT_ROLES, AGENT_ADAPTER_TYPES } from "@paperclip/shared";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Minimize2,
  Maximize2,
  Shield,
  User,
  ChevronDown,
  ChevronRight,
  Heart,
  HelpCircle,
  FolderOpen,
} from "lucide-react";
import { cn } from "../lib/utils";

const roleLabels: Record<string, string> = {
  ceo: "CEO", cto: "CTO", cmo: "CMO", cfo: "CFO",
  engineer: "Engineer", designer: "Designer", pm: "PM",
  qa: "QA", devops: "DevOps", researcher: "Researcher", general: "General",
};

const adapterLabels: Record<string, string> = {
  claude_local: "Claude (local)",
  codex_local: "Codex (local)",
  process: "Process",
  http: "HTTP",
};

/* ---- Help text for (?) tooltips ---- */
const help: Record<string, string> = {
  name: "Display name for this agent.",
  title: "Job title shown in the org chart.",
  role: "Organizational role. Determines position and capabilities.",
  reportsTo: "The agent this one reports to in the org hierarchy.",
  adapterType: "How this agent runs: local CLI (Claude/Codex), spawned process, or HTTP webhook.",
  cwd: "The working directory where the agent operates. Should be an absolute path on the server.",
  promptTemplate: "The prompt sent to the agent on each heartbeat. Supports {{ agent.id }}, {{ agent.name }}, {{ agent.role }} variables.",
  model: "Override the default model used by the adapter.",
  dangerouslySkipPermissions: "Run Claude without permission prompts. Required for unattended operation.",
  dangerouslyBypassSandbox: "Run Codex without sandbox restrictions. Required for filesystem/network access.",
  search: "Enable Codex web search capability during runs.",
  bootstrapPrompt: "Prompt used only on the first run (no existing session). Used for initial agent setup.",
  maxTurnsPerRun: "Maximum number of agentic turns (tool calls) per heartbeat run.",
  command: "The command to execute (e.g. node, python).",
  args: "Command-line arguments, comma-separated.",
  webhookUrl: "The URL that receives POST requests when the agent is invoked.",
  heartbeatInterval: "Run this agent automatically on a timer. Useful for periodic tasks like checking for new work.",
  intervalSec: "Seconds between automatic heartbeat invocations.",
};

export function NewAgentDialog() {
  const { newAgentOpen, closeNewAgent } = useDialog();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);

  // Identity
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("general");
  const [reportsTo, setReportsTo] = useState("");

  // Adapter
  const [adapterType, setAdapterType] = useState<string>("claude_local");
  const [cwd, setCwd] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [model, setModel] = useState("");

  // claude_local specific
  const [dangerouslySkipPermissions, setDangerouslySkipPermissions] = useState(false);

  // codex_local specific
  const [search, setSearch] = useState(false);
  const [dangerouslyBypassSandbox, setDangerouslyBypassSandbox] = useState(false);

  // process specific
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");

  // http specific
  const [url, setUrl] = useState("");

  // Advanced adapter fields
  const [bootstrapPrompt, setBootstrapPrompt] = useState("");
  const [maxTurnsPerRun, setMaxTurnsPerRun] = useState(80);

  // Heartbeat
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(false);
  const [intervalSec, setIntervalSec] = useState(300);

  // Sections
  const [adapterAdvancedOpen, setAdapterAdvancedOpen] = useState(false);
  const [heartbeatOpen, setHeartbeatOpen] = useState(false);

  // Popover states
  const [roleOpen, setRoleOpen] = useState(false);
  const [reportsToOpen, setReportsToOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && newAgentOpen,
  });

  const { data: adapterModels } = useQuery({
    queryKey: ["adapter-models", adapterType],
    queryFn: () => agentsApi.adapterModels(adapterType),
    enabled: newAgentOpen,
  });

  const isFirstAgent = !agents || agents.length === 0;
  const effectiveRole = isFirstAgent ? "ceo" : role;

  // Auto-fill for CEO
  useEffect(() => {
    if (newAgentOpen && isFirstAgent) {
      if (!name) setName("CEO");
      if (!title) setTitle("CEO");
    }
  }, [newAgentOpen, isFirstAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  const createAgent = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      agentsApi.create(selectedCompanyId!, data),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) });
      reset();
      closeNewAgent();
      navigate(`/agents/${agent.id}`);
    },
  });

  function reset() {
    setName("");
    setTitle("");
    setRole("general");
    setReportsTo("");
    setAdapterType("claude_local");
    setCwd("");
    setPromptTemplate("");
    setModel("");
    setDangerouslySkipPermissions(false);
    setSearch(false);
    setDangerouslyBypassSandbox(false);
    setCommand("");
    setArgs("");
    setUrl("");
    setBootstrapPrompt("");
    setMaxTurnsPerRun(80);
    setHeartbeatEnabled(false);
    setIntervalSec(300);
    setExpanded(true);
    setAdapterAdvancedOpen(false);
    setHeartbeatOpen(false);
  }

  function buildAdapterConfig() {
    const config: Record<string, unknown> = {};
    if (cwd) config.cwd = cwd;
    if (promptTemplate) config.promptTemplate = promptTemplate;
    if (bootstrapPrompt) config.bootstrapPromptTemplate = bootstrapPrompt;
    if (model) config.model = model;
    config.timeoutSec = 0;
    config.graceSec = 15;

    if (adapterType === "claude_local") {
      config.maxTurnsPerRun = maxTurnsPerRun;
      config.dangerouslySkipPermissions = dangerouslySkipPermissions;
    } else if (adapterType === "codex_local") {
      config.search = search;
      config.dangerouslyBypassApprovalsAndSandbox = dangerouslyBypassSandbox;
    } else if (adapterType === "process") {
      if (command) config.command = command;
      if (args) config.args = args.split(",").map((a) => a.trim()).filter(Boolean);
    } else if (adapterType === "http") {
      if (url) config.url = url;
    }
    return config;
  }

  function handleSubmit() {
    if (!selectedCompanyId || !name.trim()) return;
    createAgent.mutate({
      name: name.trim(),
      role: effectiveRole,
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(reportsTo ? { reportsTo } : {}),
      adapterType,
      adapterConfig: buildAdapterConfig(),
      runtimeConfig: {
        heartbeat: {
          enabled: heartbeatEnabled,
          intervalSec,
          wakeOnAssignment: true,
          wakeOnOnDemand: true,
          wakeOnAutomation: true,
          cooldownSec: 10,
        },
      },
      contextMode: "thin",
      budgetMonthlyCents: 0,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const currentReportsTo = (agents ?? []).find((a) => a.id === reportsTo);
  const selectedModel = (adapterModels ?? []).find((m) => m.id === model);

  return (
    <Dialog
      open={newAgentOpen}
      onOpenChange={(open) => {
        if (!open) { reset(); closeNewAgent(); }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn("p-0 gap-0 overflow-hidden", expanded ? "sm:max-w-2xl" : "sm:max-w-lg")}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {selectedCompany && (
              <span className="bg-muted px-1.5 py-0.5 rounded text-xs font-medium">
                {selectedCompany.name.slice(0, 3).toUpperCase()}
              </span>
            )}
            <span className="text-muted-foreground/60">&rsaquo;</span>
            <span>New agent</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-xs" className="text-muted-foreground" onClick={() => setExpanded(!expanded)}>
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon-xs" className="text-muted-foreground" onClick={() => { reset(); closeNewAgent(); }}>
              <span className="text-lg leading-none">&times;</span>
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[70vh]">
          {/* Name */}
          <div className="px-4 pt-3">
            <input
              className="w-full text-base font-medium bg-transparent outline-none placeholder:text-muted-foreground/50"
              placeholder="Agent name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Title */}
          <div className="px-4 pb-2">
            <input
              className="w-full bg-transparent outline-none text-sm text-muted-foreground placeholder:text-muted-foreground/40"
              placeholder="Title (e.g. VP of Engineering)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Property chips: Role + Reports To */}
          <div className="flex items-center gap-1.5 px-4 py-2 border-t border-border flex-wrap">
            {/* Role */}
            <Popover open={roleOpen} onOpenChange={setRoleOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors",
                    isFirstAgent && "opacity-60 cursor-not-allowed"
                  )}
                  disabled={isFirstAgent}
                >
                  <Shield className="h-3 w-3 text-muted-foreground" />
                  {roleLabels[effectiveRole] ?? effectiveRole}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1" align="start">
                {AGENT_ROLES.map((r) => (
                  <button
                    key={r}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                      r === role && "bg-accent"
                    )}
                    onClick={() => { setRole(r); setRoleOpen(false); }}
                  >
                    {roleLabels[r] ?? r}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Reports To */}
            <Popover open={reportsToOpen} onOpenChange={setReportsToOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors",
                    isFirstAgent && "opacity-60 cursor-not-allowed"
                  )}
                  disabled={isFirstAgent}
                >
                  <User className="h-3 w-3 text-muted-foreground" />
                  {currentReportsTo
                    ? `Reports to ${currentReportsTo.name}`
                    : isFirstAgent
                      ? "Reports to: N/A (CEO)"
                      : "Reports to..."
                  }
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                <button
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    !reportsTo && "bg-accent"
                  )}
                  onClick={() => { setReportsTo(""); setReportsToOpen(false); }}
                >
                  No manager
                </button>
                {(agents ?? []).map((a) => (
                  <button
                    key={a.id}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 truncate",
                      a.id === reportsTo && "bg-accent"
                    )}
                    onClick={() => { setReportsTo(a.id); setReportsToOpen(false); }}
                  >
                    {a.name}
                    <span className="text-muted-foreground ml-auto">{roleLabels[a.role] ?? a.role}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {/* Adapter type dropdown (above config section) */}
          <div className="px-4 py-2.5 border-t border-border">
            <Field label="Adapter" hint={help.adapterType}>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent/50 transition-colors w-full justify-between">
                    <span>{adapterLabels[adapterType] ?? adapterType}</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
                  {AGENT_ADAPTER_TYPES.map((t) => (
                    <button
                      key={t}
                      className={cn(
                        "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
                        t === adapterType && "bg-accent"
                      )}
                      onClick={() => setAdapterType(t)}
                    >
                      {adapterLabels[t] ?? t}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </Field>
          </div>

          {/* Adapter Configuration (always open) */}
          <div className="border-t border-border">
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground">
              Adapter Configuration
            </div>
            <div className="px-4 pb-3 space-y-3">
              {/* Working directory — basic, shown for local adapters */}
              {(adapterType === "claude_local" || adapterType === "codex_local") && (
                <Field label="Working directory" hint={help.cwd}>
                  <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      className="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                      placeholder="/path/to/project"
                      value={cwd}
                      onChange={(e) => setCwd(e.target.value)}
                    />
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0"
                      onClick={async () => {
                        try {
                          // @ts-expect-error -- showDirectoryPicker is not in all TS lib defs yet
                          const handle = await window.showDirectoryPicker({ mode: "read" });
                          setCwd(handle.name);
                        } catch {
                          // user cancelled or API unsupported
                        }
                      }}
                    >
                      Choose
                    </button>
                  </div>
                </Field>
              )}

              {/* Prompt template — basic, auto-expanding */}
              {(adapterType === "claude_local" || adapterType === "codex_local") && (
                <Field label="Prompt template" hint={help.promptTemplate}>
                  <AutoExpandTextarea
                    placeholder="You are agent {{ agent.name }}. Your role is {{ agent.role }}..."
                    value={promptTemplate}
                    onChange={setPromptTemplate}
                    minRows={4}
                  />
                </Field>
              )}

              {/* Skip permissions — basic for claude */}
              {adapterType === "claude_local" && (
                <ToggleField
                  label="Skip permissions"
                  hint={help.dangerouslySkipPermissions}
                  checked={dangerouslySkipPermissions}
                  onChange={setDangerouslySkipPermissions}
                />
              )}

              {/* Bypass sandbox + search — basic for codex */}
              {adapterType === "codex_local" && (
                <>
                  <ToggleField
                    label="Bypass sandbox"
                    hint={help.dangerouslyBypassSandbox}
                    checked={dangerouslyBypassSandbox}
                    onChange={setDangerouslyBypassSandbox}
                  />
                  <ToggleField
                    label="Enable search"
                    hint={help.search}
                    checked={search}
                    onChange={setSearch}
                  />
                </>
              )}

              {/* Process-specific fields */}
              {adapterType === "process" && (
                <>
                  <Field label="Command" hint={help.command}>
                    <input
                      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                      placeholder="e.g. node, python"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                    />
                  </Field>
                  <Field label="Args (comma-separated)" hint={help.args}>
                    <input
                      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                      placeholder="e.g. script.js, --flag"
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                    />
                  </Field>
                </>
              )}

              {/* HTTP-specific fields */}
              {adapterType === "http" && (
                <Field label="Webhook URL" hint={help.webhookUrl}>
                  <input
                    className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </Field>
              )}

              {/* Advanced section for local adapters */}
              {(adapterType === "claude_local" || adapterType === "codex_local") && (
                <CollapsibleSection
                  title="Advanced Adapter Configuration"
                  open={adapterAdvancedOpen}
                  onToggle={() => setAdapterAdvancedOpen(!adapterAdvancedOpen)}
                >
                  <div className="space-y-3">
                    {/* Model dropdown */}
                    <Field label="Model" hint={help.model}>
                      <Popover open={modelOpen} onOpenChange={setModelOpen}>
                        <PopoverTrigger asChild>
                          <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent/50 transition-colors w-full justify-between">
                            <span className={cn(!model && "text-muted-foreground")}>
                              {selectedModel ? selectedModel.label : model || "Default"}
                            </span>
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
                          <button
                            className={cn(
                              "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
                              !model && "bg-accent"
                            )}
                            onClick={() => { setModel(""); setModelOpen(false); }}
                          >
                            Default
                          </button>
                          {(adapterModels ?? []).map((m) => (
                            <button
                              key={m.id}
                              className={cn(
                                "flex items-center justify-between w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
                                m.id === model && "bg-accent"
                              )}
                              onClick={() => { setModel(m.id); setModelOpen(false); }}
                            >
                              <span>{m.label}</span>
                              <span className="text-xs text-muted-foreground font-mono">{m.id}</span>
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </Field>

                    {/* Bootstrap prompt */}
                    <Field label="Bootstrap prompt (first run)" hint={help.bootstrapPrompt}>
                      <AutoExpandTextarea
                        placeholder="Optional initial setup prompt for the first run"
                        value={bootstrapPrompt}
                        onChange={setBootstrapPrompt}
                        minRows={2}
                      />
                    </Field>

                    {/* Max turns — claude only */}
                    {adapterType === "claude_local" && (
                      <Field label="Max turns per run" hint={help.maxTurnsPerRun}>
                        <input
                          type="number"
                          className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono"
                          value={maxTurnsPerRun}
                          onChange={(e) => setMaxTurnsPerRun(Number(e.target.value))}
                        />
                      </Field>
                    )}
                  </div>
                </CollapsibleSection>
              )}
            </div>
          </div>

          {/* Heartbeat Policy */}
          <CollapsibleSection
            title="Heartbeat Policy"
            icon={<Heart className="h-3 w-3" />}
            open={heartbeatOpen}
            onToggle={() => setHeartbeatOpen(!heartbeatOpen)}
            bordered
          >
            <div className="space-y-3">
              <ToggleWithNumber
                label="Heartbeat on interval"
                hint={help.heartbeatInterval}
                checked={heartbeatEnabled}
                onCheckedChange={setHeartbeatEnabled}
                number={intervalSec}
                onNumberChange={setIntervalSec}
                numberLabel="sec"
                numberHint={help.intervalSec}
                showNumber={heartbeatEnabled}
              />
            </div>
          </CollapsibleSection>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {isFirstAgent ? "This will be the CEO" : ""}
          </span>
          <Button
            size="sm"
            disabled={!name.trim() || createAgent.isPending}
            onClick={handleSubmit}
          >
            {createAgent.isPending ? "Creating..." : "Create agent"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Reusable components ---- */

function HintIcon({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <HelpCircle className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      {children}
    </div>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && <HintIcon text={hint} />}
      </div>
      <button
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          checked ? "bg-green-600" : "bg-muted"
        )}
        onClick={() => onChange(!checked)}
      >
        <span
          className={cn(
            "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

function ToggleWithNumber({
  label,
  hint,
  checked,
  onCheckedChange,
  number,
  onNumberChange,
  numberLabel,
  numberHint,
  showNumber,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  number: number;
  onNumberChange: (v: number) => void;
  numberLabel: string;
  numberHint?: string;
  showNumber: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          {hint && <HintIcon text={hint} />}
        </div>
        <button
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
            checked ? "bg-green-600" : "bg-muted"
          )}
          onClick={() => onCheckedChange(!checked)}
        >
          <span
            className={cn(
              "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
              checked ? "translate-x-4.5" : "translate-x-0.5"
            )}
          />
        </button>
      </div>
      {showNumber && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Run heartbeat every</span>
          <input
            type="number"
            className="w-16 rounded-md border border-border px-2 py-0.5 bg-transparent outline-none text-xs font-mono text-center"
            value={number}
            onChange={(e) => onNumberChange(Number(e.target.value))}
          />
          <span>{numberLabel}</span>
          {numberHint && <HintIcon text={numberHint} />}
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  bordered,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(bordered && "border-t border-border")}>
      <button
        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {icon}
        {title}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function AutoExpandTextarea({
  value,
  onChange,
  placeholder,
  minRows,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20; // approx line height in px for text-sm mono
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ minHeight }}
    />
  );
}
