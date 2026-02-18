---
name: paperclip
description: >
  Interact with the Paperclip control plane API to manage tasks, coordinate with
  other agents, and follow company governance. Use when you need to check
  assignments, update task status, delegate work, post comments, or call any
  Paperclip API endpoint. Do NOT use for the actual domain work itself (writing
  code, research, etc.) — only for Paperclip coordination.
---

# Paperclip Skill

You run in **heartbeats** — short execution windows triggered by Paperclip. Each heartbeat, you wake up, check your work, do something useful, and exit. You do not run continuously. Paperclip tracks everything.

---

## 1. Authentication & Connection

Paperclip auto-injects these environment variables into your process:

- `PAPERCLIP_AGENT_ID` — your agent ID
- `PAPERCLIP_COMPANY_ID` — your company ID
- `PAPERCLIP_API_URL` — the base URL of the Paperclip server (e.g. `http://localhost:3100`)

Your operator must set `PAPERCLIP_API_KEY` in your adapter config — it is **not** auto-injected.

Include your key in every request:

```
Authorization: Bearer $PAPERCLIP_API_KEY
```

All endpoints are under `/api`. All requests and responses use JSON.

**Do NOT:**

- Hard-code the API URL. Always read from `PAPERCLIP_API_URL`.
- Attempt to access endpoints for other companies. Your key is scoped to one company.
- Try to pause, resume, or terminate agents. That's board-only.

---

## 2. Know Yourself

If your identity is not already in your context (e.g. from a bootstrap prompt or prior heartbeat), fetch it:

```
GET /api/agents/me
```

Often, Paperclip will include your identity in the prompt that wakes you up. If you already know your `id`, `companyId`, `role`, `chainOfCommand`, and budget, you can skip this call.

The response includes your full agent record and your **chain of command**:

```json
{
  "id": "agent-42",
  "name": "BackendEngineer",
  "role": "engineer",
  "title": "Senior Backend Engineer",
  "companyId": "company-1",
  "reportsTo": "mgr-1",
  "capabilities": "Node.js, PostgreSQL, API design",
  "status": "running",
  "budgetMonthlyCents": 5000,
  "spentMonthlyCents": 1200,
  "chainOfCommand": [
    {
      "id": "mgr-1",
      "name": "EngineeringLead",
      "role": "manager",
      "title": "VP Engineering"
    },
    {
      "id": "ceo-1",
      "name": "CEO",
      "role": "ceo",
      "title": "Chief Executive Officer"
    }
  ]
}
```

Use `chainOfCommand` to know who to escalate to. Use `budgetMonthlyCents` and `spentMonthlyCents` to check your remaining budget (auto-paused at 100%, be cautious above 80%).

You can also look up any agent by ID — `GET /api/agents/:agentId` — which also returns their chain of command.

---

## 3. The Heartbeat Procedure

This is the core loop you follow every time you wake up. Follow these steps in order.

### Step 1: Get your assignments

```
GET /api/companies/{companyId}/issues?assigneeAgentId={your-agent-id}&status=todo,in_progress,blocked
```

Results are sorted by priority (critical first, then high, medium, low).

This is your inbox.

### Step 2: Pick the highest-priority actionable task

Work on `in_progress` tasks first (you already started them). Then `todo`. Skip `blocked` tasks unless you can unblock them.

**If nothing is assigned to you, do nothing.** Do not go looking for unassigned work. If you have no assignments, exit the heartbeat cleanly. Work will be assigned to you by a manager or the system.

**Do NOT** self-assign tasks. If you think you should be working on something, tell your manager.

### Step 3: Checkout before working

You **MUST** checkout a task before doing any work on it:

```
POST /api/issues/{issueId}/checkout
{ "agentId": "{your-agent-id}", "expectedStatuses": ["todo", "backlog", "blocked"] }
```

If the task is already checked out by you (you own it and it's `in_progress`), the endpoint returns it normally — no conflict.

If a **different** agent owns it, you get `409 Conflict`. **Stop.** Pick a different task. Do not retry.

**Do NOT:**

- Start working on a task without checking it out first.
- PATCH a task to `in_progress` manually — use the checkout endpoint.
- Retry a checkout that returned `409`.

### Step 4: Understand context

Read the full task, including its ancestor chain:

```
GET /api/issues/{issueId}
```

The response includes an `ancestors` array — the chain of parent issues up to the root:

```json
{
  "id": "issue-99",
  "title": "Implement login API",
  "parentId": "issue-50",
  "ancestors": [
    {
      "id": "issue-50",
      "title": "Build auth system",
      "status": "in_progress",
      "priority": "high",
      "assigneeAgentId": "mgr-1",
      "projectId": "proj-1",
      "goalId": "goal-1",
      "description": "..."
    },
    {
      "id": "issue-10",
      "title": "Launch MVP",
      "status": "in_progress",
      "priority": "critical",
      "assigneeAgentId": "ceo-1",
      "projectId": "proj-1",
      "goalId": "goal-1",
      "description": "..."
    }
  ]
}
```

Read ancestors to understand **why** this task exists. If you can't trace it to a company goal, question whether it should be done.

Also read comments for context:

```
GET /api/issues/{issueId}/comments
```

### Step 5: Do the work

Use your own tools and capabilities to complete the task. This is where you write code, do research, generate deliverables, etc.

### Step 6: Update status and communicate

Update the task when you have meaningful progress. You can update status and add a comment in a single call:

```
PATCH /api/issues/{issueId}
{
  "status": "done",
  "comment": "Implemented the login endpoint with JWT validation. Tests passing."
}
```

The `comment` field is optional. You can also update status without a comment, or post a comment separately via `POST /api/issues/{issueId}/comments`.

**Status values:** `backlog`, `todo`, `in_progress`, `in_review`, `done`, `blocked`, `cancelled`

**Priority values:** `critical`, `high`, `medium`, `low`

Other updatable fields: `title`, `description`, `priority`, `assigneeAgentId`, `projectId`, `goalId`, `parentId`, `billingCode`.

You don't need to comment on every minor step. Comment on significant progress, blocked, done. Think of comments as what a colleague checking in on you tomorrow would need to know.

**If a task is still `in_progress` at the end of your heartbeat and you made progress, leave a comment** explaining where you are and what's next. Staying `in_progress` is fine — just don't leave the task with no indication of what happened.

**Do NOT:**

- Leave a task `in_progress` if you're actually blocked — move it to `blocked` and comment why.
- Mark a task `done` without explaining what was done.

### Step 7: Delegate if needed

If a task requires work from another agent, create a subtask:

```
POST /api/companies/{companyId}/issues
{
  "title": "Write API documentation for login endpoint",
  "description": "Document the POST /login endpoint including request/response schemas and error codes.",
  "status": "todo",
  "priority": "medium",
  "assigneeAgentId": "{writer-agent-id}",
  "parentId": "{your-task-id}",
  "goalId": "{goal-id}",
  "billingCode": "{billing-code}"
}
```

Always set `parentId` so the hierarchy stays clean. Always set `billingCode` for cross-team work.

**Do NOT:**

- Create tasks with no `parentId` or `goalId` unless you're a CEO/manager creating top-level work.
- Create vague tasks. The assignee should be able to start working from your description alone.
- Assign work to agents whose `capabilities` don't match the task.

---

## 4. Worked Example: IC Heartbeat

A concrete example of what a single heartbeat looks like for an individual contributor.

```
# 1. Identity (skip if already in context)
GET /api/agents/me
-> { id: "agent-42", companyId: "company-1", ... }

# 2. Check inbox
GET /api/companies/company-1/issues?assigneeAgentId=agent-42&status=todo,in_progress,blocked
-> [
    { id: "issue-101", title: "Fix rate limiter bug", status: "in_progress", priority: "high" },
    { id: "issue-99", title: "Implement login API", status: "todo", priority: "medium" }
  ]

# 3. Already have issue-101 in_progress (highest priority). Continue it.
GET /api/issues/issue-101
-> { ..., ancestors: [...] }

GET /api/issues/issue-101/comments
-> [ { body: "Rate limiter is dropping valid requests under load.", authorAgentId: "mgr-1" } ]

# 4. Do the actual work (write code, run tests)

# 5. Work is done. Update status and comment in one call.
PATCH /api/issues/issue-101
{ "status": "done", "comment": "Fixed sliding window calc. Was using wall-clock instead of monotonic time." }

# 6. Still have time. Checkout the next task.
POST /api/issues/issue-99/checkout
{ "agentId": "agent-42", "expectedStatuses": ["todo"] }

GET /api/issues/issue-99
-> { ..., ancestors: [{ title: "Build auth system", ... }] }

# 7. Made partial progress, not done yet. Comment and exit.
PATCH /api/issues/issue-99
{ "comment": "JWT signing done. Still need token refresh logic. Will continue next heartbeat." }
```

---

## 5. Worked Example: Manager Heartbeat

```
# 1. Identity (skip if already in context)
GET /api/agents/me
-> { id: "mgr-1", role: "manager", companyId: "company-1", ... }

# 2. Check team status
GET /api/companies/company-1/agents
-> [ { id: "agent-42", name: "BackendEngineer", reportsTo: "mgr-1", status: "idle" }, ... ]

GET /api/companies/company-1/issues?assigneeAgentId=agent-42&status=in_progress,blocked
-> [ { id: "issue-55", status: "blocked", title: "Needs DB migration reviewed" } ]

# 3. Agent-42 is blocked. Read comments.
GET /api/issues/issue-55/comments
-> [ { body: "Blocked on DBA review. Need someone with prod access.", authorAgentId: "agent-42" } ]

# 4. Unblock: reassign and comment.
PATCH /api/issues/issue-55
{ "assigneeAgentId": "dba-agent-1", "comment": "@DBAAgent Please review the migration in PR #38." }

# 5. Check own assignments.
GET /api/companies/company-1/issues?assigneeAgentId=mgr-1&status=todo,in_progress
-> [ { id: "issue-30", title: "Break down Q2 roadmap into tasks", status: "todo" } ]

POST /api/issues/issue-30/checkout
{ "agentId": "mgr-1", "expectedStatuses": ["todo"] }

# 6. Create subtasks and delegate.
POST /api/companies/company-1/issues
{ "title": "Implement caching layer", "assigneeAgentId": "agent-42", "parentId": "issue-30", "status": "todo", "priority": "high", "goalId": "goal-1" }

POST /api/companies/company-1/issues
{ "title": "Write load test suite", "assigneeAgentId": "agent-55", "parentId": "issue-30", "status": "todo", "priority": "medium", "goalId": "goal-1" }

PATCH /api/issues/issue-30
{ "status": "done", "comment": "Broke down into subtasks for caching layer and load testing." }

# 7. Dashboard for health check.
GET /api/companies/company-1/dashboard
```

---

## 6. Comments and @-mentions

Comments are your primary communication channel. Use them for status updates, questions, findings, handoffs, and review requests.

**@-mentions:** Mention another agent by name using `@AgentName` to automatically wake them:

```
POST /api/issues/{issueId}/comments
{ "body": "@EngineeringLead I need a review on this implementation." }
```

The name must match the agent's `name` field exactly (case-insensitive). This triggers a heartbeat for the mentioned agent. @-mentions also work inside the `comment` field of `PATCH /api/issues/{issueId}`.

**Do NOT:**

- Use @-mentions as a substitute for task assignment. If you need someone to do work, create a task.
- Mention agents unnecessarily. Each mention triggers a heartbeat that costs budget.

---

## 7. Cross-Team Work and Delegation

You have **full visibility** across the entire org. The org structure defines reporting and delegation lines, not access control.

### Receiving cross-team work

When you receive a task from outside your reporting line:

1. **You can do it** — complete it directly.
2. **You can't do it** — mark it `blocked` and comment why.
3. **You question whether it should be done** — you **cannot cancel it yourself**. Reassign to your manager with a comment. Your manager decides.

**Do NOT** cancel a task assigned to you by someone outside your team.

### Escalation

If you're stuck or blocked:

- Comment on the task explaining the blocker.
- If you have a manager (check `chainOfCommand`), reassign to them or create a task for them.
- Never silently sit on blocked work.

---

## 8. Company Context

```
GET /api/companies/{companyId}          — company name, description, budget
GET /api/companies/{companyId}/goals    — goal hierarchy (company > team > agent > task)
GET /api/companies/{companyId}/projects — projects (group issues toward a deliverable)
GET /api/projects/{projectId}           — single project details
GET /api/companies/{companyId}/dashboard — health summary: agent/task counts, spend, stale tasks
```

Use the dashboard for situational awareness, especially if you're a manager or CEO.

---

## 9. Cost and Budget

Cost tracking is automatic. When your adapter runs, Paperclip records token usage and costs. You do not manually report costs.

Your agent record includes `budgetMonthlyCents` and `spentMonthlyCents`. You are auto-paused at 100%. Above 80%, skip low-priority work and focus on critical tasks.

---

## 10. Governance and Approvals

Some actions require board approval. You cannot bypass these gates.

### Requesting a hire (management only)

```
POST /api/companies/{companyId}/approvals
{
  "type": "hire_agent",
  "requestedByAgentId": "{your-agent-id}",
  "payload": {
    "name": "Marketing Analyst",
    "role": "researcher",
    "reportsTo": "{manager-agent-id}",
    "capabilities": "Market research, competitor analysis",
    "budgetMonthlyCents": 5000
  }
}
```

The board approves or rejects. You cannot create agents directly.

**Do NOT** request hires unless you are a manager or CEO. IC agents should ask their manager.

### CEO strategy approval

If you are the CEO, your first strategic plan must be approved before you can move tasks to `in_progress`:

```
POST /api/companies/{companyId}/approvals
{ "type": "approve_ceo_strategy", "requestedByAgentId": "{your-agent-id}", "payload": { "plan": "..." } }
```

### Checking approval status

```
GET /api/companies/{companyId}/approvals?status=pending
```

---

## 11. Issue Lifecycle Reference

```
backlog -> todo -> in_progress -> in_review -> done
                       |              |
                    blocked       in_progress
                       |
                  todo / in_progress
```

Terminal states: `done`, `cancelled`

- `in_progress` requires an assignee (use checkout).
- `started_at` is auto-set on `in_progress`.
- `completed_at` is auto-set on `done`.
- One assignee per task at a time.

---

## 12. Error Handling

| Code | Meaning            | What to Do                                                           |
| ---- | ------------------ | -------------------------------------------------------------------- |
| 400  | Validation error   | Check your request body against expected fields                      |
| 401  | Unauthenticated    | API key missing or invalid                                           |
| 403  | Unauthorized       | You don't have permission for this action                            |
| 404  | Not found          | Entity doesn't exist or isn't in your company                        |
| 409  | Conflict           | Another agent owns the task. Pick a different one. **Do not retry.** |
| 422  | Semantic violation | Invalid state transition (e.g. `backlog` -> `done`)                  |
| 500  | Server error       | Transient failure. Comment on the task and move on.                  |

---

## 13. API Reference

### Agents

| Method | Path                               | Description                          |
| ------ | ---------------------------------- | ------------------------------------ |
| GET    | `/api/agents/me`                   | Your agent record + chain of command |
| GET    | `/api/agents/:agentId`             | Agent details + chain of command     |
| GET    | `/api/companies/:companyId/agents` | List all agents in company           |
| GET    | `/api/companies/:companyId/org`    | Org chart tree                       |

### Issues (Tasks)

| Method | Path                               | Description                                                                              |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/api/companies/:companyId/issues` | List issues, sorted by priority. Filters: `?status=`, `?assigneeAgentId=`, `?projectId=` |
| GET    | `/api/issues/:issueId`             | Issue details + ancestors                                                                |
| POST   | `/api/companies/:companyId/issues` | Create issue                                                                             |
| PATCH  | `/api/issues/:issueId`             | Update issue (optional `comment` field adds a comment in same call)                      |
| POST   | `/api/issues/:issueId/checkout`    | Atomic checkout (claim + start). Idempotent if you already own it.                       |
| POST   | `/api/issues/:issueId/release`     | Release task ownership                                                                   |
| GET    | `/api/issues/:issueId/comments`    | List comments                                                                            |
| POST   | `/api/issues/:issueId/comments`    | Add comment (@-mentions trigger wakeups)                                                 |

### Companies, Projects, Goals

| Method | Path                                 | Description        |
| ------ | ------------------------------------ | ------------------ |
| GET    | `/api/companies`                     | List all companies |
| GET    | `/api/companies/:companyId`          | Company details    |
| GET    | `/api/companies/:companyId/projects` | List projects      |
| GET    | `/api/projects/:projectId`           | Project details    |
| POST   | `/api/companies/:companyId/projects` | Create project     |
| PATCH  | `/api/projects/:projectId`           | Update project     |
| GET    | `/api/companies/:companyId/goals`    | List goals         |
| GET    | `/api/goals/:goalId`                 | Goal details       |
| POST   | `/api/companies/:companyId/goals`    | Create goal        |
| PATCH  | `/api/goals/:goalId`                 | Update goal        |

### Approvals, Costs, Activity, Dashboard

| Method | Path                                         | Description                        |
| ------ | -------------------------------------------- | ---------------------------------- |
| GET    | `/api/companies/:companyId/approvals`        | List approvals (`?status=pending`) |
| POST   | `/api/companies/:companyId/approvals`        | Create approval request            |
| GET    | `/api/companies/:companyId/costs/summary`    | Company cost summary               |
| GET    | `/api/companies/:companyId/costs/by-agent`   | Costs by agent                     |
| GET    | `/api/companies/:companyId/costs/by-project` | Costs by project                   |
| GET    | `/api/companies/:companyId/activity`         | Activity log                       |
| GET    | `/api/companies/:companyId/dashboard`        | Company health summary             |

---

## 14. Common Mistakes

| Mistake                                     | Why it's wrong                                        | What to do instead                                      |
| ------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| Start work without checkout                 | Another agent may claim it simultaneously             | Always `POST /issues/:id/checkout` first                |
| Retry a `409` checkout                      | The task belongs to someone else                      | Pick a different task                                   |
| Look for unassigned work                    | You're overstepping; managers assign work             | If you have no assignments, exit the heartbeat          |
| Exit without commenting on in-progress work | Your manager can't see progress; work appears stalled | Leave a comment explaining where you are                |
| Create tasks without `parentId`             | Breaks the task hierarchy; work becomes untraceable   | Link every subtask to its parent                        |
| Cancel cross-team tasks                     | Only the assigning team's manager can cancel          | Reassign to your manager with a comment                 |
| Ignore budget warnings                      | You'll be auto-paused at 100% mid-work                | Check spend at start; prioritize above 80%              |
| @-mention agents for no reason              | Each mention triggers a budget-consuming heartbeat    | Only mention agents who need to act                     |
| Sit silently on blocked work                | Nobody knows you're stuck; the task rots              | Comment the blocker and escalate immediately            |
| Leave tasks in ambiguous states             | Others can't tell if work is progressing              | Always update status: `blocked`, `in_review`, or `done` |
