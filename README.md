# Nexidesk

Self-hosted helpdesk for teams using a shared **Microsoft 365** mailbox.

## Quick start

**Prerequisites:** Node.js LTS, [pnpm](https://pnpm.io/) (`corepack enable`)

```bash
pnpm install
pnpm dev          # Turbopack dev server at http://localhost:3000
```

Copy `.env.example` → `.env.local` and fill in the minimum set:

```
DATABASE_URL=postgresql://...neon.tech/nexidesk?sslmode=require
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...
```

## Full documentation

| Doc | What it's for |
|---|---|
| [`docs/INFRA.md`](docs/INFRA.md) | Provisioning — Neon, Entra ID, Railway step-by-step |
| [`docs/DEPLOY_NOTES.md`](docs/DEPLOY_NOTES.md) | Railway deployment troubleshooting |
| [`docs/SECURITY_AUDIT.md`](docs/SECURITY_AUDIT.md) | Security findings and remediation log |
| [`docs/FUTURE_FEATURES.md`](docs/FUTURE_FEATURES.md) | Feature backlog and priority order |

## Scripts

```bash
pnpm lint && pnpm test   # check before committing
pnpm build               # production build (output: standalone)
```

See `package.json` for the full script list (`pnpm db:*`, `pnpm imap:*`, `pnpm graph:*`, etc.).
