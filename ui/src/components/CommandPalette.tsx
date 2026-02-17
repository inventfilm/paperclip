import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../context/CompanyContext";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CircleDot, Bot, Hexagon, Target, LayoutDashboard, Inbox } from "lucide-react";
import type { Issue, Agent, Project } from "@paperclip/shared";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedCompanyId) return;
    const [i, a, p] = await Promise.all([
      issuesApi.list(selectedCompanyId).catch(() => []),
      agentsApi.list(selectedCompanyId).catch(() => []),
      projectsApi.list(selectedCompanyId).catch(() => []),
    ]);
    setIssues(i);
    setAgents(a);
    setProjects(p);
  }, [selectedCompanyId]);

  useEffect(() => {
    if (open) {
      void loadData();
    }
  }, [open, loadData]);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search issues, agents, projects..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => go("/")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/inbox")}>
            <Inbox className="mr-2 h-4 w-4" />
            Inbox
          </CommandItem>
          <CommandItem onSelect={() => go("/tasks")}>
            <CircleDot className="mr-2 h-4 w-4" />
            Issues
          </CommandItem>
          <CommandItem onSelect={() => go("/projects")}>
            <Hexagon className="mr-2 h-4 w-4" />
            Projects
          </CommandItem>
          <CommandItem onSelect={() => go("/goals")}>
            <Target className="mr-2 h-4 w-4" />
            Goals
          </CommandItem>
          <CommandItem onSelect={() => go("/agents")}>
            <Bot className="mr-2 h-4 w-4" />
            Agents
          </CommandItem>
        </CommandGroup>

        {issues.length > 0 && (
          <CommandGroup heading="Issues">
            {issues.slice(0, 10).map((issue) => (
              <CommandItem key={issue.id} onSelect={() => go(`/issues/${issue.id}`)}>
                <CircleDot className="mr-2 h-4 w-4" />
                <span className="text-muted-foreground mr-2 font-mono text-xs">
                  {issue.id.slice(0, 8)}
                </span>
                {issue.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {agents.length > 0 && (
          <CommandGroup heading="Agents">
            {agents.slice(0, 10).map((agent) => (
              <CommandItem key={agent.id} onSelect={() => go(`/agents/${agent.id}`)}>
                <Bot className="mr-2 h-4 w-4" />
                {agent.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.slice(0, 10).map((project) => (
              <CommandItem key={project.id} onSelect={() => go(`/projects/${project.id}`)}>
                <Hexagon className="mr-2 h-4 w-4" />
                {project.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
