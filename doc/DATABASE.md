# Database

Paperclip uses PostgreSQL via [Drizzle ORM](https://orm.drizzle.team/). There are three ways to run the database, from simplest to most production-ready.

## 1. Embedded (PGlite) — zero config

If you don't set `DATABASE_URL`, the server automatically starts an embedded PostgreSQL instance powered by [PGlite](https://pglite.dev/). No installation, no Docker, no setup.

```sh
pnpm dev
```

That's it. On first start the server:

1. Creates a `./data/pglite/` directory for storage
2. Pushes the Drizzle schema to create all tables
3. Starts serving requests

Data persists across restarts in the `./data/pglite/` directory. To reset the database, delete that directory.

**Limitations:**

- Single connection only (no concurrent access from multiple processes)
- Slower than native PostgreSQL (runs in WebAssembly)
- Not suitable for production

This mode is ideal for getting started, local development, and demos.

## 2. Local PostgreSQL (Docker)

For a full PostgreSQL server locally, use the included Docker Compose setup:

```sh
docker compose up -d
```

This starts PostgreSQL 17 on `localhost:5432`. Then set the connection string:

```sh
cp .env.example .env
# .env already contains:
# DATABASE_URL=postgres://paperclip:paperclip@localhost:5432/paperclip
```

Run migrations (once the migration generation issue is fixed) or use `drizzle-kit push`:

```sh
DATABASE_URL=postgres://paperclip:paperclip@localhost:5432/paperclip \
  npx drizzle-kit push
```

Start the server:

```sh
pnpm dev
```

## 3. Hosted PostgreSQL (Supabase)

For production, use a hosted PostgreSQL provider. [Supabase](https://supabase.com/) is a good option with a free tier.

### Setup

1. Create a project at [database.new](https://database.new)
2. Go to **Project Settings > Database > Connection string**
3. Copy the URI and replace the password placeholder with your database password

### Connection string

Supabase offers two connection modes:

**Direct connection** (port 5432) — use for migrations and one-off scripts:

```
postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Connection pooling via Supavisor** (port 6543) — use for the application:

```
postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

### Configure

Set `DATABASE_URL` in your `.env`:

```sh
DATABASE_URL=postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

If using connection pooling (port 6543), the `postgres` client must disable prepared statements. Update `packages/db/src/client.ts`:

```ts
export function createDb(url: string) {
  const sql = postgres(url, { prepare: false });
  return drizzlePg(sql, { schema });
}
```

### Push the schema

```sh
# Use the direct connection (port 5432) for schema changes
DATABASE_URL=postgres://postgres.[PROJECT-REF]:[PASSWORD]@...5432/postgres \
  npx drizzle-kit push
```

### Free tier limits

- 500 MB database storage
- 200 concurrent connections
- Projects pause after 1 week of inactivity

See [Supabase pricing](https://supabase.com/pricing) for current details.

## Switching between modes

The database mode is controlled entirely by the `DATABASE_URL` environment variable:

| `DATABASE_URL` | Mode |
|---|---|
| Not set | Embedded PGlite (`./data/pglite/`) |
| `postgres://...localhost...` | Local Docker PostgreSQL |
| `postgres://...supabase.com...` | Hosted Supabase |

Your Drizzle schema (`packages/db/src/schema/`) stays the same regardless of mode.
