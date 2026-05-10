Nexidesk — Security Review

**Reviewer:** Internal security review
**Scope:** All `src/` source.
**Date:** 2026-05-24
**Updated:** 2026-05-24

Findings are ranked by severity. Each entry is self-contained so it can be handed off to a separate agent. File:line references are exact at HEAD (`53c949d`) unless noted as updated.

### Remediation log

| Item | Status | Commit / PR |
|---|---|---|
| C1 | **FIXED** | `auth.ts` + `register/route.ts` — admin-only guard added |
| C2 | **FIXED** | `auth.ts` — `signIn` + session helpers now enforce `isActive=true` and `deletedAt is null` |
| H1 | **FIXED** | `MessageCard.tsx` — replaced custom sanitizer with DOMPurify + remote-image blocking |
| H2 | **FIXED** | `schema.ts` + `0013_mushy_jamie_braddock.sql` + upload route + `post-ticket-message.ts` — `attachment_uploads` table verifies ownership on send |
| H3 (tags) | **FIXED** | `tags/route.ts` + `tags/[id]/route.ts` — creation / edit / delete restricted to admin |
| H3 (audit cascade) | **FIXED** | `schema.ts` + `0012_cold_genesis.sql` — removed `onDelete: cascade` from `audit_logs.ticketId` |
| H3 (ticket delete audit) | **FIXED** | `tickets/[id]/route.ts` — `DELETE` now inserts `auditLogs` row (`action: 'ticket_deleted'`) |
| H3 (tickets, contacts, snippets) | **ACCEPTED RISK** | Owner policy: all agents may delete/merge tickets, edit contacts, and edit/delete global snippets |
| H4 | **FIXED** | `post-ticket-message.ts` — CC/BCC email validation + 50-recipient cap |
| H5 | **FIXED** | `attachments/[id]/download/route.ts` — sanitizes filename before `Content-Disposition` |
| H6 | **FIXED** | `next.config.ts` — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| `mail-config.test.ts` lint | **FIXED** | Removed unused imports |

---

---

## CRITICAL

### C1. ~~Unauthenticated `POST /api/register` lets the public create Entra/B2B accounts and pollute the agents table~~ ✅ FIXED
**File:** `src/app/api/register/route.ts:7-129` (updated)

~~The endpoint has **no auth check, no rate limit, no CAPTCHA, no domain allow-list**.~~  
**Now:** The handler opens with `auth()` + `requireAdmin(session)`. Only authenticated admins can create agents or provision Entra/B2B users.

Remaining hardening (optional):
- Rate-limit the endpoint.
- Add domain allow-list validation.
- Wrap Graph + DB insert in a transaction.
- Add an `auditLogs` row for each registration.

---

### C2. ~~`isActive=false` agents and soft-deactivated agents can still sign in and call every API~~ ✅ FIXED
**Files:** `src/lib/auth.ts:18-51` (signIn callback), `src/lib/auth.ts:67-78` (`getAgentIdFromSession`), `src/lib/auth.ts:107-113` (`requireAdmin`) (updated)

**Now:**
- `signIn` selects `isActive` and `deletedAt`; returns `false` if the agent is inactive or soft-deleted.
- `getAgentIdFromSession` and `getAgentFromSession` query with `eq(agents.isActive, true)` and `isNull(agents.deletedAt)`. Inactive agents are treated as non-existent for all API routes.
- `requireAdmin` inherits the lockout automatically because it delegates to `getAgentFromSession`.

Remaining cleanup (optional):
- Deduplicate local `requireAdmin` copies in `poll-imap`, `poll-outbound`, and GDPR routes (they still work, but are redundant).

---

## HIGH

### H1. ~~Stored attacks via inbound email HTML — agent tracking, CSS exfiltration, and a flimsy sanitizer~~ ✅ FIXED
**File:** `src/components/nexidesk/MessageCard.tsx:74-169` (`useSanitizedHtml`), rendered at lines 353, 360.

**Now:** `useSanitizedHtml` uses **DOMPurify** (`pnpm add dompurify`) with a strict allow-list:
- `style` attribute is **forbidden** globally (`FORBID_ATTR: ['style']`).
- `IMG src` is restricted to `https?`, `mailto`, `cid`, `/`, `#` via `ALLOWED_URI_REGEXP`.
- After DOMPurify, a regex strips `<img src="http...">` remote images and replaces them with a placeholder span (`[Remote image blocked]`). Data-URI and CID images are preserved.
- Tag/attribute allow-list is locked down (no `script`, `iframe`, `object`, `embed`, etc.).

The raw HTML is still delivered in `GET /api/tickets/:id` — **server-side sanitization at ingest time remains future work** (not required for the minimum fix).

---

### H2. ~~Attachment-storageKey forgery — anyone can attach arbitrary R2 objects to outbound emails~~ ✅ FIXED
**Files:** `src/app/api/tickets/[id]/attachments/upload/route.ts`, `src/lib/post-ticket-message.ts`, schema at `src/lib/schema.ts`

**Now:**
1. New `attachment_uploads` table (`0013_mushy_jamie_braddock.sql`) tracks every upload with:
   - `agentId` (who uploaded it)
   - `storageKey`, `sha256`, `contentType`, `sizeBytes`
   - `consumedByMessageId` (null until attached to a message)
2. The upload endpoint returns `{ uploadId, filename, contentType, sizeBytes }` — **never `storageKey` or `sha256hex`**.
3. `post-ticket-message.ts` looks up each `uploadId` from `attachmentUploads`, verifies:
   - `agentId === currentAgentId`
   - `consumedByMessageId IS NULL`
   Then copies the verified fields into `attachments` and sets `consumedByMessageId = msg.id`.

Filename spoofing is still possible at the UI layer, but the file content (SHA-256 / storage key) is no longer client-controlled.

---

### H3. Broad authorisation gaps — partially remediated; accepted risk on tickets/contacts/snippets
**Files:**
- `src/app/api/tickets/[id]/route.ts:306-349` (DELETE ticket — any agent)  
  **Accepted risk:** owner policy is that all agents may delete tickets. **Audit log added:** `action: 'ticket_deleted'`.
- `src/app/api/tickets/[id]/merge/route.ts:14-195` (merge — any agent)  
  **Accepted risk:** owner policy is that all agents may merge tickets. **Audit log already present:** `action: 'merged_into'`.
- `src/app/api/contacts/[id]/route.ts:7-69` (PATCH/DELETE contact — any agent, no audit)  
  **Accepted risk:** owner trusts agents with contact data.
- `src/app/api/snippets/[id]/route.ts:32-100` (PATCH/DELETE — any agent)  
  **Accepted risk:** snippets are global only in this version; all agents may edit/delete.
- `src/app/api/tags/[id]/route.ts` (PATCH/DELETE — any agent) → **FIXED: admin only**
- `src/app/api/tags/route.ts` (POST — any agent) → **FIXED: admin only**

**What was fixed:**
- Tag creation, rename, and deletion are now restricted to admins (`requireAdmin`).
- The `audit_logs` table had `onDelete: cascade` on `ticket_id`. Deleting a ticket destroyed its own audit trail, making ticket-deletion auditing impossible. This FK cascade was removed in migration `0012_cold_genesis.sql`; audit log rows now survive ticket deletion.
- `DELETE /api/tickets/:id` now inserts an `auditLogs` row before deleting.

**What remains accepted risk per owner policy:**
- Any agent can delete/merge tickets.
- Any agent can edit/delete contacts.
- Any agent can edit/delete global snippets.

---

### H4. ~~Outbound abuse vector — unbounded CC/BCC turns the shared mailbox into a spam relay~~ ✅ FIXED
**File:** `src/lib/post-ticket-message.ts`

**Now:** `ccEmails` and `bccEmails` are validated before any queue insertion:
- Each email must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` and be ≤ 254 chars.
- Total recipients (to + cc + bcc) are capped at **50**.
- Validation runs before `persistMessage`; failures return **400**.

---

### H5. ~~Response-header injection in attachment download~~ ✅ FIXED
**File:** `src/app/api/attachments/[id]/download/route.ts:38-46`

**Now:** The `Content-Disposition` header is built with:
```ts
const safe = row.filename.replace(/[\x00-\x1f"\\]/g, '_');
const star = encodeURIComponent(row.filename);
```
Control characters, `"`, and `\` are stripped to `_` before interpolation. `X-Content-Type-Options: nosniff` is also sent.

---

### H6. ~~Missing CSP, HSTS, X-Frame-Options, and other browser hardening~~ ✅ FIXED
**File:** `next.config.ts`

**Now:** Security headers are returned on all routes:
- `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## MEDIUM

### M1. `/api/poll` is callable by every authenticated agent and triggers expensive IMAP work
**File:** `src/app/api/poll/route.ts:5-22`

Any signed-in agent can spam-call this endpoint. Each call opens an IMAP connection, fetches new UIDs, parses MIME, and writes to Neon. Cheap to call, expensive to handle. DoS / cost amplification.

**Fix:**
1. Restrict to `requireAdmin`, or
2. Add a per-agent in-memory cooldown (e.g., reject if a poll has run within the last 60 s) and let the workers handle the regular cadence.
3. Add a global lock (Postgres advisory lock `pg_try_advisory_lock(42)`) so two concurrent polls don't pile on the IMAP server.

---

### M2. No CSRF protection on state-changing API routes (JSON content-type is your only defence)
**Scope:** all `src/app/api/**/route.ts`

NextAuth's CSRF token covers `/api/auth/*` only. The rest of the API trusts the session cookie. Default cookie `SameSite=Lax` blocks most cross-site form submissions, but:
- `POST /api/tickets/:id/attachments/upload` accepts `multipart/form-data` — a hidden form on a malicious site can submit this with `credentials=include` and the user's cookie will ride along under `SameSite=Lax`.
- Any future relaxation of `SameSite` or addition of a CORS-permissive route reopens the surface.

**Fix:**
1. Add a double-submit CSRF token (NextAuth already issues `__Host-next-auth.csrf-token`). Read it from the cookie in client code; send it in a custom header (`X-CSRF-Token`); validate it server-side in a small `requireCsrf(req)` helper used by every non-GET route.
2. Alternatively, enforce `Origin` header allow-listing on every non-GET handler (`Origin === NEXTAUTH_URL`).
3. Explicitly set cookies as `SameSite=Strict` if your auth flow allows it (NextAuth's redirect-based sign-in usually requires `Lax`, but you can override the session cookie to `Strict` in `auth.ts`).

---

### M3. `trustHost: true` accepts arbitrary host headers
**File:** `src/lib/auth.ts:9`

`trustHost: true` tells NextAuth to accept the inbound `Host` header for callback URL construction. On Railway you only have one public hostname, but if you ever attach a preview domain or an attacker can pin a `Host` header through a misconfigured proxy, sign-in redirects can be hijacked.

**Fix:**
1. Replace with explicit `basePath`/`url` configuration or `trustHost: process.env.NODE_ENV !== 'production'`.
2. In production, require `NEXTAUTH_URL` and refuse to start if missing (add a startup check in `src/instrumentation.ts`).

---

### M4. Stored XSS surface via agent signature, propagated to outbound mail
**Files:** `src/app/api/agents/me/route.ts:62-72`, `src/lib/outbound.ts:560-561`, `src/components/nexidesk/ProfileEditor.tsx:387`

`signatureHtml` is written verbatim, appended to every outbound message (`htmlBody += signatureHtml`), and rendered with `dangerouslySetInnerHTML` in the profile editor preview. Self-XSS today (an agent only edits their own); becomes stored XSS if you ever add an "all signatures" admin view.

**Fix:**
1. Server-side sanitize on PATCH: run `isomorphic-dompurify` over `signatureHtml` with an even tighter allow-list than email bodies (no `<img>`, no `<a target=>` outside `_blank` + `rel=noopener`).
2. Cap length (e.g., 5 KB).
3. Sanitize once on read in `ProfileEditor.tsx` as defence in depth.

---

### M5. Outbound HTML body is shipped to Graph unsanitised
**Files:** `src/lib/post-ticket-message.ts:148-149`, `src/lib/outbound.ts:559-561`

Agents control the HTML that leaves your mailbox. Tiptap normally produces safe markup, but the API doesn't enforce that. A malicious or compromised agent can put `<script>` / dangerous CSS into `bodyHtml` and the helpdesk mailbox sends it. Recipient mail clients usually strip script tags, but custom rendering (forwarding to web previews, BI dashboards, ticketing integrations) may not.

**Fix:**
1. Server-side sanitize `bodyHtml` with `isomorphic-dompurify` before persistence (same helper as M4).
2. Reject the request (400) if the sanitised HTML differs significantly from the input — useful as a "this looks malicious" signal.

---

### M6. No file-type / content validation on attachment uploads
**File:** `src/app/api/tickets/[id]/attachments/upload/route.ts:34-39`

`contentType` is `file.type || 'application/octet-stream'` — purely client-stated. Combined with the user-stated `filename`, you can store `evil.html` as `text/html` or an `.svg` containing scripts. The download route serves `Content-Disposition: attachment` which forces a download in most browsers, but:
- Some browsers honour content sniffing on the URL path if no `X-Content-Type-Options: nosniff` is sent (see H5).
- A user can be tricked into right-click-open in a new tab, which often ignores the attachment hint.

**Fix:**
1. Sniff the actual content with `file-type` (`pnpm add file-type`) and reject if it doesn't match an allow-list (PDF, common image types, Office docs, plain text, zip).
2. Refuse `text/html`, `image/svg+xml`, `application/xhtml+xml`, `application/javascript` outright.
3. Always send `X-Content-Type-Options: nosniff` (covered by H5).
4. Enforce a max filename length (e.g., 255 chars), strip path separators (`/\`), and reject filenames starting with a dot.

---

### M7. Admin GDPR export is not audited and downloads PII in bulk
**File:** `src/app/api/admin/gdpr/export/route.ts:19-83`

An admin can export every message of every requester by email. There's no audit-log entry, no rate limit, no per-export size cap. A compromised admin account can silently dump your whole CRM in a few requests.

**Fix:**
1. Insert an `auditLogs` row for every export call (`action: 'gdpr_exported', metadata: {email, ticketCount}`).
2. Rate limit to e.g., 10 exports per admin per hour.
3. Stream rather than buffer the response (big requesters can OOM the process).

---

### M8. Search and filter inputs ride into raw `sql\`...\`` templates — safe today, but easy to break
**Files:** `src/app/api/contacts/route.ts:21-29`, `src/app/api/tags/route.ts:20`, `src/lib/tickets-list.ts:61-77`

Drizzle's tagged-template `sql` parameterises every `${...}`, so these are safe against SQL injection as written. However, a future refactor that uses `sql.raw(...)` or string concatenation here would silently introduce SQLi.

**Fix:**
1. Add an ESLint rule (or a Vitest static-analysis test) that flags `sql.raw(` and template literals built via `+` in any DB-touching file.
2. Comment the search functions explicitly: `// All variables are parameterised by drizzle. Do not refactor to sql.raw().`

---

### M9. Token caches and rate-limit state are in-process — silent break on horizontal scale
**Files:** `src/lib/graph-access-token.ts`, `src/lib/imap-access-token.ts`, `src/lib/graph-users.ts:6-61`

Each process holds its own token, and `outbound_queue` row claims (`SELECT … FOR UPDATE SKIP LOCKED`) are the only cross-process safety. Not exploitable per se, but if you ever scale the service:
- Each replica refreshes the same refresh token — race for Entra revoking older tokens.
- The IMAP poller and outbound worker may run twice and double-process state if the lock paths are bypassed.

**Fix:**
1. Move token caching to a Postgres table (`mailbox_tokens(id, kind, access_token, expires_at)`) guarded by `SELECT … FOR UPDATE`.
2. Document explicitly that Railway must be configured at `replicas: 1` until token caching is centralised.

---

### M10. `signIn` accepts the email from `profile.email` *after* trying `preferred_username` — opens a small confusion surface
**File:** `src/lib/auth.ts:35-48`

If Entra surfaces `preferred_username = something@guest-domain` and a separate `email` claim, both are tried in sequence. An attacker who can sign up a guest with a chosen `email` claim could match an internal agent's email. Less likely with a tenant-restricted issuer, but still worth tightening.

**Fix:**
1. Restrict the fallback to cases where `profile.email_verified === true` (Entra returns this for guests as `email_verified`).
2. Require `profile.tid === process.env.AZURE_AD_TENANT_ID` (tenant id claim) so only your own tenant's guests are accepted.
3. Optionally turn off the fallback entirely if `AZURE_AD_UPN_DOMAIN` is set.

---

## LOW / INFO

### L1. Drizzle/postgres error codes leaked via `e.code === '23505'` checks
**Files:** `src/app/api/contacts/route.ts:66-73`, `src/app/api/tags/route.ts:53-59`

Conflict (`23505`) is caught but the raw `throw e` for everything else propagates a stack trace into the Next default error response. Wrap with a generic `500`.

### L2. `console.error([api/messages note], e)` style logs scattered through API routes
Hand-formatted; sensitive errors may end up in Railway logs containing PII (e.g., recipient emails). Move to a structured logger (`pino`) with a redact list (`req.body.bodyText`, recipient emails) and a single correlation id per request.

### L3. `requireAdmin` duplicated across admin routes
Already mentioned in C2.3; deserves its own task. Replace four local copies with the one in `auth.ts`.

### L4. `DELETE /api/contacts/:id` nulls `tickets.requesterId` but leaves `tickets.requesterEmail` populated
**File:** `src/app/api/contacts/[id]/route.ts:65-66`

The contact is gone from the CRM, but every ticket they ever filed still has their email in `tickets.requesterEmail`. From a GDPR/right-to-erasure standpoint this is partial deletion. Run `anonymiseRequester` (already in `src/lib/gdpr.ts:14`) on each linked ticket, or update tickets to a synthetic email.

### L5. `mailparser` (mailparser ^3.9.8) has a history of CVEs — keep it pinned and on the latest patch
Add `pnpm audit` to CI; subscribe to GHSA advisories for `mailparser`, `imapflow`, and `postgres`.

### L6. Long-lived OAuth refresh tokens stored as plain env vars
Standard practice today but worth scheduling rotation (e.g., quarterly). Add an operational runbook entry and a calendar reminder.

### L7. `next-auth: beta`
You're pinning a beta-tagged dependency in production. Pin to an exact version (`5.0.0-beta.X`) so a re-resolve doesn't pull a breaking minor.

### L8. `pollImap` / `processOutboundQueueOnce` errors are caught and logged but the per-request response contains the raw `error.message`
**Files:** `src/app/api/poll/route.ts:18-21`, `src/app/api/admin/poll-imap/route.ts:30-32`, `src/app/api/admin/poll-outbound/route.ts:30-32`

These can leak hostnames, file paths, OAuth scopes etc. Return a generic message + log full details server-side.

---

## Suggested batching for delegated agents

| Batch | Items | Approx. effort | Notes |
|---|---|---|---|
| **A. Authorisation overhaul** | ~~C2, H3, L3~~ C2 ✅, H3 (tags) ✅, L3 | Medium | Touches `auth.ts` + every admin/CRUD route. One agent, one PR. |
| **B. Registration hardening** | ~~C1~~ ✅ | Small | Single file + new rate-limit helper. |
| **C. HTML & header safety** | ~~H1, H5, H6~~ ✅, M4, M5, M6 | Large | DOMPurify integration done; remaining: server-side signature/body sanitiser, file-type sniffing. |
| **D. Attachment integrity** | ~~H2~~ ✅, M6 | Medium | `attachment_uploads` table shipped; remaining: file-type sniffing + filename hardening. |
| **E. Outbound abuse limits** | ~~H4~~ ✅, M7 | Small | Validation + rate counters + audit rows. |
| **F. Quality of life / infra** | M1, M2, M3, M8, M9, L1-L8 | Small each | Independent, can be done in parallel. |

Tackle in alphabetical order — A and B unblock the rest by ensuring authenticated reviewers can test the others safely.

End-of-turn: report covers 2 Critical, 6 High, 10 Medium, 8 Low findings with concrete fixes; nothing committed.
