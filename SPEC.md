# Paperclip Specification

Target specification for the Paperclip control plane. Living document — updated incrementally during spec interviews.

---

## 1. Company Model [NEEDS DETAIL]

A company is a first-order object. One Paperclip instance runs multiple companies.

### Fields (Draft)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `name` | string | Company name |
| `goal` | text/markdown | The company's top-level objective |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### Board Governance [DRAFT]

Every company has a **board** that governs high-impact decisions. The board is the human oversight layer.

**V1: Single human board.** One human operator approves:
- New agent hires (creating new agents)
- [TBD: other governance-gated actions]

**Future governance models** (not V1):
- Hiring budgets (auto-approve hires within $X/month)
- Multi-member boards
- Delegated authority (CEO can hire within limits)

The board is the boundary between "the company runs autonomously" and "humans retain control." The default is conservative — human approval for structural changes.

### Open Questions

- Revenue/expense tracking — how does financial data enter the system?
- Company-level settings and configuration?
- Company lifecycle (pause, archive, delete)?
- What other actions require board approval beyond hiring? (budget changes, company goal changes, firing agents?)

---

## 2. Agent Model [NEEDS DETAIL]

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

The minimum requirement to be a Paperclip agent: **be callable.** That's it. Paperclip can invoke you via command or webhook. No requirement to report back — Paperclip infers basic status from process liveness.

#### Integration Levels

Beyond the minimum, Paperclip provides progressively richer integration:

1. **Callable** (minimum) — Paperclip can start you. That's the only contract.
2. **Status reporting** — Agent reports back success/failure/in-progress after execution.
3. **Fully instrumented** — Agent reports status, cost/token usage, task updates, and logs. Bidirectional integration with the control plane.

Paperclip ships **default agents** that demonstrate full integration: progress tracking, cost instrumentation, and a **Paperclip skill** (a Claude Code skill for interacting with the Paperclip API) for task management. These serve as both useful defaults and reference implementations for adapter authors.

### Open Questions

- What is the adapter interface? What must an adapter implement?
- How does an agent authenticate to the control plane?
- Agent lifecycle (create, pause, terminate, restart)?
- What does the Paperclip skill provide? (task CRUD, status updates, reading company context?)
- Export format for org configs — JSON? YAML? Directory of files?

---

## 3. Org Structure [NEEDS DETAIL]

Hierarchical reporting structure. CEO at top, reports cascade down.

### Open Questions

- Is this a strict tree or can agents report to multiple managers?
- Can org structure change at runtime?
- Do agents inherit configuration from their manager?

---

## 4. Heartbeat System [DRAFT]

The heartbeat is a protocol, not a runtime. Paperclip defines how to initiate an agent's cycle. What the agent does with that cycle — how long it runs, whether it's task-scoped or continuous — is entirely up to the agent.

### Execution Adapters

Agent configuration includes an **adapter** that defines how Paperclip invokes the agent. Initial adapters:

| Adapter | Mechanism | Example |
| --- | --- | --- |
| `process` | Execute a child process | `python run_agent.py --agent-id {id}` |
| `http` | Send an HTTP request | `POST https://openclaw.example.com/hook/{id}` |

More adapters can be added. The adapter interface is simple: "given this agent's config, initiate their cycle."

### What Paperclip Controls

- **When** to fire the heartbeat (schedule/frequency, per-agent)
- **How** to fire it (adapter selection + config)
- **What context** to include (thin ping vs. fat payload, per-agent)

### What Paperclip Does NOT Control

- How long the agent runs
- What the agent does during its cycle
- Whether the agent is task-scoped, time-windowed, or continuous

### Open Questions

- Heartbeat frequency — who controls it? Fixed? Per-agent? Cron-like?
- What happens when a heartbeat invocation fails? (process crashes, HTTP 500)
- Health monitoring — how does Paperclip distinguish "stuck" from "working on a long task"?
- Can agents self-trigger their next heartbeat? ("I'm done, wake me again in 5 min")

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

---

## 6. Cost Tracking [NEEDS DETAIL]

Token budgets, spend tracking, burn rate.

### Open Questions

- How does cost data enter the system?
- Budget enforcement — hard limits vs. alerts?
- Granularity — per-agent, per-task, per-company?

---

## 7. Knowledge Base [NEEDS DETAIL]

Shared organizational memory.

### Open Questions

- What form does company knowledge take?
- How do agents read/write to it?
- Scoping — company-wide, team-level, agent-level?
