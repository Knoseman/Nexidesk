# Nexidesk — Infrastructure Setup (Railway + Neon + Microsoft Entra)

Repeatable steps for provisioning Nexidesk's hosted footprint on the fresh-start stack (Railway EU · Neon Postgres EU · Microsoft Entra ID).

**EU residency targets:** Neon Frankfurt (`eu-central-1`) · Railway EU West · R2 EU bucket.

---

## Step 1 — Neon Postgres (database)

1. **Create project** at [neon.tech](https://neon.tech) → New project.
2. **Region:** choose **EU Central (Frankfurt)** — cannot be changed after provisioning.
3. **Database name:** `nexidesk`.
4. **Connection string:** Settings → Connection Details → copy the pooled connection string (includes `?sslmode=require`).
   - Add to Railway env vars and local `.env.local` as `DATABASE_URL`.
5. **Run migrations:** once the app is deployed (or locally with env set):
   ```bash
   DATABASE_URL=<neon-url> pnpm db:migrate
   ```
   This applies pending files under `drizzle/` (initial schema `0001_initial.sql`, plus later migrations such as outbound queue columns `0002` / `0003`). If migrations were partially applied before the Drizzle journal existed, use **`pnpm db:baseline`** once before `pnpm db:migrate`.
6. **Seed agents:** insert at least one row into `public.agents` matching the Entra ID email that will sign in:
   ```sql
   INSERT INTO agents (email, name, role) VALUES ('you@org.com', 'Your Name', 'admin');
   ```

---

## Step 2 — Microsoft Entra ID app registration

Needed for both **NextAuth sign-in** (delegated, user-facing) and later **IMAP/Graph service account** (M2/M4).

### Sign-in app (M1)

1. Azure Portal → **Microsoft Entra ID → App registrations → New registration**.
2. **Name:** `Nexidesk`.
3. **Supported account types:** *Accounts in this organizational directory only* (single-tenant) is the default. External users (e.g. contractors with @outlook.com / @hotmail.com) are invited as B2B guests via `/api/register` so they can sign in through the same tenant-specific endpoint.
4. **Redirect URI:** type **Web**; value = `https://<your-railway-domain>/api/auth/callback/microsoft-entra-id`
   - For local dev add: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
5. **Certificates & secrets → New client secret** → copy the **Value** immediately (shown once).
6. **Overview** → copy **Application (client) ID** → `AZURE_AD_CLIENT_ID`, and **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`.
7. **API permissions:** default `openid`, `profile`, `email` (delegated) is sufficient for sign-in.

### IMAP / Graph service account (M2, M4)

The same app registration can be reused with additional delegated scopes (`IMAP.AccessAsUser.All`, `Mail.Send`), or a separate registration per least-privilege. Token helpers are available as `pnpm imap:token` and `pnpm graph:token`.

---

## Step 3 — Railway service

1. **New project → Deploy from GitHub repo** → select this repo.
2. **Root directory:** leave as `/` (repo root contains `railway.toml` and `package.json`).
3. **Environment variables** (set in Railway dashboard → Variables):

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Neon pooled connection string |
   | `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | `https://<your-railway-domain>` |
   | `AZURE_AD_CLIENT_ID` | From Step 2 |
   | `AZURE_AD_CLIENT_SECRET` | From Step 2 |
   | `AZURE_AD_TENANT_ID` | From Step 2 |
   | `PORT` | `3000` |
   | `HOSTNAME` | `0.0.0.0` |

   **Optional branding overrides** (omit to keep Nexi defaults):

   | Variable | Purpose |
   |----------|---------|
   | `NEXT_PUBLIC_BRAND_NAME` | Product name shown in UI and page title |
   | `NEXT_PUBLIC_BRAND_TAGLINE` | Tagline on login screen |
   | `NEXT_PUBLIC_BRAND_PRIMARY` | Primary/accent hex colour |
   | `NEXT_PUBLIC_BRAND_SIDEBAR` | Sidebar background hex colour |
   | `NEXT_PUBLIC_BRAND_LOGO_URL` | Path or URL to wordmark image (default `/nexi-logo.png`) |
   | `NEXT_PUBLIC_BRAND_LOGO_RATIO` | Logo width÷height ratio (default `3.062`) |
   | `NEXT_PUBLIC_BRAND_FAVICON_URL` | Path or URL to favicon; if unset, `src/app/favicon.ico` is used |

   See `.env.example` for the full list including `_PRIMARY_FG`, `_SIDEBAR_FG`, and `_ACCENT`.

4. **Deploy** → Railway runs `next build` (Nixpacks detects Next.js) then `node .next/standalone/server.js`.
5. **Health check:** Railway probes `GET /api/health` — should return `{"status":"ok"}`.
6. **Custom domain (optional):** Railway dashboard → Settings → Domains → add your domain and configure DNS.

---

## Step 4 — Verify sign-in

1. Open `https://<your-railway-domain>/`.
2. Click **Continue with Microsoft** → complete Entra ID SSO.
3. Expect redirect to `/app/tickets` after a successful sign-in.
4. If you see "Access denied": the signed-in email is not in `public.agents` — insert a row (Step 1.6).

---

## Step 5 — Later milestones

| Milestone | What to provision |
|-----------|-------------------|
| M2 (IMAP inbound) | IMAP XOAUTH2 refresh token (`IMAP_OAUTH_REFRESH_TOKEN`), IMAP app scope |
| M4 (outbound) | Graph delegated `Mail.Send` refresh token (`GRAPH_OAUTH_REFRESH_TOKEN`) |
| M6 (attachments) | Cloudflare R2 EU bucket + access keys (`R2_*` vars) |

**Variable names, scripts (`pnpm imap:*`, `pnpm graph:token`, `pnpm outbound:poll`), and mailbox setup** are documented in `.env.example` and `package.json`.
