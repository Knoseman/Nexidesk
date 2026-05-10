# Nexidesk

Shared **Microsoft 365** mailbox → self-hosted ticketing (Supabase + Next.js on Vercel, EU regions — see backend plan).

**Project plan:** [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) and [docs/plans/](docs/plans/).

## Repo layout

| Path | Contents |
| --- | --- |
| `web/` | Next.js 15 App Router — UI (`/app/tickets`), `GET /api/tickets`, Microsoft OAuth via Supabase |
| `supabase/` | Migrations (`migrations/*.sql`), `seed.sql`, local CLI config |
| `tests/rls/` | Per-milestone Postgres RLS checks (psql against local or linked DB) |

## Development

1. **Dependencies:** From repo root:

   ```bash
   cd web && pnpm install
   ```

2. **Environment:** Copy [`web/.env.example`](web/.env.example) to `web/.env.local` and set Supabase URL + anon key. Configure **Azure (Microsoft)** as an OAuth provider in the Supabase dashboard (single tenant per programme plan). Map sign-in emails to rows in `public.agents` (seeded locally via `seed.sql`; adjust emails to match Entra accounts).

3. **Database (local):** Requires Docker. Then:

   ```bash
   supabase db reset --local    # migrations + seed
   ```

   Milestone verification also uses `tests/rls/m1.sql` (see backend plan §11.V):

   ```bash
   export SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f tests/rls/m1.sql
   ```

4. **App:**

   ```bash
   cd web && pnpm dev
   ```

5. **Quality:**

   ```bash
   cd web && pnpm lint && pnpm test && pnpm build
   ```

`web/vercel.json` pins the default deployment region to `arn1` (Stockholm). Override in the dashboard if you use Frankfurt per plan.
