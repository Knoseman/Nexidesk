# Nexidesk — project plan index

This repository implements **Nexidesk**: migration from a shared **Microsoft 365** mailbox to a self-hosted ticketing system (Supabase + Next.js on Vercel, EU regions — Stockholm preferred).

## Canonical plan documents

All detailed specifications live under [`docs/plans/`](plans/):

| Document | Role |
| -------- | ---- |
| [`docs/plans/o365-ticketing-migration_338a5375.plan.md`](plans/o365-ticketing-migration_338a5375.plan.md) | **Hub** — programme milestones (M1–M12), cross-cutting workflow, verification loops, pinning instructions |
| [`docs/plans/o365-ticketing-migration-backend.plan.md`](plans/o365-ticketing-migration-backend.plan.md) | **Backend** — data model, webhooks (Power Automate inbound default), Graph outbound, workers, API contract (§8), milestones §11 |
| [`docs/plans/o365-ticketing-migration-frontend.plan.md`](plans/o365-ticketing-migration-frontend.plan.md) | **Frontend** — Next.js App Router UI, routes, milestone mapping, §15 UX architecture |

**Rule:** backend leads; frontend trails by at most one milestone per concern. API shapes in backend §8 are the contract for the UI. When you change endpoints, payloads, milestones, or UI scope, update **both** split plans and re-check the hub for consistency (see hub “Code Execution Strategy”).

## High-level technical choices (unchanged from plans)

- **Inbound (default):** Power Automate → signed webhook → move to `Inbox/Ticketed`; IMAP reconciler as backstop.
- **Outbound:** Microsoft Graph only (no PA for sends); `outbound_queue`, two-phase send, per-agent `signature_html` from M5.
- **Data:** EU residency; attachments, retention (7 years from close), GDPR anonymise/export as specified in the backend plan.

## Where to start

1. Read the **hub** for sequencing and verification expectations.
2. For implementation work, open the **backend** or **frontend** plan (or both) and pin them in Cursor as described in the hub.
