---
name: o365-ticketing-migration-frontend
overview: Frontend plan for Next.js App Router agent UI, paired with o365-ticketing-migration-backend.plan.md for API/workers contract and milestone alignment. Strict §8 contract enforcement; endpoint probes precede UI work; per-milestone verification of RLS + audit_logs. Signatures land in M5, merged audit timeline in M8, snippets in M12 (stabilization).
todos:
  - id: fe-m1-shell
    content: "App shell + auth UX: route groups, protected layout, loading/empty/error states, basic tickets landing screen, and account page scaffolding for signature edit"
    status: pending
  - id: fe-m3-thread
    content: "Ticket thread UI: message timeline, quoted-text collapse, status/assignee controls, and audit entry points (merged email_events + audit_logs)"
    status: pending
  - id: fe-m5-compose
    content: "Composer UX: reply/internal-note toggle, queue-state indicators from outbound_queue (queued/sending/failed/dead) — no optimistic Sent. Account page: signature_html editor (Tiptap, sanitized) backed by PATCH /api/agents/me; render a small 'signature will be appended on send' hint in composer rather than embedding live signature in editor. Snippets picker is NOT in M5 — deferred to M12 with the snippets API."
    status: pending
  - id: fe-m7-attachments
    content: "Attachment handling: upload/download surfaces, inline previews where safe, and clear oversize/failure messaging"
    status: pending
  - id: fe-m8-admin
    content: "Admin surfaces: health dashboard cards, mailbox config forms, merged audit timeline view (email_events + audit_logs with source discriminator), and operational drill-down states. Global snippet management deferred to M12."
    status: pending
  - id: fe-m9-gdpr
    content: "GDPR UX: anonymise/export forms (export now includes merged audit timeline), confirmation flows, and operator checklist prompts for mailbox-side deletion"
    status: pending
  - id: fe-m12-snippets-a11y
    content: "M12 stabilization deliverables: snippets composer integration (slash-command + toolbar button, global vs personal sections, keyboard nav, snippet_id round-trip), /app/snippets management page (personal CRUD for all agents; global CRUD for admins), full a11y pass (keyboard flow, focus order, labels/announcements, contrast checks), copy refinements"
    status: pending
isProject: false
---

# Frontend plan: O365 ticketing UI

## Pairing with backend

**Backend:** [o365-ticketing-migration-backend.plan.md](o365-ticketing-migration-backend.plan.md) — API routes (§8), workers, Postgres/RLS, and milestones §11.

The backend plan's §8 API surface is the contract for this UI. Frontend scope, route behaviors, and queue-state rendering must track backend payloads and milestone sequencing.

## Code Execution Strategy (frontend)

This section is binding for any session that touches the frontend. It complements the programme-wide strategy in the hub plan and the backend strategy in backend §11.0.

### A. Pin this plan + the backend plan at session start

Every frontend session must begin by pinning **both** `@o365-ticketing-migration-frontend.plan.md` and `@o365-ticketing-migration-backend.plan.md` to chat context (and the hub when cross-cutting decisions are in play). Backend §8 is the contract; you must read it before coding the route that consumes it.

### B. Strict contract enforcement against backend §8

The backend plan's §8 API surface is **strict**. The frontend must not:
- invent endpoints that don't exist in §8;
- assume fields that aren't documented in §8;
- silently change a payload shape and rely on coincidence at runtime;
- ship mock data on the request path. Mocks live only in storybook fixtures and tests.

Before any UI work for an endpoint, **verify the endpoint is functional** with a terminal probe and confirm the response shape matches the React component's expectations:

```bash
# Issue a JWT for a test agent (Supabase Auth admin API or a local helper script).
export AGENT_JWT=$(pnpm tsx scripts/issue-test-jwt.ts agent.alice@corp)
export BASE_URL=http://localhost:3000

# 1. List endpoint shape probe
curl -sS -H "Authorization: Bearer $AGENT_JWT" \
     "$BASE_URL/api/tickets?status=open" | jq '.[0] | keys'

# 2. Detail endpoint shape probe
curl -sS -H "Authorization: Bearer $AGENT_JWT" \
     "$BASE_URL/api/tickets/1" | jq 'keys'

# 3. State-changing endpoint smoke (must round-trip + write audit_logs)
curl -sS -X PATCH -H "Authorization: Bearer $AGENT_JWT" \
     -H 'content-type: application/json' \
     -d '{"status":"pending"}' \
     "$BASE_URL/api/tickets/1" | jq

# 4. Confirm the audit row was written (read-side integration check)
curl -sS -H "Authorization: Bearer $AGENT_JWT" \
     "$BASE_URL/api/tickets/1/audit" \
     | jq '.[] | select(.source=="audit_log" and .action=="status_change") | .metadata'
```

If any probe 404s, returns the wrong shape, or returns 200 without writing the expected `audit_logs` row, **stop**. The backend is not done with this milestone yet; finish it (or escalate) before continuing UI work.

### C. Verification loop after every frontend milestone

In addition to the backend's §11.V (which the frontend session must re-run if migrations were touched), the frontend runs:

```bash
# 1. Reproducible local stack
supabase db reset --local
pnpm dev   # Next.js + Vercel-style /api routes against the local Supabase

# 2. Endpoint probes for every route in the milestone (see §B above)
pnpm tsx scripts/probe-endpoints.ts --milestone=$MILESTONE

# 3. RLS check from the UI's perspective: probe with three JWTs and assert
#    visibility matches the spec (active agent, unknown email, admin).
pnpm tsx scripts/probe-rls.ts --milestone=$MILESTONE

# 4. audit_logs check from the UI's perspective: drive the route(s) introduced
#    in this milestone via Playwright; for every state change, assert that
#    GET /api/tickets/:id/audit picks up the new audit_log row with source='audit_log'.
pnpm playwright test --grep "@audit @milestone-$MILESTONE"

# 5. Component / unit tests including DOMPurify fixtures for any HTML the UI renders
#    (snippet content, agent signature_html, inbound message body_html).
pnpm test --filter=frontend
```

The Playwright `@audit` tag is reserved for tests that assert the merged audit timeline behaviour — every milestone that introduces a state-changing UI affordance must contribute at least one `@audit @milestone-N` test.

### D. Milestone trailing rule

Frontend trails backend by at most one milestone for any given concern. Concretely:
- Compose UI (FE M5) does not start until backend M5's `POST /api/tickets/:id/messages` returns the contract-conformant queue state and writes `reply_sent` to `audit_logs`.
- Audit panel (FE M8) does not start until backend M8's `GET /api/tickets/:id/audit` returns the merged shape with the `source` discriminator.
- Snippets composer / management (FE M12) does not start until backend M12's `/api/snippets` CRUD is live and `POST /api/tickets/:id/messages` accepts `snippet_id` and writes `audit_logs(action='snippet_used')`.

If these endpoints are not yet functional, the frontend session **stops**, records the gap in this plan, and switches to a backend session. No mocks-on-the-request-path workaround.

## Contract summary

- Auth model is tenant-restricted Microsoft SSO; UI shows access-request state when RLS denies data.
- Ticket list/detail/actions map directly to `/api/tickets*` endpoints with cursor-driven pagination.
- Message send flow reflects `outbound_queue` truth states (`pending`, `sending`, `sent`, `failed`, `dead`) instead of optimistic "sent". The composer **does not** render the agent's signature inline — the worker appends it at send time; the composer only shows a small "your signature will be appended" hint plus a one-click "Preview with signature" affordance that reads `signature_html` from `/api/agents/me`.
- **Snippets** (delivered in **M12**, not M5): picker in the composer (slash-command `/` plus a toolbar button) backed by `GET /api/snippets`, with personal and global snippets visually grouped. When a snippet is inserted, the resulting `POST /api/tickets/:id/messages` request carries `snippet_id` so the server records `audit_logs(action='snippet_used')`. Until M12 ships, the composer renders **without** a snippets affordance — agents type free-form replies. No `snippet_id` field is sent.
- Admin pages depend on `/api/admin/health`, `/api/admin/mailbox-config`, and GDPR anonymise/export routes. `/api/snippets` CRUD (admin-only for global snippets) is added in M12.
- **Audit visibility** uses `/api/tickets/:id/audit` as the source of operational history. The response is a **merged timeline** of `email_events` (technical) and `audit_logs` (human actions like status change, assignment, snippet use, reply, anonymisation); the UI styles each `source` differently so agents can scan the human story without losing access to the underlying technical telemetry.
- Self-service account settings (`/app/account`) backed by `GET/PATCH /api/agents/me` for `name` and `signature_html` (Tiptap editor + DOMPurify on submit).

## Routes (`/app/*`)

| Route | Purpose | Backend dependency |
|---|---|---|
| `/app/tickets` | Filtered ticket list with cursor pagination and empty/error states | `GET /api/tickets` |
| `/app/tickets/[id]` | Full ticket detail, thread, banners, and right-rail properties | `GET /api/tickets/:id`, `PATCH /api/tickets/:id` |
| `/app/tickets/[id]/compose` | Reply/internal-note compose surface (or sheet/modal variant). Ships in M5 **without** the snippets picker; the picker is added in **M12**. | `POST /api/tickets/:id/messages` (M5); `GET /api/snippets` + `snippet_id` in body (M12) |
| `/app/tickets/[id]/audit` | Ticket-level merged audit trail (technical + human) | `GET /api/tickets/:id/audit` (M8) |
| `/app/account` | Personal profile + **HTML signature editor** (Tiptap + DOMPurify) | `GET /api/agents/me`, `PATCH /api/agents/me` (M5) |
| `/app/snippets` *(M12)* | List/create/edit personal snippets; admins also see/edit global snippets here | `GET/POST/PATCH/DELETE /api/snippets` (M12) |
| `/app/admin` | Health overview cards and queue summaries | `GET /api/admin/health` |
| `/app/admin/mailbox` | Mailbox configuration management | `GET/PUT /api/admin/mailbox-config` |
| `/app/admin/gdpr` | Anonymise + export request workflows | `POST /api/admin/gdpr/anonymise`, `GET /api/admin/gdpr/export` |

## Data fetching

- Use server components for initial list/detail payload hydration where possible.
- Use client mutations for status, assignee, compose submit, and admin forms with explicit retry/error states.
- Keep pagination cursor in URL params for shareable agent context.
- Revalidate detail and list views after write operations to avoid stale queue-state displays.
- Cache lightweight metadata separately from heavy message thread bodies to keep route transitions responsive.

## Security

- Sanitize inbound HTML with DOMPurify before rendering; fallback to plain-text blocks when sanitization fails.
- **Snippet `content`** and **agent `signature_html`** are author-supplied HTML — pass both through DOMPurify on **save** (`POST/PATCH /api/snippets`, `PATCH /api/agents/me`) and on **render** (composer insert, signature preview). Reject `<script>`, event handlers, and `javascript:` URLs at both ends; the backend should also sanitize defensively before persisting.
- Treat internal notes as a distinct message type with explicit labels and visual separation from customer-visible content. **Internal notes never get a signature** — the composer must visually confirm this when the agent toggles to internal-note mode.
- Never render raw MIME or header blobs directly into the DOM without escape/sanitization.
- Respect backend auth boundaries: UI affordances do not substitute for server-side authorization checks (snippets visibility, signature edits, audit reads).

## Milestone mapping to backend §11

- **M1 foundations:** shell, auth gate, empty list scaffolding, `/app/account` route stub (signature editor wired in M5).
- **M3 threading + read state + search:** timeline rendering, quoted-text collapse, ticket header controls. **Unread indicator** on list rows (bold / dot badge); "Unread only" filter chip calls `?unread=true`; detail-view mount fires `POST /api/tickets/:id/read`. **Full-text search bar** in the ticket list header wires `?q=` to the backend's `websearch_to_tsquery` endpoint.
- **M5 outbound:** compose UX, send-state badges, retry/failure affordances, **signature editor** at `/app/account` (Tiptap + DOMPurify) backed by `PATCH /api/agents/me`, "signature appended on send" hint in composer + optional preview button. **No snippets picker yet** — composer ships free-text-only and is layered with snippets in M12.
- **M7 attachments:** attachment list/download/preview + error handling.
- **M8 admin/audit:** health cards, mailbox config UI, **merged audit timeline** (`source: 'email_event' \| 'audit_log'` discriminator, distinct visual treatment). Snippet-related audit rows (`snippet_used`) won't appear until M12 ships, but the timeline component must render unknown action types gracefully so M12 only adds copy, not new code paths.
- **M9 GDPR:** anonymise/export forms and manual Outlook checklist UX; export view also surfaces the merged audit timeline that ships with the JSON bundle.
- **M12 stabilization + snippets:**
  - **Snippets composer integration** in `/app/tickets/[id]/compose`: slash-command `/` picker + toolbar button, two visually grouped sections (Global / Personal), arrow-key nav, enter to insert, escape to dismiss. Insertion submits `snippet_id` in the `POST /api/tickets/:id/messages` body so the backend records `audit_logs(action='snippet_used')`.
  - **Snippets management** at `/app/snippets`: personal CRUD for all agents; admins additionally see a "Global snippets" section with create/edit/delete on `is_global` rows.
  - **Audit timeline** picks up the new `snippet_used` `audit_log` rows and renders them inline next to the corresponding `reply_sent` rows.
  - **Accessibility & polish pass** (the original M12 deliverable): keyboard flow across all routes, focus order, labels/announcements, contrast checks, and copy refinements.

## 15. Frontend UI (simple, beautiful, basics-only)

**Goal:** A calm, professional agent UI that covers **inbox, ticket, reply, internal note, attachments, status, assignee, audit, and admin health** — no feature creep beyond what §8 and milestones already require. Stack: **Next.js App Router + Tailwind + shadcn/ui** (see subagent “Frontend plan for ticketing UI” for routes and data-fetching); this section only defines **visual and information architecture** inspired by mature products.

### What to borrow (patterns, not pixels)

| Inspiration | Borrow this pattern | Apply in v1 |
|---|---|---|
| **Zendesk** | Split view: **ticket list left, conversation right**; dense metadata row (requester, channel, priority); clear **status** control | `/app/tickets` + `/app/tickets/[id]`: persistent two-pane layout on desktop; single column on mobile with back nav |
| **Freshdesk** | **Ticket ID + subject** always visible; compact **properties** panel (assignee, status); **reply** as primary action | Header strip: `TKT-N`, subject, requester email; right rail or collapsible drawer for assignee/status/requester edit (`PATCH`) |
| **monday.com** | **Colour-coded status** chips; board-like clarity (not the full board UI) | Status as coloured `Badge` + icon; filters as horizontal chips; avoid carnival colours — one semantic palette |
| **Help Scout** | **Conversation-first** layout; generous line height; **customer vs internal** visually distinct; minimal chrome | Thread: inbound left-aligned card, outbound right-aligned, **internal notes** with distinct background (e.g. warm yellow tint) and “Internal” label — never mistaken for customer-visible |
| **Sparrow / lightweight desk UIs** | **Restraint** — few buttons, strong typography, whitespace over decoration | One primary button per surface (“Reply”, “Save”); secondary actions in `DropdownMenu`; no marketing hero in app shell |

`[speculative]` “Sparrow desk” is interpreted as **small-desk / lightweight helpdesk** aesthetics (quiet chrome); if a specific product was meant, map the same principles: low noise, readable thread.

### Layout blueprint (desktop)

1. **App shell** — Left **narrow nav** (Tickets, Admin) + top bar (search, user menu). Height ~48px; no double headers.
2. **Tickets index** — **Master list** (60–65% width): row = status dot + `TKT-N` + subject one line + requester + relative time. **Sticky filters** above list (status, assignee, free text). Cursor “Load more” at bottom.
3. **Ticket detail** — **Conversation column** (main): chronological messages, newest at **bottom** (Zendesk/Freshdesk convention — agent reads upward or scrolls to bottom for latest). **Composer fixed to bottom** of pane (Help Scout pattern). Composer toolbar at M5: reply/internal-note toggle, basic formatting, "Preview with signature" toggle, send button. **Composer toolbar at M12** adds the **snippets** button (also reachable via `/`). Below the editor: a single muted line — "your signature will be appended on send" (replies) or "internal note — not sent, not signed" (notes).
4. **Properties** — **Right rail** 280–320px: assignee, status, requester (read + edit), flags (`needs_review`, bounce). Collapsible to icon on smaller breakpoints.
5. **Audit panel** — Tab or right-rail drawer on the ticket: **two-lane timeline** (human `audit_log` rows on the primary lane, dim technical `email_event` rows on the secondary lane), with a "show technical" toggle. Each row: timestamp, actor (agent name + avatar, or worker name), action label, and a small JSON-peek for `metadata`.
6. **Admin** — Separate area under `/app/admin/*`: **card grid** for health metrics (queue depth, PA last run, IMAP last run); forms for mailbox + GDPR with clear section headings; admin-only "Global snippets" management appears alongside personal snippets at `/app/snippets`.
7. **Account** — `/app/account`: name field + **HTML signature editor** with live preview rendered through the same sanitizer used in the thread; "Test send to me" button enqueues a one-off mail to the signed-in agent so they can see how the signature renders in Outlook before customers do.

### Visual system (keep implementation cheap)

- **Typography:** One sans stack (e.g. Geist or `system-ui`); **15–16px body** in thread; **13–14px meta** (timestamps, headers). Ticket subject **18px semibold** in header.
- **Colour:** Neutral background (`zinc`/`slate` 50–100), **white** cards, **one accent** for links and primary button (e.g. blue 600). Status colours: **open** blue, **pending** amber, **resolved** green, **closed** gray — consistent with chips in list and detail.
- **Radius / shadow:** shadcn defaults; **shadow-sm** on list rows on hover only; avoid heavy drop shadows everywhere.
- **Density:** Default **comfortable** row height (~56px list rows); optional compact mode later — out of scope v1.

### Basics checklist (must ship)

- [ ] **(M3)** **Unread state:** ticket list shows a visual indicator (bold row, dot badge, or distinct background) for tickets with activity since the agent last viewed them. Backed by `?unread=true` filter from `GET /api/tickets` + `POST /api/tickets/:id/read` called on detail-view mount. An "Unread only" chip in the filter bar toggles the flag.
- [ ] List: filter, sort by updated, empty state, error retry  
- [ ] Detail: full thread, **sanitised HTML** bodies, plain-text fallback, **collapse quoted** previous replies (milestone 3)  
- [ ] Reply vs **internal note** toggle; **no optimistic “Sent”** — show Queued / Sending / Failed from API truth (§15 aligns with outbound_queue behaviour)  
- [ ] **(M12)** **Snippets picker** in composer: `/` slash command + toolbar icon; sections for **Global** and **Personal** snippets; arrow-key nav + enter to insert; insertion submits `snippet_id` with the message so the audit log records `snippet_used`  
- [ ] **(M5)** **Signature affordance:** composer shows a small footnote "your signature will be appended on send" plus a "Preview with signature" toggle that pulls `signature_html` from `/api/agents/me`; for **internal notes** the toggle is hidden and the footnote reads "internal — not signed, not sent"  
- [ ] **(M5)** **Account / signature editor** at `/app/account`: Tiptap editor for `signature_html`, DOMPurify on save, save+revert controls, plain-text preview alongside HTML  
- [ ] **(M12)** **Personal snippets management** at `/app/snippets`: list + create/edit/delete; admins see a "Global snippets" section in the same view  
- [ ] Attachments: list + download; oversize / failed clearly messaged  
- [ ] **Banners** for bounce, parse failure, outbound dead, threading review (`needs_review`) — persistent on ticket, not toast-only  
- [ ] **Merged audit panel** linked to `GET /api/tickets/:id/audit`: chronological timeline, two visual lanes (technical `email_event` vs human `audit_log`); filter chip to hide technical events for a "what did the team do" view; show actor avatar/name for `audit_log` rows and the worker source for `email_event` rows  
- [ ] Admin health + mailbox + GDPR screens per §8  

### Explicit non-goals (UI)

- No **kanban** or customisable dashboards (monday-style boards) in v1  
- No **real-time presence** (“Agent X viewing”)  
- No **command palette** / power-user launcher unless trivial (defer)  
- No **dark mode** requirement v1 — ship light-only first; add `next-themes` later if agents ask  
- **Snippet variables / placeholders** (`{{requester.name}}`, `{{ticket.number}}`) — out of scope for v1; snippets are static text/HTML. Add when an agent asks twice.
- **Macros** (one click that inserts a snippet *and* changes status *and* reassigns) — out of scope. v1 ships snippets only; agents perform status/assignee changes separately. Backend §12 records the same boundary.
- **Per-channel signatures** — single `signature_html` per agent in v1; no separate signatures for new conversations vs replies vs internal-only profiles.
- **Server-side reply drafts** — the composer is ephemeral in-browser state. Closing the tab loses the draft. No `POST /api/tickets/:id/drafts` endpoint exists in v1. Add a `drafts` table in a future iteration if agents ask for cross-session or cross-device draft persistence.
- **"Someone is typing…" / draft-lock presence** — no real-time presence or collision prevention for simultaneous replies. If two agents reply at the same moment both messages send and both appear in the thread. Backend §7 documents this as an accepted choice (optimistic lock on `tickets.updated_at` handles the status-change collision only). If the double-reply rate becomes a problem during dogfood, surface "Agent X replied 30 s ago" as a banner on the ticket — but that requires polling `GET /api/tickets/:id` and is a post-M6 paper cut, not a v1 must-have.

### Milestone tie-in

Fold UI work into §11 order: **M1** shell + login + empty list; **M3** thread + header; **M5** composer + outbound states; **M7** attachments; **M8** admin cards + audit; **M9** GDPR forms. Polish pass in **M12** (spacing, focus order, empty copy).
