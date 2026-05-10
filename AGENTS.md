# Nexidesk — agent notes

## Cursor Cloud specific instructions

- **Canonical programme spec:** start from [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md), which links the three plan files under `docs/plans/`.
- **Pinning in Cursor:** use paths under `docs/plans/` (for example `@docs/plans/o365-ticketing-migration_338a5375.plan.md` for the hub). The hub document lists which files to pin for backend-only, frontend-only, or full-stack sessions.
- **Contract:** the backend plan’s §8 API surface is binding for frontend work; do not invent endpoints or ship mock data on the production request path (see frontend plan).
- **App commands** live under `web/package.json`: `pnpm dev`, `pnpm lint`, `pnpm test`, `pnpm build`. Run them from `/workspace/web` or `pnpm -C web <script>` from repo root (no workspace file yet — use `-C web`).
- **Supabase migrations** are in `supabase/migrations/`; **`supabase db reset --local` requires Docker.** Without Docker you can still lint/build/test the Next app (`web/`) with env vars pointing at a hosted Supabase project.
- Prefer this file + [README.md](README.md) for durable runbook cues instead of repeating them in prompts.
