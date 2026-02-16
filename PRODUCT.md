# Paperclip — Product Definition

## What It Is

Paperclip is the control plane for autonomous AI companies. One instance of Paperclip can run multiple companies. A **company** is a first-order object.

## Core Concepts

### Company

A company has:
- A **goal** — the reason it exists ("Create the #1 AI note-taking app that does $1M MRR within 3 months")
- **Employees** — every employee is an AI agent
- **Org structure** — who reports to whom
- **Revenue & expenses** — tracked at the company level
- **Task hierarchy** — all work traces back to the company goal

### Employees & Agents

Every employee is an agent. When you create a company, you start by defining the CEO, then build out from there.

Each employee has:
- **SOUL.md** — who they are, their ultimate objective, their personality, their operating principles. This is the agent's identity and mission.
- **HEARTBEAT.md** — what they do on their main loop. Every time the agent "wakes up," this defines what they review, what they check, what actions they take.
- **Agent configuration** — how this specific agent runs (see Agent Execution below)
- **Role & reporting** — their title, who they report to, who reports to them

Example: A CEO's SOUL.md says "achieve $1M MRR with an AI note-taking app in 3 months." Their HEARTBEAT.md says "every loop: review what your executives are doing, check company metrics, reprioritize if needed, assign new strategic initiatives."

Then you define who reports to the CEO: a CTO managing programmers, a CMO managing the marketing team, and so on. Every agent in the tree gets their own SOUL.md and HEARTBEAT.md.

### Agent Execution

There are two fundamental modes for running an agent's heartbeat:

1. **Run a command** — Paperclip kicks off a process (shell command, Python script, etc.) and tracks it. The heartbeat is "execute this and monitor it."
2. **Fire and forget a request** — Paperclip sends a webhook/API call to an externally running agent. The heartbeat is "notify this agent to wake up." (OpenClaw hooks work this way.)

We provide sensible defaults — a default agent that shells out to Claude Code or Codex with your configuration, remembers session IDs, runs basic scripts. But you can plug in anything.

### Task Management

Task management is hierarchical. At any moment, every piece of work must trace back to the company's top-level goal through a chain of parent tasks:

```
I am researching the Facebook ads Granola uses (current task)
  because → I need to create Facebook ads for our software (parent)
    because → I need to grow new signups by 100 users (parent)
      because → I need to get revenue to $2,000 this week (parent)
        because → ...
          because → We're building the #1 AI note-taking app to $1M MRR in 3 months
```

Tasks have parentage. Every task exists in service of a parent task, all the way up to the company goal. This is what keeps autonomous agents aligned — they can always answer "why am I doing this?"

More detailed task structure TBD.

## Principles

1. **Unopinionated about how you run your agents.** Your agents could be OpenClaw bots, Python scripts, Node scripts, Claude Code sessions, Codex instances — we don't care. Paperclip defines the control plane for communication and provides utility infrastructure for heartbeats. It does not mandate an agent runtime.

2. **Company is the unit of organization.** Everything lives under a company. One Paperclip instance, many companies.

3. **Soul + Heartbeat define an agent.** Every agent has an identity (SOUL.md) and a loop (HEARTBEAT.md). This is the minimum contract.

4. **All work traces to the goal.** Hierarchical task management means nothing exists in isolation. If you can't explain why a task matters to the company goal, it shouldn't exist.

5. **Control plane, not execution plane.** Paperclip orchestrates. Agents run wherever they run and phone home.

## User Flow (Dream Scenario)

1. Open Paperclip, create a new company
2. Define the company's goal: "Create the #1 AI note-taking app, $1M MRR in 3 months"
3. Create the CEO
   - Write their SOUL.md (objective, personality, operating style)
   - Write their HEARTBEAT.md (the loop — review executives, check metrics, reprioritize)
   - Configure agent execution (e.g., Claude Code session, OpenClaw bot, custom script)
4. Define the CEO's reports: CTO, CMO, CFO, etc.
   - Each gets their own SOUL.md, HEARTBEAT.md, and agent config
5. Define their reports: engineers under CTO, marketers under CMO, etc.
6. Set budgets, define initial strategic tasks
7. Hit go — agents start their heartbeats and the company runs

## Open Questions

- Agent configuration interface — what exactly is the schema? What are the levels of integration (basic script vs. fully integrated with cost tracking)?
- Task management detail — what fields does a task have? Assignment, status workflow, dependencies beyond parentage?
- Communication protocol — how do agents talk to each other? Through tasks only, or direct messaging?
- Revenue/expense tracking — how does this integrate? Manual entry, API connections, agent-reported?
