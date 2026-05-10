---
name: o365-ticketing-migration
overview: Hub — O365 shared mailbox to ticketing; narrative split into backend and frontend plans (same programme). Track execution in the backend/frontend todos below or in the split files.
todos:
  - id: m1-foundations
    content: "See backend plan — Foundations"
    status: pending
  - id: m2-inbound
    content: "See backend plan — Inbound PA + webhook"
    status: pending
  - id: m3-threading
    content: "See backend plan — Threading; frontend plan — thread UI"
    status: pending
  - id: m4-folder-move
    content: "See backend plan — Mailbox folder move"
    status: pending
  - id: m5-outbound
    content: "See backend plan — Outbound queue; frontend plan — composer"
    status: pending
  - id: m6-dogfood
    content: "See backend plan — Dogfood"
    status: pending
  - id: m7-attachments
    content: "See backend plan — Attachments; frontend plan — attachment UI"
    status: pending
  - id: m8-audit-admin
    content: "See backend plan — Audit/admin API (audit_logs writes + merged audit read); frontend plan — admin surfaces + merged audit timeline"
    status: pending
  - id: m9-gdpr
    content: "See backend plan — GDPR SQL/API; frontend plan — GDPR UX"
    status: pending
  - id: m10-backfill
    content: "See backend plan — Backfill + runbook"
    status: pending
  - id: m11-cutover
    content: "See backend plan — Customer cutover"
    status: pending
  - id: m12-stabilize
    content: "See backend plan — Stabilization + snippets API; frontend plan — snippets composer/management + a11y polish"
    status: pending
isProject: false
---

# O365 ticketing migration (hub)

This programme is split into two linked plans:

- **[Backend — API, data model, workers, email](o365-ticketing-migration-backend.plan.md)** — Supabase + Next.js API, Power Automate inbound default, Graph-only outbound, threading, idempotency, jobs, GDPR, milestones §1–§14.
- **[Frontend — agent UI](o365-ticketing-migration-frontend.plan.md)** — Next.js App Router, shadcn/ui, Tiptap, DOMPurify, routes, auth UX; §15 UI architecture and checklist; contract against backend §8.

Each plan’s introduction links to the other. When you change API shapes, payloads, milestones, or UI scope, update **both** plans in the same change.

The previous single-file narrative was merged into these two paths (2026-05). If you need the exact pre-split text, recover it from git history for this file.

---

## Code Execution Strategy (programme-wide)

This section defines **how** the work in the backend and frontend plans is to be executed by an AI coding agent (or any solo dev pairing with one). It does not change technical specs — Stockholm region (`eu-north-1` / `arn1`), Power Automate inbound default, and Microsoft Graph outbound are unchanged. It only constrains workflow, sequencing, and verification.

### 1. Source of truth — pin the plan files every session

- The three plan files are the source of truth. Code that disagrees with the plan is wrong; the plan that disagrees with reality must be updated **in the same change** as the code.
- At the start of every session, **pin the relevant plan file(s) to chat context** (`@o365-ticketing-migration_338a5375.plan.md` for cross-cutting decisions, `@o365-ticketing-migration-backend.plan.md` for API/data/worker work, `@o365-ticketing-migration-frontend.plan.md` for UI work). When a change spans both halves, pin **both** split plans plus the hub.
- A session that touches API shapes, payloads, milestones, or UI scope must end with both split plans updated and the hub re-read for consistency.

### 2. Milestone-driven workflow (backend leads, frontend follows)

- Backend executes milestones strictly in order: **M1 → M2 → … → M12**. No starting M(n+1) until M(n)'s verification block passes (see §4 below).
- Frontend trails backend by at most one milestone for any given concern. Compose UI (M5) does not begin until backend M5's `POST /api/tickets/:id/messages` returns a real, contract-conformant response. Audit panel (M8) does not begin until backend M8's `GET /api/tickets/:id/audit` returns the merged shape.
- New features added during the programme (snippets in M12, etc.) follow the same rule: backend lands first, frontend probes the endpoint, then UI work begins.

### 3. Contract enforcement (frontend → backend §8)

- The backend plan's **§8 API surface** is a strict contract. The frontend must not invent endpoints, change payloads, or assume undocumented fields.
- Before any UI work for a given route, **verify the endpoint is functional** with a terminal probe (`curl` / `httpie`) and confirm the response shape against the React component's expectations. If the endpoint 404s, returns the wrong shape, or hangs, **stop** and finish the backend side first; do not paper over an unfinished API with mock data in production code.
- Mock data is allowed in **storybook / fixture tests only** — never in the request path that ships.

### 4. Verification loop — `supabase db` + RLS + audit_logs after every milestone

After completing a milestone (in either plan), run the verification block before claiming it done.

```bash
# 1. Migrations are reproducible from a clean DB.
supabase db reset --local        # local-first; or `--linked` against a scratch project
supabase db lint                 # static checks on policies, triggers, indexes

# 2. RLS holds for every protected table touched by this milestone.
psql "$SUPABASE_DB_URL" -f tests/rls/$MILESTONE.sql
#   - Each tests/rls/<milestone>.sql impersonates an active agent, an inactive
#     agent, an unknown email, and an admin via SET LOCAL request.jwt.claims = '...'.
#   - Asserts row counts on tickets, messages, outbound_queue, snippets, audit_logs.
#   - RAISE EXCEPTION when a denial returns rows or an allow returns zero.

# 3. audit_logs entries exist for every state-changing path introduced in this milestone.
psql "$SUPABASE_DB_URL" -f tests/audit/$MILESTONE.sql
#   - Exercises every endpoint that mutates a ticket and asserts exactly one
#     audit_logs row with the expected action + metadata shape.

# 4. App-level tests for the milestone scope.
pnpm test --filter=<scope>       # vitest / jest; or `npm test`

# 5. Frontend-only: probe the endpoints the UI will hit.
curl -sS -H "Authorization: Bearer $AGENT_JWT" "$BASE_URL/api/tickets?status=open" | jq '.[0] | keys'
```

The split plans embed milestone-specific versions of this block. **Do not skip it.** A milestone without a green verification run is not done.

### 5. Feature-to-milestone integration (this programme)

| Feature | Milestone | Owner half | Notes |
|---|---|---|---|
| Per-agent **signatures** (`agents.signature_html`, worker injection) | **M5 (Outbound)** | Backend leads, frontend `/app/account` follows | See backend §7 worker pseudocode. |
| **Audit trail** (`audit_logs` writes from every state-changing endpoint, merged read in `GET /api/tickets/:id/audit`) | **M8 (Admin / audit)** | Backend leads, frontend audit panel follows | Two streams, one merged read with a `source` discriminator. |
| **Snippets** (`snippets` table, CRUD endpoints, composer picker, management UI) | **M12 (Stabilization)** | Backend + frontend together as a stabilization-phase add-on | Schema lands in M1 alongside everything else, but API/UI deliver in M12 once the core ticketing loop is stable. |

### 6. What does **not** change under this strategy

- Data residency (Sweden / EU; Stockholm preferred, Frankfurt fallback).
- Inbound default = **Power Automate** (E1) → `/api/webhooks/power-automate` → 2xx → PA move to `Inbox/Ticketed`. IMAP backstop.
- Outbound = **Microsoft Graph only**, two-phase `outbound_queue`, `x-outbound-id`, Sent Items reconciler.
- Threading, idempotency, GDPR (anonymise + 7-year retention from `closed_at`), Teams alerting with 1h debounce.

These are decided in backend §13 and stay decided.
