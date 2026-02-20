# Developing

This project can run fully in local dev without setting up PostgreSQL manually.

## Prerequisites

- Node.js 20+
- pnpm 9+

## Start Dev

From repo root:

```sh
pnpm install
pnpm dev
```

This starts:

- API server: `http://localhost:3100`
- UI: served by the API server in dev middleware mode (same origin as API)

## One-Command Local Run

For a first-time local install, you can bootstrap and run in one command:

```sh
pnpm paperclip run
```

`paperclip run` does:

1. auto-onboard if config is missing
2. `paperclip doctor` with repair enabled
3. starts the server when checks pass

## Database in Dev (Auto-Handled)

For local development, leave `DATABASE_URL` unset.
The server will automatically use embedded PostgreSQL and persist data at:

- `~/.paperclip/instances/default/db`

Override home and instance:

```sh
PAPERCLIP_HOME=/custom/path PAPERCLIP_INSTANCE_ID=dev pnpm paperclip run
```

No Docker or external database is required for this mode.

## Quick Health Checks

In another terminal:

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

Expected:

- `/api/health` returns `{"status":"ok"}`
- `/api/companies` returns a JSON array

## Reset Local Dev Database

To wipe local dev data and start fresh:

```sh
rm -rf ~/.paperclip/instances/default/db
pnpm dev
```

## Optional: Use External Postgres

If you set `DATABASE_URL`, the server will use that instead of embedded PostgreSQL.

## Secrets in Dev

Agent env vars now support secret references. By default, secret values are stored with local encryption and only secret refs are persisted in agent config.

- Default local key path: `~/.paperclip/instances/default/secrets/master.key`
- Override key material directly: `PAPERCLIP_SECRETS_MASTER_KEY`
- Override key file path: `PAPERCLIP_SECRETS_MASTER_KEY_FILE`

Strict mode (recommended outside local trusted machines):

```sh
PAPERCLIP_SECRETS_STRICT_MODE=true
```

When strict mode is enabled, sensitive env keys (for example `*_API_KEY`, `*_TOKEN`, `*_SECRET`) must use secret references instead of inline plain values.

CLI configuration support:

- `pnpm paperclip onboard` writes a default `secrets` config section (`local_encrypted`, strict mode off, key file path set) and creates a local key file when needed.
- `pnpm paperclip configure --section secrets` lets you update provider/strict mode/key path and creates the local key file when needed.
- `pnpm paperclip doctor` validates secrets adapter configuration and can create a missing local key file with `--repair`.

Migration helper for existing inline env secrets:

```sh
pnpm secrets:migrate-inline-env         # dry run
pnpm secrets:migrate-inline-env --apply # apply migration
```

## CLI Client Operations

Paperclip CLI now includes client-side control-plane commands in addition to setup commands.

Quick examples:

```sh
pnpm paperclip issue list --company-id <company-id>
pnpm paperclip issue create --company-id <company-id> --title "Investigate checkout conflict"
pnpm paperclip issue update <issue-id> --status in_progress --comment "Started triage"
```

Set defaults once with context profiles:

```sh
pnpm paperclip context set --api-base http://localhost:3100 --company-id <company-id>
```

Then run commands without repeating flags:

```sh
pnpm paperclip issue list
pnpm paperclip dashboard get
```

See full command reference in `doc/CLI.md`.
