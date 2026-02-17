import { useState } from "react";
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
  Maximize2,
  Minimize2,
  Bot,
  User,
  Shield,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "../lib/utils";

const roleLabels: Record<string, string> = {
  ceo: "CEO",
  cto: "CTO",
  cmo: "CMO",
  cfo: "CFO",
  engineer: "Engineer",
  designer: "Designer",
  pm: "PM",
  qa: "QA",
  devops: "DevOps",
  researcher: "Researcher",
  general: "General",
};

const adapterLabels: Record<string, string> = {
  claude_local: "Claude (local)",
  codex_local: "Codex (local)",
  process: "Process",
  http: "HTTP",
};

export function NewAgentDialog() {
  const { newAgentOpen, closeNewAgent } = useDialog();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  // Identity
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("general");
  const [reportsTo, setReportsTo] = useState("");
  const [capabilities, setCapabilities] = useState("");

  // Adapter
  const [adapterType, setAdapterType] = useState<string>("claude_local");
  const [cwd, setCwd] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [bootstrapPrompt, setBootstrapPrompt] = useState("");
  const [model, setModel] = useState("");

  // claude_local specific
  const [maxTurnsPerRun, setMaxTurnsPerRun] = useState(80);
  const [dangerouslySkipPermissions, setDangerouslySkipPermissions] = useState(true);

  // codex_local specific
  const [search, setSearch] = useState(false);
  const [dangerouslyBypassSandbox, setDangerouslyBypassSandbox] = useState(true);

  // process specific
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");

  // http specific
  const [url, setUrl] = useState("");

  // Heartbeat
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(true);
  const [intervalSec, setIntervalSec] = useState(300);
  const [wakeOnAssignment, setWakeOnAssignment] = useState(true);
  const [wakeOnOnDemand, setWakeOnOnDemand] = useState(true);
  const [wakeOnAutomation, setWakeOnAutomation] = useState(true);
  const [cooldownSec, setCooldownSec] = useState(10);

  // Runtime
  const [contextMode, setContextMode] = useState("thin");
  const [budgetMonthlyCents, setBudgetMonthlyCents] = useState(0);
  const [timeoutSec, setTimeoutSec] = useState(900);
  const [graceSec, setGraceSec] = useState(15);

  // Sections
  const [adapterOpen, setAdapterOpen] = useState(true);
  const [heartbeatOpen, setHeartbeatOpen] = useState(false);
  const [runtimeOpen, setRuntimeOpen] = useState(false);

  // Popover states
  const [roleOpen, setRoleOpen] = useState(false);
  const [reportsToOpen, setReportsToOpen] = useState(false);
  const [adapterTypeOpen, setAdapterTypeOpen] = useState(false);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && newAgentOpen,
  });

  const isFirstAgent = !agents || agents.length === 0;
  const effectiveRole = isFirstAgent ? "ceo" : role;

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
    setCapabilities("");
    setAdapterType("claude_local");
    setCwd("");
    setPromptTemplate("");
    setBootstrapPrompt("");
    setModel("");
    setMaxTurnsPerRun(80);
    setDangerouslySkipPermissions(true);
    setSearch(false);
    setDangerouslyBypassSandbox(true);
    setCommand("");
    setArgs("");
    setUrl("");
    setHeartbeatEnabled(true);
    setIntervalSec(300);
    setWakeOnAssignment(true);
    setWakeOnOnDemand(true);
    setWakeOnAutomation(true);
    setCooldownSec(10);
    setContextMode("thin");
    setBudgetMonthlyCents(0);
    setTimeoutSec(900);
    setGraceSec(15);
    setExpanded(false);
    setAdapterOpen(true);
    setHeartbeatOpen(false);
    setRuntimeOpen(false);
  }

  function buildAdapterConfig() {
    const config: Record<string, unknown> = {};
    if (cwd) config.cwd = cwd;
    if (promptTemplate) config.promptTemplate = promptTemplate;
    if (bootstrapPrompt) config.bootstrapPromptTemplate = bootstrapPrompt;
    if (model) config.model = model;
    config.timeoutSec = timeoutSec;
    config.graceSec = graceSec;

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
      ...(capabilities.trim() ? { capabilities: capabilities.trim() } : {}),
      adapterType,
      adapterConfig: buildAdapterConfig(),
      runtimeConfig: {
        heartbeat: {
          enabled: heartbeatEnabled,
          intervalSec,
          wakeOnAssignment,
          wakeOnOnDemand,
          wakeOnAutomation,
          cooldownSec,
        },
      },
      contextMode,
      budgetMonthlyCents,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const currentAgent = (agents ?? []).find((a) => a.id === reportsTo);

  return (
    <Dialog
      open={newAgentOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          closeNewAgent();
        }
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
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              onClick={() => { reset(); closeNewAgent(); }}
            >
              <span className="text-lg leading-none">&times;</span>
            </Button>
          </div>
        </div>

        <div className={cn("overflow-y-auto", expanded ? "max-h-[70vh]" : "max-h-[50vh]")}>
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

          {/* Property chips */}
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
                  {currentAgent ? currentAgent.name : isFirstAgent ? "N/A (CEO)" : "Reports to"}
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

            {/* Adapter type */}
            <Popover open={adapterTypeOpen} onOpenChange={setAdapterTypeOpen}>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
                  <Bot className="h-3 w-3 text-muted-foreground" />
                  {adapterLabels[adapterType] ?? adapterType}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1" align="start">
                {AGENT_ADAPTER_TYPES.map((t) => (
                  <button
                    key={t}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                      t === adapterType && "bg-accent"
                    )}
                    onClick={() => { setAdapterType(t); setAdapterTypeOpen(false); }}
                  >
                    {adapterLabels[t] ?? t}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {/* Capabilities */}
          <div className="px-4 py-2 border-t border-border">
            <input
              className="w-full bg-transparent outline-none text-sm text-muted-foreground placeholder:text-muted-foreground/40"
              placeholder="Capabilities (what can this agent do?)"
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
            />
          </div>

          {/* Adapter Config Section */}
          <CollapsibleSection
            title="Adapter Configuration"
            open={adapterOpen}
            onToggle={() => setAdapterOpen(!adapterOpen)}
          >
            <div className="space-y-3">
              <Field label="Working directory">
                <input
                  className="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                  placeholder="/path/to/project"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                />
              </Field>
              <Field label="Prompt template">
                <textarea
                  className="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none min-h-[60px]"
                  placeholder="You are agent {{ agent.name }}..."
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                />
              </Field>
              <Field label="Bootstrap prompt (first run)">
                <textarea
                  className="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none min-h-[40px]"
                  placeholder="Optional initial setup prompt"
                  value={bootstrapPrompt}
                  onChange={(e) => setBootstrapPrompt(e.target.value)}
                />
              </Field>
              <Field label="Model">
                <input
                  className="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                  placeholder="e.g. claude-sonnet-4-5-20250929"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </Field>

              {adapterType === "claude_local" && (
                <>
                  <Field label="Max turns per run">
                    <input
                      type="number"
                      className="w-full bg-transparent outline-none text-sm font-mono"
                      value={maxTurnsPerRun}
                      onChange={(e) => setMaxTurnsPerRun(Number(e.target.value))}
                    />
                  </Field>
                  <ToggleField
                    label="Skip permissions"
                    checked={dangerouslySkipPermissions}
                    onChange={setDangerouslySkipPermissions}
                  />
                </>
              )}

              {adapterType === "codex_local" && (
                <>
                  <ToggleField label="Enable search" checked={search} onChange={setSearch} />
                  <ToggleField
                    label="Bypass sandbox"
                    checked={dangerouslyBypassSandbox}
                    onChange={setDangerouslyBypassSandbox}
                  />
                </>
              )}

              {adapterType === "process" && (
                <>
                  <Field label="Command">
                    <input
                      className="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                      placeholder="e.g. node, python"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                    />
                  </Field>
                  <Field label="Args (comma-separated)">
                    <input
                      className="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                      placeholder="e.g. script.js, --flag"
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                    />
                  </Field>
                </>
              )}

              {adapterType === "http" && (
                <Field label="Webhook URL">
                  <input
                    className="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </Field>
              )}
            </div>
          </CollapsibleSection>

          {/* Heartbeat Policy Section */}
          <CollapsibleSection
            title="Heartbeat Policy"
            open={heartbeatOpen}
            onToggle={() => setHeartbeatOpen(!heartbeatOpen)}
          >
            <div className="space-y-3">
              <ToggleField label="Enabled" checked={heartbeatEnabled} onChange={setHeartbeatEnabled} />
              <Field label="Interval (seconds)">
                <input
                  type="number"
                  className="w-full bg-transparent outline-none text-sm font-mono"
                  value={intervalSec}
                  onChange={(e) => setIntervalSec(Number(e.target.value))}
                />
              </Field>
              <ToggleField label="Wake on assignment" checked={wakeOnAssignment} onChange={setWakeOnAssignment} />
              <ToggleField label="Wake on on-demand" checked={wakeOnOnDemand} onChange={setWakeOnOnDemand} />
              <ToggleField label="Wake on automation" checked={wakeOnAutomation} onChange={setWakeOnAutomation} />
              <Field label="Cooldown (seconds)">
                <input
                  type="number"
                  className="w-full bg-transparent outline-none text-sm font-mono"
                  value={cooldownSec}
                  onChange={(e) => setCooldownSec(Number(e.target.value))}
                />
              </Field>
            </div>
          </CollapsibleSection>

          {/* Runtime Section */}
          <CollapsibleSection
            title="Runtime"
            open={runtimeOpen}
            onToggle={() => setRuntimeOpen(!runtimeOpen)}
          >
            <div className="space-y-3">
              <Field label="Context mode">
                <div className="flex gap-2">
                  {(["thin", "fat"] as const).map((m) => (
                    <button
                      key={m}
                      className={cn(
                        "px-2 py-1 text-xs rounded border",
                        m === contextMode
                          ? "border-foreground bg-accent"
                          : "border-border hover:bg-accent/50"
                      )}
                      onClick={() => setContextMode(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Monthly budget (cents)">
                <input
                  type="number"
                  className="w-full bg-transparent outline-none text-sm font-mono"
                  value={budgetMonthlyCents}
                  onChange={(e) => setBudgetMonthlyCents(Number(e.target.value))}
                />
              </Field>
              <Field label="Timeout (seconds)">
                <input
                  type="number"
                  className="w-full bg-transparent outline-none text-sm font-mono"
                  value={timeoutSec}
                  onChange={(e) => setTimeoutSec(Number(e.target.value))}
                />
              </Field>
              <Field label="Grace period (seconds)">
                <input
                  type="number"
                  className="w-full bg-transparent outline-none text-sm font-mono"
                  value={graceSec}
                  onChange={(e) => setGraceSec(Number(e.target.value))}
                />
              </Field>
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

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border">
      <button
        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {title}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
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
