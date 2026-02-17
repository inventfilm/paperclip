# Paperclip Specification

Target specification for the Paperclip control plane. Living document — updated incrementally during spec interviews.

---

## 1. Company Model [DRAFT]

A company is a first-order object. One Paperclip instance runs multiple companies.

### Fields (Draft)

| Field       | Type          | Notes                             |
| ----------- | ------------- | --------------------------------- |
| `id`        | uuid          | Primary key                       |
| `name`      | string        | Company name                      |
| `goal`      | text/markdown | The company's top-level objective |
| `createdAt` | timestamp     |                                   |
| `updatedAt` | timestamp     |                                   |

### Board Governance [DRAFT]

Every company has a **board** that governs high-impact decisions. The board is the human oversight layer.

**V1: Single human board.** One human operator.

#### Board Approval Gates (V1)

- New agent hires (creating new agents)
- CEO's initial strategic breakdown (CEO proposes, board approves before execution begins)
- [TBD: other governance-gated actions — budget changes, goal changes, firing agents?]

#### Board Powers (Always Available)

The board has **unrestricted access** to the entire system at all times:

- **Pause/resume any agent** — stop an agent's heartbeat immediately
- **Pause/resume any work item** — pause a task, project, subtask tree, milestone. Paused items are not picked up by agents.
- **Full project management access** — create, edit, comment on, modify, delete, reassign any task/project/milestone through the UI
- **Override any agent decision** — reassign tasks, change priorities, modify descriptions

The board is not just an approval gate — it's a live control surface. The human can intervene at any level at any time.

**Future governance models** (not V1):

- Hiring budgets (auto-approve hires within $X/month)
- Multi-member boards
- Delegated authority (CEO can hire within limits)

### Open Questions

- Revenue/expense tracking — plugin for later, not V1
- Company-level settings and configuration?
- Company lifecycle (pause, archive, delete)?
- What governance-gated actions exist beyond hiring and CEO strategy approval?

---

## 2. Agent Model [DRAFT]

Every employee is an agent. Agents are the workforce.

### Agent Identity (Adapter-Level)

Concepts like SOUL.md (identity/mission) and HEARTBEAT.md (loop definition) are **not part of the Paperclip protocol**. They are adapter-specific configurations. For example, an OpenClaw adapter might use SOUL.md and HEARTBEAT.md files. A Claude Code adapter might use CLAUDE.md. A bare Python script might use command-line args.

Paperclip doesn't prescribe how an agent defines its identity or behavior. It provides the control plane; the adapter defines the agent's inner workings.

### Agent Configuration [DRAFT]

Each agent has an **adapter type** and an **adapter-specific configuration blob**. The adapter defines what config fields exist.

#### Paperclip Protocol (What Paperclip Knows)

At the protocol level, Paperclip tracks:

- Agent identity (id, name, role, title)
- Org position (who they report to, who reports to them)
- Adapter type + adapter config
- Status (active, paused, terminated)
- Cost tracking data (if the agent reports it)

#### Adapter Configuration (Agent-Specific)

Each adapter type defines its own config schema. Examples:

- **OpenClaw adapter**: SOUL.md content, HEARTBEAT.md content, OpenClaw-specific settings
- **Process adapter**: command to run, environment variables, working directory
- **HTTP adapter**: endpoint URL, auth headers, payload template

#### Exportable Org Configs

A key goal: **the entire org's agent configurations are exportable.** You can export a company's complete agent setup — every agent, their adapter configs, org structure — as a portable artifact. This enables:

- Sharing company templates ("here's a pre-built marketing agency org")
- Version controlling your company configuration
- Duplicating/forking companies

#### Context Delivery

Configurable per agent. Two ends of the spectrum:

- **Fat payload** — Paperclip bundles relevant context (current tasks, messages, company state, metrics) into the heartbeat invocation. Suited for simple/stateless agents that can't call back to Paperclip.
- **Thin ping** — Heartbeat is just a wake-up signal. Agent calls Paperclip's API to fetch whatever context it needs. Suited for sophisticated agents that manage their own state.

#### Minimum Contract

The minimum requirement to be a Paperclip agent: **be callable.** That's it. Paperclip can invoke you via command or webhook. No requirement to report back — Paperclip infers basic status from process liveness when it can.

#### Integration Levels

Beyond the minimum, Paperclip provides progressively richer integration:

1. **Callable** (minimum) — Paperclip can start you. That's the only contract.
2. **Status reporting** — Agent reports back success/failure/in-progress after execution.
3. **Fully instrumented** — Agent reports status, cost/token usage, task updates, and logs. Bidirectional integration with the control plane.

Paperclip ships **default agents** that demonstrate full integration: progress tracking, cost instrumentation, and a **Paperclip skill** (a Claude Code skill for interacting with the Paperclip API) for task management. These serve as both useful defaults and reference implementations for adapter authors.

#### Export Formats

Two export modes:

1. **Template export** (default) — structure only: agent definitions, org chart, adapter configs, role descriptions. Optionally includes a few seed tasks to help get started. This is the blueprint for spinning up a new company.
2. **Snapshot export** — full state: structure + current tasks, progress, agent status. A complete picture you could restore or fork.

The usual workflow: export a template, create a new company from it, add a couple initial tasks, go.

---

## 3. Org Structure [DRAFT]

Hierarchical reporting structure. CEO at top, reports cascade down.

### Agent Visibility

**Full visibility across the org.** Every agent can see the entire org chart, all tasks, all agents. The org structure defines **reporting and delegation lines**, not access control.

Each agent publishes a short description of their responsibilities and capabilities — almost like skills ("when I'm relevant"). This lets other agents discover who can help with what.

### Cross-Team Work

Agents can create tasks and assign them to agents outside their reporting line. This is the mechanism for cross-team collaboration. These rules are primarily encoded in the Paperclip SKILL.md which is recommended for all agents. Paperclip the app enforces the tooling and some light governance, but the cross-team rules below are mainly implemented by agent decisions.

#### Task Acceptance Rules

When an agent receives a task from outside their team:

1. **Agrees it's appropriate + can do it** → complete it directly
2. **Agrees it's appropriate + can't do it** → mark as blocked
3. **Questions whether it's worth doing** → **cannot cancel it themselves.** Must reassign to their own manager, explain the situation. Manager decides whether to accept, reassign, or escalate.

#### Manager Escalation Protocol

It's any manager's responsibility to understand why their subordinates are blocked and resolve it:

0. **Decide** — as a manager, is this work worth doing?
1. **Delegate down** — ask someone under them to help unblock
2. **Escalate up** — ask the manager above them for help

#### Request Depth Tracking

When a task originates from a cross-team request, track the **depth** as an integer — how many delegation hops from the original requester. This provides visibility into how far work cascades through the org.

#### Billing Codes

Tasks carry a **billing code** so that token spend during execution can be attributed upstream to the requesting task/agent. When Agent A asks Agent B to do work, the cost of B's work is tracked against A's request. This enables cost attribution across the org.

### Open Questions

- Is this a strict tree or can agents report to multiple managers?
- Can org structure change at runtime? (agents reassigned, teams restructured)
- Do agents inherit any configuration from their manager?
- Billing code format — simple string? Hierarchical?

---

## 4. Heartbeat System [DRAFT]

The heartbeat is a protocol, not a runtime. Paperclip defines how to initiate an agent's cycle. What the agent does with that cycle — how long it runs, whether it's task-scoped or continuous — is entirely up to the agent.

### Execution Adapters

Agent configuration includes an **adapter** that defines how Paperclip invokes the agent. Initial adapters:

| Adapter   | Mechanism               | Example                                       |
| --------- | ----------------------- | --------------------------------------------- |
| `process` | Execute a child process | `python run_agent.py --agent-id {id}`         |
| `http`    | Send an HTTP request    | `POST https://openclaw.example.com/hook/{id}` |

More adapters can be added.

### Adapter Interface

Every adapter implements three methods:

```
invoke(agentConfig, context?) → void     // Start the agent's cycle
status(agentConfig) → AgentStatus        // Is it running? finished? errored?
cancel(agentConfig) → void               // Graceful stop signal (for pause/resume)
```

This is the full adapter contract. `invoke` starts the agent, `status` lets Paperclip check on it, `cancel` enables the board's pause functionality. Everything else (cost reporting, task updates) is optional and flows through the Paperclip REST API.

### What Paperclip Controls

- **When** to fire the heartbeat (schedule/frequency, per-agent)
- **How** to fire it (adapter selection + config)
- **What context** to include (thin ping vs. fat payload, per-agent)

### What Paperclip Does NOT Control

- How long the agent runs
- What the agent does during its cycle
- Whether the agent is task-scoped, time-windowed, or continuous

### Pause Behavior

When the board (or system) pauses an agent:

1. **Signal the current execution** — send a graceful termination signal to the running process/session
2. **Grace period** — give the agent time to wrap up, save state, report final status
3. **Force-kill after timeout** — if the agent doesn't stop within the grace period, terminate
4. **Stop future heartbeats** — no new heartbeat cycles will fire until the agent is resumed

This is "graceful signal + stop future heartbeats." The current run gets a chance to land cleanly.

### Open Questions

- Heartbeat frequency — who controls it? Fixed? Per-agent? Cron-like?
- What happens when a heartbeat invocation fails? (process crashes, HTTP 500)
- Health monitoring — how does Paperclip distinguish "stuck" from "working on a long task"?
- Can agents self-trigger their next heartbeat? ("I'm done, wake me again in 5 min")
- Grace period duration — fixed? configurable per agent?

---

## 5. Inter-Agent Communication [DRAFT]

All agent communication flows through the **task system**.

### Model: Tasks + Comments

- **Delegation** = creating a task and assigning it to another agent
- **Coordination** = commenting on tasks
- **Status updates** = updating task status and fields

There is no separate messaging or chat system. Tasks are the communication channel. This keeps all context attached to the work it relates to and creates a natural audit trail.

### Implications

- An agent's "inbox" is: tasks assigned to them + comments on tasks they're involved in
- The CEO delegates by creating tasks assigned to the CTO
- The CTO breaks those down into sub-tasks assigned to engineers
- Discussion happens in task comments, not a side channel
- If an agent needs to escalate, they comment on the parent task or reassign

### Task Hierarchy Mapping

Full hierarchy: **Initiative** (company goal) → Projects → Milestones → Issues → Sub-issues. Everything traces back to an initiative, and the "company goal" is just the first/primary initiative.

---

## 6. Cost Tracking [DRAFT]

### Cost Reporting

Fully-instrumented agents report token/API usage back to Paperclip. Costs are tracked at every level:

- **Per agent** — how much is this employee costing?
- **Per task** — how much did this unit of work cost?
- **Per project** — how much is this deliverable costing?
- **Per company** — total burn rate

Costs should be denominated in both **tokens and dollars**.

Billing codes on tasks (see Org Structure) enable cost attribution across teams — when Agent A requests work from Agent B, B's costs roll up to A's request.

### Budget Controls

Three tiers:

1. **Visibility** — dashboards showing spend at every level (agent, task, project, company)
2. **Soft alerts** — configurable thresholds (e.g. warn at 80% of budget)
3. **Hard ceiling** — auto-pause the agent when budget is hit. Board notified. Board can override/raise the limit.

Budgets can be set to **unlimited** (no ceiling).

### Open Questions

- Cost reporting API — what's the schema for an agent to report costs?
- Dashboard design — what metrics matter most at each level?
- Budget period — per-day? per-week? per-month? rolling?

---

## 7. Default Agents & Bootstrap Flow [DRAFT]

### Bootstrap Sequence

How a company goes from "created" to "running":

1. Human creates a company with a goal
2. Human defines initial top-level tasks/initiatives
3. Human creates the CEO agent (using the default CEO template or custom)
4. CEO's first heartbeat: reviews the goal and tasks, proposes a strategic breakdown (org structure, sub-tasks, hiring plan)
5. **Board approves** the CEO's strategic plan
6. CEO begins execution — creating tasks, proposing hires (board-approved), delegating

### Default Agents

Paperclip ships default agent templates:

- **Default agent** — a basic Claude Code or Codex loop. Knows the **Paperclip skill** (SKILL.md) so it can interact with the task system, read company context, report status.
- **Default CEO** — extends the default agent with CEO-specific behavior: strategic planning, delegation to reports, progress review, board communication.

These are starting points. Users can customize or replace them entirely.

### Default Agent Behavior

The default agent's loop is **config-driven**. The adapter config contains the instructions that define what the agent does on each heartbeat cycle. There is no hardcoded standard loop — each agent's config determines its behavior.

This means the default CEO config tells the CEO to review strategy, check on reports, etc. The default engineer config tells the engineer to check assigned tasks, pick the highest priority, and work it. But these are config choices, not protocol requirements.

### Paperclip Skill (SKILL.md)

A skill definition that teaches agents how to interact with Paperclip. Provides:

- Task CRUD (create, read, update, complete tasks)
- Status reporting (check in, report progress)
- Company context (read goal, org chart, current state)
- Cost reporting (log token/API usage)
- Inter-agent communication rules

This skill is adapter-agnostic — it can be loaded into Claude Code, injected into prompts, or used as API documentation for custom agents.

---

## 8. Architecture & Deployment [DRAFT]

### Deployment Model

**Single-tenant, self-hostable.** Not a SaaS. One instance = one operator's companies.

#### Development Path (Progressive Deployment)

1. **Local dev** — One command to install and run. Embedded Postgres. Everything on your machine. Agents run locally.
2. **Hosted** — Deploy to Vercel/Supabase/AWS/anywhere. Remote agents connect to your server with a shared database. The UI is accessible via the web.
3. **Open company** — Optionally make parts public (e.g. a job board visible to the public for open companies).

The key constraint: it must be trivial to go from "I'm trying this on my machine" to "my agents are running on remote servers talking to my Paperclip instance."

#### Agent Authentication

Agents need to register and authenticate with the Paperclip server to get an API key that identifies them.

Flow:

1. Agent "signs up" — requests access to the Paperclip instance
2. Human board member approves/onboards the agent
3. Agent receives credentials (API key) and can now interact with the control plane

This is the same pattern as agent hiring — an agent can't just show up, it needs board approval.

### Tech Stack

| Layer    | Technology                                                   |
| -------- | ------------------------------------------------------------ |
| Frontend | React + Vite                                                 |
| Backend  | TypeScript + Hono (REST API, not tRPC — need non-TS clients) |
| Database | PostgreSQL (embedded for dev, hosted for production)         |
| Auth     | Standard React auth library (not Supabase-dependent)         |

### Concurrency Model: Atomic Task Checkout

Tasks use **single assignment** (one agent per task) with **atomic checkout**:

1. Agent attempts to set a task to `in_progress` (claiming it)
2. The API/database enforces this atomically — if another agent already claimed it, the request fails with an error identifying which agent has it
3. If the task is already assigned to the requesting agent from a previous session, they can resume

No optimistic locking or CRDTs needed. The single-assignment model + atomic checkout prevents conflicts at the design level.

### Human in the Loop

Agents can create tasks assigned to humans. The board member (or any human with access) can complete these tasks through the UI.

When a human completes a task, if the requesting agent's adapter supports **pingbacks** (e.g. OpenClaw hooks), Paperclip sends a notification to wake that agent. This keeps humans rare but possible participants in the workflow.

The agents are discouraged from assigning tasks to humans in the Paperclip SKILL, but sometimes it's unavoidable.

### API Design

**Single unified REST API.** The same API serves both the frontend UI and agents. Authentication determines permissions — board auth has full access, agent API keys have scoped access (their own tasks, cost reporting, company context).

No separate "agent API" vs. "board API." Same endpoints, different authorization levels.

### Work Artifacts

Paperclip does **not** manage work artifacts (code repos, file systems, deployments, documents). That's entirely the agent's domain. Paperclip tracks tasks and costs. Where and how work gets done is outside scope.

### Open Questions

- Embedded Postgres solution — pglite? embedded-postgres?
- Auth library choice — better-auth? next-auth? clerk?
- Real-time updates to the UI — WebSocket? SSE? Polling?
- Monorepo structure — pnpm workspaces with shared packages?
- Agent API key scoping — what exactly can an agent access? Only their own tasks? Their team's? The whole company?

### Crash Recovery: Manual, Not Automatic

When an agent crashes or disappears mid-task, Paperclip does **not** auto-reassign or auto-release the task. Instead:

- Paperclip surfaces stale tasks (tasks in `in_progress` with no recent activity) through dashboards and reporting
- Paperclip does not fail silently — the auditing and visibility tools make problems obvious
- Recovery is handled by humans or by emergent processes (e.g. a project manager agent whose job is to monitor for stale work and surface it)

**Principle: Paperclip reports problems, it doesn't silently fix them.** Automatic recovery hides failures. Good visibility lets the right entity (human or agent) decide what to do.

### Plugin / Extension Architecture

The core Paperclip system must be extensible. Features like knowledge bases, revenue tracking, and specialized adapters should be addable as **plugins** without modifying core. This means:

- Well-defined API boundaries that plugins can hook into
- Event system or hooks for reacting to task/agent lifecycle events
- Plugin-registrable UI components (future)

This isn't a V1 deliverable (we're not building a plugin framework upfront), but the architecture should not paint us into a corner. Keep boundaries clean so extensions are possible.

---

## 9. Frontend / UI [DRAFT]

### Primary Views

Each is a distinct page/route:

1. **Org Chart** — the org tree with live status indicators (running/idle/paused/error) per agent. Real-time activity feed of what agents are doing.
2. **Task Board** — Task management. Kanban and list views. Filter by team, agent, project, status.
3. **Dashboard** — high-level metrics: agent count, active tasks, costs, goal progress, burn rate. The "glance" view from GOAL.md.
4. **Agent Detail** — deep dive on a single agent: their tasks, activity, costs, configuration, status history.
5. **Project/Initiative Views** — progress tracking against milestones and goals.
6. **Cost Dashboard** — spend visualization at every level (agent, task, project, company).

### Board Controls (Available Everywhere)

- Pause/resume agents (any view)
- Pause/resume tasks/projects (any view)
- Approve/reject pending actions (hiring, strategy proposals)
- Direct task creation, editing, commenting

---

## 10. V1 Scope (MVP) [DRAFT]

**Full loop with one adapter.** V1 must demonstrate the complete Paperclip cycle end-to-end, even if narrow.

### Must Have (V1)

- [ ] **Company CRUD** — create a company with a goal
- [ ] **Agent CRUD** — create/edit/pause/resume agents with adapter config
- [ ] **Org chart** — define reporting structure, visualize it
- [ ] **Process adapter** — invoke(), status(), cancel() for local child processes
- [ ] **Task management** — full lifecycle with hierarchy (tasks trace to company goal)
- [ ] **Atomic task checkout** — single assignment, in_progress locking
- [ ] **Board governance** — human approves hires, pauses agents, full PM access
- [ ] **Cost tracking** — agents report token usage, per-agent/task/company visibility
- [ ] **Budget controls** — soft alerts + hard ceiling with auto-pause
- [ ] **Default agent** — basic Claude Code/Codex loop with Paperclip skill
- [ ] **Default CEO** — strategic planning, delegation, board communication
- [ ] **Paperclip skill (SKILL.md)** — teaches agents to interact with the API
- [ ] **REST API** — full API for agent interaction (Hono)
- [ ] **Web UI** — React/Vite: org chart, task board, dashboard, cost views
- [ ] **Agent auth** — registration, board approval, API keys
- [ ] **One-command dev setup** — embedded Postgres, everything local
- [ ] **Multiple adapter types** (HTTP adapter, OpenClaw adapter)

### Not V1

- Template export/import
- Knowledge base - a future plugin
- Advanced governance models (hiring budgets, multi-member boards)
- Revenue/expense tracking beyond token costs - a future plugin
- Public job board / open company features

---

## 11. Knowledge Base

**Anti-goal for core.** The knowledge base is not part of the Paperclip core — it will be a plugin. The task system + comments + agent descriptions provide sufficient shared context.

The architecture must support adding a knowledge base plugin later (clean API boundaries, hookable lifecycle events) but the core system explicitly does not include one.

---

## 12. Anti-Requirements

Things Paperclip explicitly does **not** do:

- **Not an agent runtime** — Paperclip orchestrates, agents run elsewhere
- **Not a knowledge base** — core has no wiki/docs/vector-DB (plugin territory)
- **Not a SaaS** — single-tenant, self-hosted
- **Not opinionated about agent implementation** — any language, any framework, any runtime
- **Not automatically self-healing** — surfaces problems, doesn't silently fix them
- **Does not manage work artifacts** — no repo management, no deployment, no file systems
- **Does not auto-reassign work** — stale tasks are surfaced, not silently redistributed

---

## 13. Principles (Consolidated)

1. **Unopinionated about how you run your agents.** Any language, any framework, any runtime. Paperclip is the control plane, not the execution plane.
2. **Company is the unit of organization.** Everything lives under a company.
3. **Tasks are the communication channel.** All agent communication flows through tasks + comments. No side channels.
4. **All work traces to the goal.** Hierarchical task management — nothing exists in isolation.
5. **Board governs.** Humans retain control through the board. Conservative defaults (human approval required).
6. **Surface problems, don't hide them.** Good auditing and visibility. No silent auto-recovery.
7. **Atomic ownership.** Single assignee per task. Atomic checkout prevents conflicts.
8. **Progressive deployment.** Trivial to start local, straightforward to scale to hosted.
9. **Extensible core.** Clean boundaries so plugins can add capabilities without modifying core.
