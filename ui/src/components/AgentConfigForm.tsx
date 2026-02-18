import { useState, useEffect, useRef, useMemo } from "react";
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
import { getUIAdapter } from "../adapters";
import { ClaudeLocalAdvancedFields } from "../adapters/claude-local/config-fields";

/* ---- Create mode values ---- */

// Canonical type lives in @paperclip/adapter-utils; re-exported here
// so existing imports from this file keep working.
export type { CreateConfigValues } from "@paperclip/adapter-utils";
import type { CreateConfigValues } from "@paperclip/adapter-utils";

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
  extraArgs: "",
  envVars: "",
  url: "",
  bootstrapPrompt: "",
  maxTurnsPerRun: 80,
  heartbeatEnabled: false,
  intervalSec: 300,
};

/* ---- Props ---- */

type AgentConfigFormProps = {
  adapterModels?: AdapterModel[];
  onDirtyChange?: (dirty: boolean) => void;
  onSaveActionChange?: (save: (() => void) | null) => void;
  onCancelActionChange?: (cancel: (() => void) | null) => void;
  hideInlineSave?: boolean;
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

function parseCommaArgs(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatArgList(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .join(", ");
  }
  return typeof value === "string" ? value : "";
}

function parseEnvVars(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    env[key] = value;
  }
  return env;
}

function formatEnvVars(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => `${k}=${String(v)}`)
    .join("\n");
}

function extractPickedDirectoryPath(handle: unknown): string | null {
  if (typeof handle !== "object" || handle === null) return null;
  const maybePath = (handle as { path?: unknown }).path;
  return typeof maybePath === "string" && maybePath.length > 0 ? maybePath : null;
}

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

  useEffect(() => {
    if (!isCreate) {
      props.onDirtyChange?.(isDirty);
      props.onSaveActionChange?.(() => handleSave());
      props.onCancelActionChange?.(() => setOverlay({ ...emptyOverlay }));
      return () => {
        props.onSaveActionChange?.(null);
        props.onCancelActionChange?.(null);
        props.onDirtyChange?.(false);
      };
    }
    return;
  }, [isCreate, isDirty, props.onDirtyChange, props.onSaveActionChange, props.onCancelActionChange, overlay]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Resolve values ----
  const config = !isCreate ? ((props.agent.adapterConfig ?? {}) as Record<string, unknown>) : {};
  const runtimeConfig = !isCreate ? ((props.agent.runtimeConfig ?? {}) as Record<string, unknown>) : {};
  const heartbeat = !isCreate ? ((runtimeConfig.heartbeat ?? {}) as Record<string, unknown>) : {};

  const adapterType = isCreate
    ? props.values.adapterType
    : overlay.adapterType ?? props.agent.adapterType;
  const isLocal = adapterType === "claude_local" || adapterType === "codex_local";
  const uiAdapter = useMemo(() => getUIAdapter(adapterType), [adapterType]);

  // Fetch adapter models for the effective adapter type
  const { data: fetchedModels } = useQuery({
    queryKey: ["adapter-models", adapterType],
    queryFn: () => agentsApi.adapterModels(adapterType),
  });
  const models = fetchedModels ?? externalModels ?? [];

  /** Props passed to adapter-specific config field components */
  const adapterFieldProps = {
    mode,
    isCreate,
    adapterType,
    values: isCreate ? props.values : null,
    set: isCreate ? (patch: Partial<CreateConfigValues>) => props.onChange(patch) : null,
    config,
    eff: eff as <T>(group: "adapterConfig", field: string, original: T) => T,
    mark: mark as (group: "adapterConfig", field: string, value: unknown) => void,
    models,
  };

  // Section toggle state — advanced always starts collapsed
  const [adapterAdvancedOpen, setAdapterAdvancedOpen] = useState(false);
  const [heartbeatOpen, setHeartbeatOpen] = useState(!isCreate);
  const [cwdPickerNotice, setCwdPickerNotice] = useState<string | null>(null);

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
      {isDirty && !props.hideInlineSave && (
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
                immediate
                className={inputClass}
                placeholder="Agent name"
              />
            </Field>
            <Field label="Title" hint={help.title}>
              <DraftInput
                value={eff("identity", "title", props.agent.title ?? "")}
                onCommit={(v) => mark("identity", "title", v || null)}
                immediate
                className={inputClass}
                placeholder="e.g. VP of Engineering"
              />
            </Field>
            <Field label="Capabilities" hint={help.capabilities}>
              <DraftTextarea
                value={eff("identity", "capabilities", props.agent.capabilities ?? "")}
                onCommit={(v) => mark("identity", "capabilities", v || null)}
                immediate
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
                  immediate
                  className="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40"
                  placeholder="/path/to/project"
                />
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0"
                  onClick={async () => {
                    try {
                      setCwdPickerNotice(null);
                      // @ts-expect-error -- showDirectoryPicker is not in all TS lib defs yet
                      const handle = await window.showDirectoryPicker({ mode: "read" });
                      const absolutePath = extractPickedDirectoryPath(handle);
                      if (absolutePath) {
                        if (isCreate) set!({ cwd: absolutePath });
                        else mark("adapterConfig", "cwd", absolutePath);
                        return;
                      }
                      const selectedName =
                        typeof handle === "object" &&
                        handle !== null &&
                        typeof (handle as { name?: unknown }).name === "string"
                          ? String((handle as { name: string }).name)
                          : "selected folder";
                      setCwdPickerNotice(
                        `Directory picker only exposed "${selectedName}". Paste the absolute path manually.`,
                      );
                    } catch {
                      // user cancelled or API unsupported
                    }
                  }}
                >
                  Choose
                </button>
              </div>
              {cwdPickerNotice && (
                <p className="mt-1 text-xs text-amber-400">{cwdPickerNotice}</p>
              )}
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
                  immediate
                  placeholder="You are agent {{ agent.name }}. Your role is {{ agent.role }}..."
                  minRows={4}
                />
              )}
            </Field>
          )}

          {/* Adapter-specific fields */}
          <uiAdapter.ConfigFields {...adapterFieldProps} />

          {/* Advanced adapter section — collapsible in both modes */}
          {isLocal && (
            <CollapsibleSection
              title="Advanced Adapter Settings"
              open={adapterAdvancedOpen}
              onToggle={() => setAdapterAdvancedOpen(!adapterAdvancedOpen)}
            >
              <div className="space-y-3">
                <Field label="Command" hint={help.localCommand}>
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
                    immediate
                    className={inputClass}
                    placeholder={adapterType === "codex_local" ? "codex" : "claude"}
                  />
                </Field>

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
                      immediate
                      placeholder="Optional initial setup prompt for the first run"
                      minRows={2}
                    />
                  )}
                </Field>
                {adapterType === "claude_local" && (
                  <ClaudeLocalAdvancedFields {...adapterFieldProps} />
                )}

                <Field label="Extra args (comma-separated)" hint={help.extraArgs}>
                  <DraftInput
                    value={
                      isCreate
                        ? val!.extraArgs
                        : eff("adapterConfig", "extraArgs", formatArgList(config.extraArgs))
                    }
                    onCommit={(v) =>
                      isCreate
                        ? set!({ extraArgs: v })
                        : mark("adapterConfig", "extraArgs", v ? parseCommaArgs(v) : undefined)
                    }
                    immediate
                    className={inputClass}
                    placeholder="e.g. --verbose, --foo=bar"
                  />
                </Field>

                <Field label="Environment variables" hint={help.envVars}>
                  {isCreate ? (
                    <AutoExpandTextarea
                      placeholder={"ANTHROPIC_API_KEY=...\nPAPERCLIP_API_URL=http://localhost:3100"}
                      value={val!.envVars}
                      onChange={(v) => set!({ envVars: v })}
                      minRows={3}
                    />
                  ) : (
                    <DraftTextarea
                      value={eff("adapterConfig", "env", formatEnvVars(config.env))}
                      onCommit={(v) => {
                        const parsed = parseEnvVars(v);
                        mark(
                          "adapterConfig",
                          "env",
                          Object.keys(parsed).length > 0 ? parsed : undefined,
                        );
                      }}
                      immediate
                      placeholder={"ANTHROPIC_API_KEY=...\nPAPERCLIP_API_URL=http://localhost:3100"}
                      minRows={3}
                    />
                  )}
                </Field>

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
                        immediate
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
                        immediate
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
                label="Wake on demand"
                hint={help.wakeOnDemand}
                checked={eff(
                  "heartbeat",
                  "wakeOnDemand",
                  heartbeat.wakeOnDemand !== false,
                )}
                onChange={(v) => mark("heartbeat", "wakeOnDemand", v)}
              />
              <Field label="Cooldown (sec)" hint={help.cooldownSec}>
                <DraftNumberInput
                  value={eff(
                    "heartbeat",
                    "cooldownSec",
                    Number(heartbeat.cooldownSec ?? 10),
                  )}
                  onCommit={(v) => mark("heartbeat", "cooldownSec", v)}
                  immediate
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
            <Field label="Monthly budget (cents)" hint={help.budgetMonthlyCents}>
              <DraftNumberInput
                value={eff(
                  "runtime",
                  "budgetMonthlyCents",
                  props.agent.budgetMonthlyCents,
                )}
                onCommit={(v) => mark("runtime", "budgetMonthlyCents", v)}
                immediate
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
