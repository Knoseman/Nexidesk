# Future Features

Nexidesk is a focused, self-hosted helpdesk for a single shared Microsoft 365 mailbox.

This document catalogs realistic future features — things that fit the "simple team helpdesk" premise and are commonly found in tools like HelpScout, Freshdesk Free, and Linear.

Features are grouped by theme and annotated with effort (S/M/L) and fit (✅ fits well / ⚠️ adds complexity).

---

## Feature gap list

### 1. Agent workflow

| Feature | Description | Effort | Fit |
|---|---|---|---|
| **Reply & close** | Single button: send reply + set status=closed in one action | S | ✅ |
| **Bulk actions** | Select multiple tickets → bulk assign / close / tag / merge | M | ✅ |
| **Keyboard shortcuts** | `r` to reply, `n` for note, `c` to close, `j/k` to navigate list | M | ✅ |
| **Collision detection** | Show banner when another agent is viewing/typing on the same ticket | M | ✅ |
| ~~Ticket merge~~ | ~~Merge a duplicate ticket into another; thread is preserved~~ | M | ✅ | *Built* |
| **Ticket split** | Pull one reply out of a thread into a new ticket | L | ⚠️ |
| **Forward message** | Forward a ticket thread or individual message to an external email | M | ✅ |
| ~~Full conversation history quoting~~ | ~~Auto-insert thread history into reply composer, collapsible, notes stripped~~ | M | ✅ | *Built* |

### 2. Queue & routing

| Feature | Description | Effort | Fit |
|---|---|---|---|
| **Saved views / smart inboxes** | Save a filter combo (status=open, tag=billing) as a named inbox | M | ✅ |
| **Auto-assignment rules** | Round-robin or keyword-based assignment on ticket creation | M | ⚠️ |
| **Due dates** | Simple date field on a ticket (no SLA timer math) | S | ✅ |
| **Watcher / follower** | Agents can subscribe to a ticket to see updates without being assigned | M | ✅ |

### 3. Notifications

| Feature | Description | Effort | Fit |
|---|---|---|---|
| **Email notifications to agents** | Notify assigned agent by email when a ticket is created/updated/replied | M | ✅ |
| **In-app notification feed** | Bell icon with a list of recent activity on tickets you own/watch | M | ✅ |
| **Per-agent notification preferences** | Toggle which events trigger email vs. in-app notification | M | ⚠️ |

### 4. Reporting & visibility

| Feature | Description | Effort | Fit |
|---|---|---|---|
| ~~Simple dashboard~~ | ~~Open count, closed today, avg first response time, tickets by agent~~ | M | ✅ | *Built* |
| ~~Contact ticket history~~ | ~~On the contact page: full list of all tickets from that requester~~ | S | ✅ | *Built* |
| **Ticket export (CSV)** | Export current filtered view to CSV | S | ✅ |
| **Print / PDF** | Render a ticket thread as a clean printable page | S | ✅ |

### 5. Spam & inbox hygiene

| Feature | Description | Effort | Fit |
|---|---|---|---|
| **Blocked senders list** | Emails from blocked addresses are silently discarded on ingest | S | ✅ |
| **Spam / junk flag on ticket** | Mark a ticket as spam (closes it + blocks sender) | S | ✅ |

### 6. Search & discovery

| Feature | Description | Effort | Fit |
|---|---|---|---|
| ~~Unified inbox search~~ | ~~Extend `q` search to reliably match ticket number (`TKT-1234`), tags, contact name, company, and subject. Currently ticket number is not matched by the LIKE/FTS predicates.~~ | S | ✅ | *Built* |

### 7. UI polish

| Feature | Description | Effort | Fit |
|---|---|---|---|
| **Dark mode** | System-preference-respecting dark theme | M | ✅ |
| **Mobile-responsive layout** | Collapse three-pane to single-pane on narrow viewports | L | ⚠️ |
| **Ticket list pagination / virtual scroll** | Handles inboxes with hundreds of open tickets cleanly | M | ✅ |
| **Composer draft autosave** | Save in-progress reply to `localStorage` so it survives a refresh | S | ✅ |

---

## Suggested priority order (simple, high-value first)

1. Reply & close button
2. Blocked senders / spam flag
3. Composer draft autosave
4. Saved views / smart inboxes
5. Ticket due dates
6. Bulk actions
7. Email notifications to agents
8. Keyboard shortcuts
9. Collision detection
10. Watcher/follower system
11. Dark mode

---

## Explicitly out of scope (per existing decisions)

- Customer-facing portal
- Multi-mailbox support
- SLA timer automation
- AI triage / classification
- Real-time presence / WebSockets
- Time tracking
- Custom fields
- Outbound webhook integrations
