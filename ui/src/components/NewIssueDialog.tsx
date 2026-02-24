import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { agentsApi } from "../api/agents";
import { assetsApi } from "../api/assets";
import { queryKeys } from "../lib/queryKeys";
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
  MoreHorizontal,
  CircleDot,
  Minus,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  User,
  Hexagon,
  Tag,
  Calendar,
} from "lucide-react";
import { cn } from "../lib/utils";
import { issueStatusText, issueStatusTextDefault, priorityColor, priorityColorDefault } from "../lib/status-colors";
import { MarkdownEditor, type MarkdownEditorRef } from "./MarkdownEditor";
import { AgentIcon } from "./AgentIconPicker";
import type { Project, Agent } from "@paperclip/shared";

const DRAFT_KEY = "paperclip:issue-draft";
const DEBOUNCE_MS = 800;

interface IssueDraft {
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string;
  projectId: string;
}

function loadDraft(): IssueDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IssueDraft;
  } catch {
    return null;
  }
}

function saveDraft(draft: IssueDraft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

const statuses = [
  { value: "backlog", label: "Backlog", color: issueStatusText.backlog ?? issueStatusTextDefault },
  { value: "todo", label: "Todo", color: issueStatusText.todo ?? issueStatusTextDefault },
  { value: "in_progress", label: "In Progress", color: issueStatusText.in_progress ?? issueStatusTextDefault },
  { value: "in_review", label: "In Review", color: issueStatusText.in_review ?? issueStatusTextDefault },
  { value: "done", label: "Done", color: issueStatusText.done ?? issueStatusTextDefault },
];

const priorities = [
  { value: "critical", label: "Critical", icon: AlertTriangle, color: priorityColor.critical ?? priorityColorDefault },
  { value: "high", label: "High", icon: ArrowUp, color: priorityColor.high ?? priorityColorDefault },
  { value: "medium", label: "Medium", icon: Minus, color: priorityColor.medium ?? priorityColorDefault },
  { value: "low", label: "Low", icon: ArrowDown, color: priorityColor.low ?? priorityColorDefault },
];

export function NewIssueDialog() {
  const { newIssueOpen, newIssueDefaults, closeNewIssue } = useDialog();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [expanded, setExpanded] = useState(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Popover states
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const descriptionEditorRef = useRef<MarkdownEditorRef>(null);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && newIssueOpen,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && newIssueOpen,
  });

  const createIssue = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      issuesApi.create(selectedCompanyId!, data),
    onSuccess: (issue) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
      if (draftTimer.current) clearTimeout(draftTimer.current);
      clearDraft();
      reset();
      closeNewIssue();
      pushToast({
        dedupeKey: `activity:issue.created:${issue.id}`,
        title: `${issue.identifier ?? "Issue"} created`,
        body: issue.title,
        tone: "success",
        action: { label: `View ${issue.identifier ?? "issue"}`, href: `/issues/${issue.identifier ?? issue.id}` },
      });
    },
  });

  const uploadDescriptionImage = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedCompanyId) throw new Error("No company selected");
      return assetsApi.uploadImage(selectedCompanyId, file, "issues/drafts");
    },
  });

  // Debounced draft saving
  const scheduleSave = useCallback(
    (draft: IssueDraft) => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(() => {
        if (draft.title.trim()) saveDraft(draft);
      }, DEBOUNCE_MS);
    },
    [],
  );

  // Save draft on meaningful changes
  useEffect(() => {
    if (!newIssueOpen) return;
    scheduleSave({ title, description, status, priority, assigneeId, projectId });
  }, [title, description, status, priority, assigneeId, projectId, newIssueOpen, scheduleSave]);

  // Restore draft or apply defaults when dialog opens
  useEffect(() => {
    if (!newIssueOpen) return;

    const draft = loadDraft();
    if (draft && draft.title.trim()) {
      setTitle(draft.title);
      setDescription(draft.description);
      setStatus(draft.status || "todo");
      setPriority(draft.priority);
      setAssigneeId(newIssueDefaults.assigneeAgentId ?? draft.assigneeId);
      setProjectId(newIssueDefaults.projectId ?? draft.projectId);
    } else {
      setStatus(newIssueDefaults.status ?? "todo");
      setPriority(newIssueDefaults.priority ?? "");
      setProjectId(newIssueDefaults.projectId ?? "");
      setAssigneeId(newIssueDefaults.assigneeAgentId ?? "");
    }
  }, [newIssueOpen, newIssueDefaults]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, []);

  function reset() {
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("");
    setAssigneeId("");
    setProjectId("");
    setExpanded(false);
  }

  function discardDraft() {
    clearDraft();
    reset();
    closeNewIssue();
  }

  function handleSubmit() {
    if (!selectedCompanyId || !title.trim()) return;
    createIssue.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority: priority || "medium",
      ...(assigneeId ? { assigneeAgentId: assigneeId } : {}),
      ...(projectId ? { projectId } : {}),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const hasDraft = title.trim().length > 0 || description.trim().length > 0;
  const currentStatus = statuses.find((s) => s.value === status) ?? statuses[1]!;
  const currentPriority = priorities.find((p) => p.value === priority);
  const currentAssignee = (agents ?? []).find((a) => a.id === assigneeId);
  const currentProject = (projects ?? []).find((p) => p.id === projectId);

  return (
    <Dialog
      open={newIssueOpen}
      onOpenChange={(open) => {
        if (!open) closeNewIssue();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className={cn(
          "p-0 gap-0 flex flex-col max-h-[calc(100vh-6rem)]",
          expanded
            ? "sm:max-w-2xl h-[calc(100vh-6rem)]"
            : "sm:max-w-lg"
        )}
        onKeyDown={handleKeyDown}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {selectedCompany && (
              <span className="bg-muted px-1.5 py-0.5 rounded text-xs font-medium">
                {selectedCompany.name.slice(0, 3).toUpperCase()}
              </span>
            )}
            <span className="text-muted-foreground/60">&rsaquo;</span>
            <span>New issue</span>
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
              onClick={() => closeNewIssue()}
            >
              <span className="text-lg leading-none">&times;</span>
            </Button>
          </div>
        </div>

        {/* Title */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <input
            className="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
            placeholder="Issue title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                descriptionEditorRef.current?.focus();
              }
            }}
            autoFocus
          />
        </div>

        {/* Description */}
        <div className={cn("px-4 pb-2 overflow-y-auto min-h-0", expanded ? "flex-1" : "")}>
          <MarkdownEditor
            ref={descriptionEditorRef}
            value={description}
            onChange={setDescription}
            placeholder="Add description..."
            bordered={false}
            contentClassName={cn("text-sm text-muted-foreground", expanded ? "min-h-[220px]" : "min-h-[120px]")}
            imageUploadHandler={async (file) => {
              const asset = await uploadDescriptionImage.mutateAsync(file);
              return asset.contentPath;
            }}
          />
        </div>

        {/* Property chips bar */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-border flex-wrap shrink-0">
          {/* Status chip */}
          <Popover open={statusOpen} onOpenChange={setStatusOpen}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
                <CircleDot className={cn("h-3 w-3", currentStatus.color)} />
                {currentStatus.label}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-1" align="start">
              {statuses.map((s) => (
                <button
                  key={s.value}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    s.value === status && "bg-accent"
                  )}
                  onClick={() => { setStatus(s.value); setStatusOpen(false); }}
                >
                  <CircleDot className={cn("h-3 w-3", s.color)} />
                  {s.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Priority chip */}
          <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
                {currentPriority ? (
                  <>
                    <currentPriority.icon className={cn("h-3 w-3", currentPriority.color)} />
                    {currentPriority.label}
                  </>
                ) : (
                  <>
                    <Minus className="h-3 w-3 text-muted-foreground" />
                    Priority
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-1" align="start">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    p.value === priority && "bg-accent"
                  )}
                  onClick={() => { setPriority(p.value); setPriorityOpen(false); }}
                >
                  <p.icon className={cn("h-3 w-3", p.color)} />
                  {p.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Assignee chip */}
          <Popover open={assigneeOpen} onOpenChange={(open) => { setAssigneeOpen(open); if (!open) setAssigneeSearch(""); }}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
                {currentAssignee ? (
                  <>
                    <AgentIcon icon={currentAssignee.icon} className="h-3 w-3 text-muted-foreground" />
                    {currentAssignee.name}
                  </>
                ) : (
                  <>
                    <User className="h-3 w-3 text-muted-foreground" />
                    Assignee
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1" align="start">
              <input
                className="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
                placeholder="Search agents..."
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
                autoFocus
              />
              <div className="max-h-48 overflow-y-auto overscroll-contain">
                <button
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    !assigneeId && "bg-accent"
                  )}
                  onClick={() => { setAssigneeId(""); setAssigneeOpen(false); }}
                >
                  No assignee
                </button>
                {(agents ?? [])
                  .filter((a) => a.status !== "terminated")
                  .filter((a) => {
                    if (!assigneeSearch.trim()) return true;
                    const q = assigneeSearch.toLowerCase();
                    return a.name.toLowerCase().includes(q);
                  })
                  .map((a) => (
                  <button
                    key={a.id}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                      a.id === assigneeId && "bg-accent"
                    )}
                    onClick={() => { setAssigneeId(a.id); setAssigneeOpen(false); }}
                  >
                    <AgentIcon icon={a.icon} className="shrink-0 h-3 w-3 text-muted-foreground" />
                    {a.name}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Project chip */}
          <Popover open={projectOpen} onOpenChange={setProjectOpen}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
                {currentProject ? (
                  <>
                    <span
                      className="shrink-0 h-3 w-3 rounded-sm"
                      style={{ backgroundColor: currentProject.color ?? "#6366f1" }}
                    />
                    {currentProject.name}
                  </>
                ) : (
                  <>
                    <Hexagon className="h-3 w-3 text-muted-foreground" />
                    Project
                  </>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-fit min-w-[11rem] p-1" align="start">
              <div className="max-h-48 overflow-y-auto overscroll-contain">
                <button
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 whitespace-nowrap",
                    !projectId && "bg-accent"
                  )}
                  onClick={() => { setProjectId(""); setProjectOpen(false); }}
                >
                  No project
                </button>
                {(projects ?? []).map((p) => (
                  <button
                    key={p.id}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 whitespace-nowrap",
                      p.id === projectId && "bg-accent"
                    )}
                    onClick={() => { setProjectId(p.id); setProjectOpen(false); }}
                  >
                    <span
                      className="shrink-0 h-3 w-3 rounded-sm"
                      style={{ backgroundColor: p.color ?? "#6366f1" }}
                    />
                    {p.name}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Labels chip (placeholder) */}
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors text-muted-foreground">
            <Tag className="h-3 w-3" />
            Labels
          </button>

          {/* More (dates) */}
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center justify-center rounded-md border border-border p-1 text-xs hover:bg-accent/50 transition-colors text-muted-foreground">
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" align="start">
              <button className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Start date
              </button>
              <button className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Due date
              </button>
            </PopoverContent>
          </Popover>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={discardDraft}
            disabled={!hasDraft && !loadDraft()}
          >
            Discard Draft
          </Button>
          <Button
            size="sm"
            disabled={!title.trim() || createIssue.isPending}
            onClick={handleSubmit}
          >
            {createIssue.isPending ? "Creating..." : "Create Issue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
