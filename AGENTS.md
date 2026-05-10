# Nexidesk — agent notes

## Cursor Cloud specific instructions

- **Canonical programme spec:** start from [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md), which links the three plan files under `docs/plans/`.
- **Pinning in Cursor:** use paths under `docs/plans/` (for example `@docs/plans/o365-ticketing-migration_338a5375.plan.md` for the hub). The hub document lists which files to pin for backend-only, frontend-only, or full-stack sessions.
- **Contract:** the backend plan’s §8 API surface is binding for frontend work; do not invent endpoints or ship mock data on the production request path (see frontend plan).
- Once the app and tooling exist, prefer the repo’s `README.md` and `package.json` scripts for install, lint, test, and dev commands rather than duplicating them here.
