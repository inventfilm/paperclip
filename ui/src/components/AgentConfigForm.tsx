import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AGENT_ADAPTER_TYPES } from "@paperclip/shared";
import type { Agent } from "@paperclip/shared";
import type { AdapterModel } from "../api/agents";
import { agentsApi } from "../api/agents";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FolderOpen, Heart, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import {
  Field,
  ToggleField,
  ToggleWithNumber,
  CollapsibleSection,
  AutoExpandTextarea,
  DraftInput,
  DraftTextarea,
  DraftNumberInput,
  help,
  adapterLabels,
} from "./agent-config-primitives";

/* ---- Create mode values ---- */

export interface CreateConfigValues {
  adapterType: string;
  cwd: string;
  promptTemplate: string;
  model: string;
  dangerouslySkipPermissions: boolean;
  search: boolean;
  dangerouslyBypassSandbox: boolean;
  command: string;
  args: string;
  url: string;
  bootstrapPrompt: string;
  maxTurnsPerRun: number;
  heartbeatEnabled: boolean;
  intervalSec: number;
}

export const defaultCreateValues: CreateConfigValues = {
  adapterType: "claude_local",
  cwd: "",
  promptTemplate: "",
  model: "",
  dangerouslySkipPermissions: false,
  search: false,
  dangerouslyBypassSandbox: false,
  command: "",
  args: "",
  url: "",
  bootstrapPrompt: "",
  maxTurnsPerRun: 80,
  heartbeatEnabled: false,
  intervalSec: 300,
};

/* ---- Props ---- */

type AgentConfigFormProps = {
  adapterModels?: AdapterModel[];
} & (
  | {
      mode: "create";
      values: CreateConfigValues;
      onChange: (patch: Partial<CreateConfigValues>) => void;
    }
  | {
      mode: "edit";
      agent: Agent;
      onSave: (patch: Record<string, unknown>) => void;
      isSaving?: boolean;
    }
);

/* ---- Edit mode overlay (dirty tracking) ---- */

interface Overlay {
  identity: Record<string, unknown>;
  adapterType?: string;
  adapterConfig: Record<string, unknown>;
  heartbeat: Record<string, unknown>;
  runtime: Record<string, unknown>;
}

const emptyOverlay: Overlay = {
  identity: {},
  adapterConfig: {},
  heartbeat: {},
  runtime: {},
};

function isOverlayDirty(o: Overlay): boolean {
  return (
    Object.keys(o.identity).length > 0 ||
    o.adapterType !== undefined ||
    Object.keys(o.adapterConfig).length > 0 ||
    Object.keys(o.heartbeat).length > 0 ||
    Object.keys(o.runtime).length > 0
  );
}

/* ---- Shared input class ---- */
const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

/* ---- Form ---- */

export function AgentConfigForm(props: AgentConfigFormProps) {
  const { mode, adapterModels: externalModels } = props;
  const isCreate = mode === "create";

  // ---- Edit mode: overlay for dirty tracking ----
  const [overlay, setOverlay] = useState<Overlay>(emptyOverlay);
  const agentRef = useRef<Agent | null>(null);

  // Clear overlay when agent data refreshes (after save)
  useEffect(() => {
    if (!isCreate) {
      if (agentRef.current !== null && props.agent !== agentRef.current) {
        setOverlay({ ...emptyOverlay });
      }
      agentRef.current = props.agent;
    }
  }, [isCreate, !isCreate ? props.agent : undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = !isCreate && isOverlayDirty(overlay);

  /** Read effective value: overlay if dirty, else original */
  function eff<T>(group: keyof Omit<Overlay, "adapterType">, field: string, original: T): T {
    const o = overlay[group];
    if (field in o) return o[field] as T;
    return original;
  }

  /** Mark field dirty in overlay */
  function mark(group: keyof Omit<Overlay, "adapterType">, field: string, value: unknown) {
    setOverlay((prev) => ({
      ...prev,
      [group]: { ...prev[group], [field]: value },
    }));
  }

  /** Build accumulated patch and send to parent */
  function handleSave() {
    if (isCreate || !isDirty) return;
    const agent = props.agent;
    const patch: Record<string, unknown> = {};

    if (Object.keys(overlay.identity).length > 0) {
      Object.assign(patch, overlay.identity);
    }
    if (overlay.adapterType !== undefined) {
      patch.adapterType = overlay.adapterType;
    }
    if (Object.keys(overlay.adapterConfig).length > 0) {
      const existing = (agent.adapterConfig ?? {}) as Record<string, unknown>;
      patch.adapterConfig = { ...existing, ...overlay.adapterConfig };
    }
    if (Object.keys(overlay.heartbeat).length > 0) {
      const existingRc = (agent.runtimeConfig ?? {}) as Record<string, unknown>;
      const existingHb = (existingRc.heartbeat ?? {}) as Record<string, unknown>;
      patch.runtimeConfig = { ...existingRc, heartbeat: { ...existingHb, ...overlay.heartbeat } };
    }
    if (Object.keys(overlay.runtime).length > 0) {
      Object.assign(patch, overlay.runtime);
    }

    props.onSave(patch);
  }

  // ---- Resolve values ----
  const config = !isCreate ? ((props.agent.adapterConfig ?? {}) as Record<string, unknown>) : {};
  const runtimeConfig = !isCreate ? ((props.agent.runtimeConfig ?? {}) as Record<string, unknown>) : {};
  const heartbeat = !isCreate ? ((runtimeConfig.heartbeat ?? {}) as Record<string, unknown>) : {};

  const adapterType = isCreate
    ? props.values.adapterType
    : overlay.adapterType ?? props.agent.adapterType;
  const isLocal = adapterType === "claude_local" || adapterType === "codex_local";

  // Fetch adapter models for the effective adapter type
  const { data: fetchedModels } = useQuery({
    queryKey: ["adapter-models", adapterType],
    queryFn: () => agentsApi.adapterModels(adapterType),
  });
  const models = fetchedModels ?? externalModels ?? [];

  // Section toggle state — advanced always starts collapsed
  const [adapterAdvancedOpen, setAdapterAdvancedOpen] = useState(false);
  const [heartbeatOpen, setHeartbeatOpen] = useState(!isCreate);

  // Popover states
  const [modelOpen, setModelOpen] = useState(false);

  // Create mode helpers
  const val = isCreate ? props.values : null;
  const set = isCreate
    ? (patch: Partial<CreateConfigValues>) => props.onChange(patch)
    : null;

  // Current model for display
  const currentModelId = isCreate
    ? val!.model
    : eff("adapterConfig", "model", String(config.model ?? ""));

  return (
    <div className="relative">
      {/* ---- Floating Save button (edit mode, when dirty) ---- */}
      {isDirty && (
        <div className="sticky top-0 z-10 flex items-center justify-end px-4 py-2 bg-background/90 backdrop-blur-sm border-b border-primary/20">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isCreate && props.isSaving}
            >
              {!isCreate && props.isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* ---- Identity (edit only) ---- */}
      {!isCreate && (
        <div className="border-b border-border">
          <div className="px-4 py-2 text-xs font-medium text-muted-foreground">Identity</div>
          <div className="px-4 pb-3 space-y-3">
            <Field label="Name" hint={help.name}>
              <DraftInput
                value={eff("identity", "name", props.agent.name)}
                onCommit={(v) => mark("identity", "name", v)}
                className={inputClass}
                placeholder="Agent name"
              />
            </Field>
            <Field label="Title" hint={help.title}>
              <DraftInput
                value={eff("identity", "title", props.agent.title ?? "")}
                onCommit={(v) => mark("identity", "title", v || null)}
                className={inputClass}
                placeholder="e.g. VP of Engineering"
              />
            </Field>
            <Field label="Capabilities" hint={help.capabilities}>
              <DraftTextarea
                value={eff("identity", "capabilities", props.agent.capabilities ?? "")}
                onCommit={(v) => mark("identity", "capabilities", v || null)}
                placeholder="Describe what this agent can do..."
                minRows={2}
              />
            </Field>
          </div>
        </div>
      )}

      {/* ---- Adapter type ---- */}
      <div className={cn("px-4 py-2.5", isCreate ? "border-t border-border" : "border-b border-border")}>
        <Field label="Adapter" hint={help.adapterType}>
          <AdapterTypeDropdown
            value={adapterType}
            onChange={(t) => {
              if (isCreate) {
                set!({ adapterType: t });
              } else {
                setOverlay((prev) => ({
                  ...prev,
                  adapterType: t,
                  adapterConfig: {}, // clear adapter config when type changes
                }));
              }
            }}
          />
        </Field>
      </div>

      {/* ---- Adapter Configuration ---- */}
      <div className={cn(isCreate ? "border-t border-border" : "border-b border-border")}>
        <div className="px-4 py-2 text-xs font-medium text-muted-foreground">
          Adapter Configuration
        </div>
        <div className="px-4 pb-3 space-y-3">
          {/* Working directory */}
          {isLocal && (
            <Field label="Working directory" hint={help.cwd}>
              <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <DraftInput
                  value={
                    isCreate
                      ? val!.cwd
                      : eff("adapterConfig", "cwd", String(config.cwd ?? ""))
                  }
                  onCommit={(v) =>
                    isCreate
                      ? set!({ cwd: v })
                      : mark("adapterConfig", "cwd", v || undefined)
                  }
                  immediate={isCreate}
                  className="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                  placeholder="/path/to/project"
                />
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0"
                  onClick={async () => {
                    try {
                      // @ts-expect-error -- showDirectoryPicker is not in all TS lib defs yet
                      const handle = await window.showDirectoryPicker({ mode: "read" });
                      if (isCreate) set!({ cwd: handle.name });
                      else mark("adapterConfig", "cwd", handle.name);
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

          {/* Prompt template */}
          {isLocal && (
            <Field label="Prompt template" hint={help.promptTemplate}>
              {isCreate ? (
                <AutoExpandTextarea
                  placeholder="You are agent {{ agent.name }}. Your role is {{ agent.role }}..."
                  value={val!.promptTemplate}
                  onChange={(v) => set!({ promptTemplate: v })}
                  minRows={4}
                />
              ) : (
                <DraftTextarea
                  value={eff(
                    "adapterConfig",
                    "promptTemplate",
                    String(config.promptTemplate ?? ""),
                  )}
                  onCommit={(v) =>
                    mark("adapterConfig", "promptTemplate", v || undefined)
                  }
                  placeholder="You are agent {{ agent.name }}. Your role is {{ agent.role }}..."
                  minRows={4}
                />
              )}
            </Field>
          )}

          {/* Claude-specific: Skip permissions */}
          {adapterType === "claude_local" && (
            <ToggleField
              label="Skip permissions"
              hint={help.dangerouslySkipPermissions}
              checked={
                isCreate
                  ? val!.dangerouslySkipPermissions
                  : eff(
                      "adapterConfig",
                      "dangerouslySkipPermissions",
                      config.dangerouslySkipPermissions !== false,
                    )
              }
              onChange={(v) =>
                isCreate
                  ? set!({ dangerouslySkipPermissions: v })
                  : mark("adapterConfig", "dangerouslySkipPermissions", v)
              }
            />
          )}

          {/* Codex-specific: Bypass sandbox + Search */}
          {adapterType === "codex_local" && (
            <>
              <ToggleField
                label="Bypass sandbox"
                hint={help.dangerouslyBypassSandbox}
                checked={
                  isCreate
                    ? val!.dangerouslyBypassSandbox
                    : eff(
                        "adapterConfig",
                        "dangerouslyBypassApprovalsAndSandbox",
                        config.dangerouslyBypassApprovalsAndSandbox !== false,
                      )
                }
                onChange={(v) =>
                  isCreate
                    ? set!({ dangerouslyBypassSandbox: v })
                    : mark("adapterConfig", "dangerouslyBypassApprovalsAndSandbox", v)
                }
              />
              <ToggleField
                label="Enable search"
                hint={help.search}
                checked={
                  isCreate
                    ? val!.search
                    : eff("adapterConfig", "search", !!config.search)
                }
                onChange={(v) =>
                  isCreate
                    ? set!({ search: v })
                    : mark("adapterConfig", "search", v)
                }
              />
            </>
          )}

          {/* Process-specific */}
          {adapterType === "process" && (
            <>
              <Field label="Command" hint={help.command}>
                <DraftInput
                  value={
                    isCreate
                      ? val!.command
                      : eff("adapterConfig", "command", String(config.command ?? ""))
                  }
                  onCommit={(v) =>
                    isCreate
                      ? set!({ command: v })
                      : mark("adapterConfig", "command", v || undefined)
                  }
                  immediate={isCreate}
                  className={inputClass}
                  placeholder="e.g. node, python"
                />
              </Field>
              <Field label="Args (comma-separated)" hint={help.args}>
                <DraftInput
                  value={
                    isCreate
                      ? val!.args
                      : eff("adapterConfig", "args", String(config.args ?? ""))
                  }
                  onCommit={(v) =>
                    isCreate
                      ? set!({ args: v })
                      : mark(
                          "adapterConfig",
                          "args",
                          v
                            ? v
                                .split(",")
                                .map((a) => a.trim())
                                .filter(Boolean)
                            : undefined,
                        )
                  }
                  immediate={isCreate}
                  className={inputClass}
                  placeholder="e.g. script.js, --flag"
                />
              </Field>
            </>
          )}

          {/* HTTP-specific */}
          {adapterType === "http" && (
            <Field label="Webhook URL" hint={help.webhookUrl}>
              <DraftInput
                value={
                  isCreate
                    ? val!.url
                    : eff("adapterConfig", "url", String(config.url ?? ""))
                }
                onCommit={(v) =>
                  isCreate
                    ? set!({ url: v })
                    : mark("adapterConfig", "url", v || undefined)
                }
                immediate={isCreate}
                className={inputClass}
                placeholder="https://..."
              />
            </Field>
          )}

          {/* Advanced adapter section — collapsible in both modes */}
          {isLocal && (
            <CollapsibleSection
              title="Advanced Adapter Settings"
              open={adapterAdvancedOpen}
              onToggle={() => setAdapterAdvancedOpen(!adapterAdvancedOpen)}
            >
              <div className="space-y-3">
                <ModelDropdown
                  models={models}
                  value={currentModelId}
                  onChange={(v) =>
                    isCreate
                      ? set!({ model: v })
                      : mark("adapterConfig", "model", v || undefined)
                  }
                  open={modelOpen}
                  onOpenChange={setModelOpen}
                />
                <Field label="Bootstrap prompt (first run)" hint={help.bootstrapPrompt}>
                  {isCreate ? (
                    <AutoExpandTextarea
                      placeholder="Optional initial setup prompt for the first run"
                      value={val!.bootstrapPrompt}
                      onChange={(v) => set!({ bootstrapPrompt: v })}
                      minRows={2}
                    />
                  ) : (
                    <DraftTextarea
                      value={eff(
                        "adapterConfig",
                        "bootstrapPromptTemplate",
                        String(config.bootstrapPromptTemplate ?? ""),
                      )}
                      onCommit={(v) =>
                        mark("adapterConfig", "bootstrapPromptTemplate", v || undefined)
                      }
                      placeholder="Optional initial setup prompt for the first run"
                      minRows={2}
                    />
                  )}
                </Field>
                {adapterType === "claude_local" && (
                  <Field label="Max turns per run" hint={help.maxTurnsPerRun}>
                    {isCreate ? (
                      <input
                        type="number"
                        className={inputClass}
                        value={val!.maxTurnsPerRun}
                        onChange={(e) => set!({ maxTurnsPerRun: Number(e.target.value) })}
                      />
                    ) : (
                      <DraftNumberInput
                        value={eff(
                          "adapterConfig",
                          "maxTurnsPerRun",
                          Number(config.maxTurnsPerRun ?? 80),
                        )}
                        onCommit={(v) => mark("adapterConfig", "maxTurnsPerRun", v || 80)}
                        className={inputClass}
                      />
                    )}
                  </Field>
                )}

                {/* Edit-only: timeout + grace period */}
                {!isCreate && (
                  <>
                    <Field label="Timeout (sec)" hint={help.timeoutSec}>
                      <DraftNumberInput
                        value={eff(
                          "adapterConfig",
                          "timeoutSec",
                          Number(config.timeoutSec ?? 0),
                        )}
                        onCommit={(v) => mark("adapterConfig", "timeoutSec", v)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Interrupt grace period (sec)" hint={help.graceSec}>
                      <DraftNumberInput
                        value={eff(
                          "adapterConfig",
                          "graceSec",
                          Number(config.graceSec ?? 15),
                        )}
                        onCommit={(v) => mark("adapterConfig", "graceSec", v)}
                        className={inputClass}
                      />
                    </Field>
                  </>
                )}
              </div>
            </CollapsibleSection>
          )}
        </div>
      </div>

      {/* ---- Heartbeat Policy ---- */}
      {isCreate ? (
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
              checked={val!.heartbeatEnabled}
              onCheckedChange={(v) => set!({ heartbeatEnabled: v })}
              number={val!.intervalSec}
              onNumberChange={(v) => set!({ intervalSec: v })}
              numberLabel="sec"
              numberPrefix="Run heartbeat every"
              numberHint={help.intervalSec}
              showNumber={val!.heartbeatEnabled}
            />
          </div>
        </CollapsibleSection>
      ) : (
        <div className="border-b border-border">
          <div className="px-4 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
            <Heart className="h-3 w-3" />
            Heartbeat Policy
          </div>
          <div className="px-4 pb-3 space-y-3">
            <ToggleWithNumber
              label="Heartbeat on interval"
              hint={help.heartbeatInterval}
              checked={eff("heartbeat", "enabled", heartbeat.enabled !== false)}
              onCheckedChange={(v) => mark("heartbeat", "enabled", v)}
              number={eff("heartbeat", "intervalSec", Number(heartbeat.intervalSec ?? 300))}
              onNumberChange={(v) => mark("heartbeat", "intervalSec", v)}
              numberLabel="sec"
              numberPrefix="Run heartbeat every"
              numberHint={help.intervalSec}
              showNumber={eff("heartbeat", "enabled", heartbeat.enabled !== false)}
            />

            {/* Edit-only: wake-on-* and cooldown */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                Advanced
              </div>
              <ToggleField
                label="Wake on assignment"
                hint={help.wakeOnAssignment}
                checked={eff(
                  "heartbeat",
                  "wakeOnAssignment",
                  heartbeat.wakeOnAssignment !== false,
                )}
                onChange={(v) => mark("heartbeat", "wakeOnAssignment", v)}
              />
              <ToggleField
                label="Wake on on-demand"
                hint={help.wakeOnOnDemand}
                checked={eff(
                  "heartbeat",
                  "wakeOnOnDemand",
                  heartbeat.wakeOnOnDemand !== false,
                )}
                onChange={(v) => mark("heartbeat", "wakeOnOnDemand", v)}
              />
              <ToggleField
                label="Wake on automation"
                hint={help.wakeOnAutomation}
                checked={eff(
                  "heartbeat",
                  "wakeOnAutomation",
                  heartbeat.wakeOnAutomation !== false,
                )}
                onChange={(v) => mark("heartbeat", "wakeOnAutomation", v)}
              />
              <Field label="Cooldown (sec)" hint={help.cooldownSec}>
                <DraftNumberInput
                  value={eff(
                    "heartbeat",
                    "cooldownSec",
                    Number(heartbeat.cooldownSec ?? 10),
                  )}
                  onCommit={(v) => mark("heartbeat", "cooldownSec", v)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* ---- Runtime (edit only) ---- */}
      {!isCreate && (
        <div className="border-b border-border">
          <div className="px-4 py-2 text-xs font-medium text-muted-foreground">Runtime</div>
          <div className="px-4 pb-3 space-y-3">
            <Field label="Context mode" hint={help.contextMode}>
              <div className="text-sm font-mono px-2.5 py-1.5">
                {props.agent.contextMode}
              </div>
            </Field>
            <Field label="Monthly budget (cents)" hint={help.budgetMonthlyCents}>
              <DraftNumberInput
                value={eff(
                  "runtime",
                  "budgetMonthlyCents",
                  props.agent.budgetMonthlyCents,
                )}
                onCommit={(v) => mark("runtime", "budgetMonthlyCents", v)}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Internal sub-components ---- */

function AdapterTypeDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (type: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent/50 transition-colors w-full justify-between">
          <span>{adapterLabels[value] ?? value}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
        {AGENT_ADAPTER_TYPES.map((t) => (
          <button
            key={t}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
              t === value && "bg-accent",
            )}
            onClick={() => onChange(t)}
          >
            {adapterLabels[t] ?? t}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ModelDropdown({
  models,
  value,
  onChange,
  open,
  onOpenChange,
}: {
  models: AdapterModel[];
  value: string;
  onChange: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const selected = models.find((m) => m.id === value);

  return (
    <Field label="Model" hint={help.model}>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent/50 transition-colors w-full justify-between">
            <span className={cn(!value && "text-muted-foreground")}>
              {selected ? selected.label : value || "Default"}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
          <button
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
              !value && "bg-accent",
            )}
            onClick={() => {
              onChange("");
              onOpenChange(false);
            }}
          >
            Default
          </button>
          {models.map((m) => (
            <button
              key={m.id}
              className={cn(
                "flex items-center justify-between w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
                m.id === value && "bg-accent",
              )}
              onClick={() => {
                onChange(m.id);
                onOpenChange(false);
              }}
            >
              <span>{m.label}</span>
              <span className="text-xs text-muted-foreground font-mono">{m.id}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </Field>
  );
}
