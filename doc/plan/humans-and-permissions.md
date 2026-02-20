# Humans and Permissions Plan

Status: Draft
Date: 2026-02-20
Owner: Server + UI + Shared + DB

## Goal

Add first-class human users and permissions while preserving two deployment modes:

- local trusted single-user mode with no login friction
- cloud-hosted multi-user mode with mandatory authentication and authorization

## Why this plan

Current V1 assumptions are centered on one board operator. We now need:

- multi-human collaboration with per-user permissions
- safe cloud deployment defaults (no accidental loginless production)
- local mode that still feels instant (`npx paperclip run` and go)
- agent-to-human task delegation, including a human inbox

## Product constraints

1. Keep company scoping strict for every new table, endpoint, and permission check.
2. Preserve existing control-plane invariants:
- single-assignee task model
- approval gates
- budget hard-stop behavior
- mutation activity logging
3. Keep local mode easy and trusted, but prevent unsafe cloud posture.

## Deployment modes

## Mode A: `local_trusted`

Behavior:

- no login UI
- browser opens directly into board context
- embedded DB and local storage defaults remain
- a local implicit human actor exists for attribution

Guardrails:

- server binds to loopback by default
- refuse startup if mode is `local_trusted` with non-loopback bind, unless explicit `--allow-unsafe-local-network`
- UI shows a persistent "Local trusted mode" badge

## Mode B: `cloud_hosted`

Behavior:

- login required for all human endpoints
- hosted DB and remote deployment supported
- multi-user sessions and role/permission enforcement

Guardrails:

- fail startup if auth provider/session config is missing
- fail startup if insecure auth bypass flag is set
- health payload includes mode and auth readiness

## Auth and actor model

Unify request actors into a single model:

- `user` (authenticated human)
- `agent` (API key)
- `local_board_implicit` (local trusted mode only)

Rules:

- in `cloud_hosted`, only `user` and `agent` are valid actors
- in `local_trusted`, unauthenticated browser/API requests resolve to `local_board_implicit`
- all mutating actions continue writing `activity_log` with actor type/id

## Data model additions

## New tables

1. `users`
- identity record for human users (email-based)

2. `company_memberships`
- `company_id`, `user_id`, status, role metadata
- stores effective permissions and optional org scope constraints

3. `invites`
- `company_id`, invite email, token hash, expires_at, invited_by, revoked_at, accepted_at
- optional default permissions payload at invite time

4. `user_permission_grants` (or JSON grant blob in membership)
- explicit grants such as `agents:create`
- includes scope payload for chain-of-command limits

5. `issues` extension
- add `assignee_user_id` nullable
- preserve single-assignee invariant with XOR check:
  - exactly zero or one of `assignee_agent_id` / `assignee_user_id`

## Compatibility

- existing `created_by_user_id` / `author_user_id` fields remain and become fully active
- agent API key model remains unchanged, still company-scoped

## Permission model (initial set)

Core grants:

1. `agents:create`
2. `users:invite`
3. `users:manage_permissions`
4. `tasks:assign`
5. `tasks:assign_scope` (org-constrained delegation)

Additional behavioral rules:

- board-level users can manage all grants
- non-board users can only act within explicit grants
- assignment checks apply to both agent and human assignees

## Chain-of-command scope design

Initial approach:

- represent assignment scope as an allow rule over org hierarchy
- examples:
  - `subtree:<agentId>` (can assign into that manager subtree)
  - `exclude:<agentId>` (cannot assign to protected roles, e.g., CEO)

Enforcement:

- resolve target assignee org position
- evaluate allow/deny scope rules before assignment mutation
- return `403` for out-of-scope assignments

## Invite and signup flow

1. Authorized user creates invite with email + grants + optional expiry.
2. System sends invite URL containing one-time token.
3. Invitee signs up/logs in.
4. Email on authenticated account must match invite email.
5. Accepting invite creates active `company_membership` and permission grants.
6. Inviter/admin can revoke invite before acceptance.

Security rules:

- store invite token hashed at rest
- one-time use token with short expiry
- all invite lifecycle events logged in `activity_log`

## Human inbox and agent-to-human delegation

Behavior:

- agents can assign tasks to humans when policy permits
- humans see assigned tasks in inbox view (including in local trusted mode)
- comment and status transitions follow same issue lifecycle guards

API additions (proposed):

- `GET /companies/:companyId/inbox` (human actor scoped to self)
- `POST /companies/:companyId/issues/:issueId/assign-user`
- `POST /companies/:companyId/invites`
- `POST /invites/:token/accept`
- `POST /invites/:inviteId/revoke`
- `GET /companies/:companyId/members`
- `PATCH /companies/:companyId/members/:userId/permissions`

## Local mode UX policy

- no login prompt or account setup required
- local implicit board user is auto-provisioned for audit attribution
- invite/multi-user screens can be hidden or marked unavailable in local mode
- if operator wants collaboration, they must switch to `cloud_hosted`

## Cloud agents in this model

- cloud agents continue authenticating through `agent_api_keys`
- same-company boundary checks remain mandatory
- agent ability to assign human tasks is permission-gated, not implicit

## Implementation phases

## Phase 1: Mode and guardrails

- add explicit deployment mode config (`local_trusted | cloud_hosted`)
- enforce startup safety checks and health visibility
- implement actor resolution for local implicit board

## Phase 2: Human identity and memberships

- add schema + migrations for users/memberships/invites
- wire auth middleware for cloud mode
- add membership lookup and company access checks

## Phase 3: Permissions and assignment scope

- add grant model and enforcement helpers
- add chain-of-command scope checks for assignment APIs
- add tests for forbidden assignment (for example, cannot assign to CEO)

## Phase 4: Invite workflow

- invite create/send/accept/revoke endpoints
- email-match enforcement and token security
- UI for invite management and membership permissions

## Phase 5: Human inbox + task assignment updates

- extend issue assignee model for human users
- inbox API and UI
- agent-to-human assignment flow with policy checks

## Acceptance criteria

1. `local_trusted` starts with no login and shows board UI immediately.
2. `cloud_hosted` cannot start without auth configured.
3. No request in `cloud_hosted` can mutate data without authenticated actor.
4. Humans can be invited by email, accepted with matching email, and revoked.
5. Permissions can be granted/revoked per company member.
6. Assignment scope prevents out-of-hierarchy or protected-role assignments.
7. Agents can assign tasks to humans only when allowed.
8. Humans can view assigned tasks in inbox and act on them per permissions.
9. All new mutations are company-scoped and logged in `activity_log`.

## Open decisions

1. Auth provider choice for cloud mode (Auth.js vs hosted provider).
2. Whether local mode supports optional login in addition to implicit board.
3. Exact representation of permission grants (normalized table vs JSON schema).
4. Whether a user can belong to multiple companies in initial release.
5. Whether invite email delivery is built-in or webhook/provider integration only.
