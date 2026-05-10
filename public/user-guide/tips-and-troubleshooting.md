# Tips and Troubleshooting

## Working Well as a Team

### Keep statuses honest

A queue full of **Open** tickets where half are actually waiting on the customer hides the real workload. Use **Pending** when you are waiting. When the customer replies, the ticket reopens automatically — you will not miss it.

### Be honest with priority

**Urgent** should be rare. If everything is urgent, the label becomes meaningless and your team stops trusting it. Save the fire alarm for actual fires.

### Use notes for thinking out loud

Internal notes are perfect for:
- Recording what you have checked
- Explaining your reasoning
- Handing context to a colleague

The customer does not see them, and they create a useful record if someone revisits the ticket months later. Future-you will thank present-you.

### Keep tags consistent

Agree on a controlled vocabulary with your team. Random tags accumulate quickly and lose their value.

### Reply to old messages sparingly

For normal conversations, reply to the latest message. Use the per-message reply button only when a thread has split into separate topics, or when you need to respond to a specific older message. This keeps email threading tidy in the customer's inbox.

---

## What Happens Automatically

| Process | How often | What it does |
|---------|-----------|--------------|
| **IMAP poll** | Every 5 minutes | Fetches new emails and creates or updates tickets |
| **Outbound queue** | Every 30 seconds | Sends queued replies via Microsoft Graph |
| **GDPR retention** | Every 24 hours | Anonymises old tickets past the retention window |

---

## When Something Seems Wrong

### A new email has not appeared after 6 minutes

The IMAP poll may have hit a temporary error. Ask your administrator to run a manual poll or check the server logs.

### A reply is stuck on "sending" for more than 2 minutes

The outbound queue may be stalled. **Do not resend.** Tell your administrator — they can inspect and reset the queue without sending the email twice.

---

## Quick Reference

| Task | How to do it |
|------|--------------|
| Change ticket status | Header → status badge dropdown |
| Change priority | Header → priority badge dropdown |
| Assign to someone | Header → assignee dropdown |
| Close a ticket | Header → "Close Ticket" button |
| Reopen a closed ticket | Header → "Reopen" button |
| Reply to customer | Composer → Reply tab → Send |
| Add an internal note | Composer → Note tab → Send |
| Add CC or BCC | Composer → Reply tab → **More…** |
| Attach a file | Composer → paperclip icon |
| Insert a snippet | Composer → speech-bubble icon |
| Add a tag | Right rail → Tags → + button |
| Link a contact | Right rail → Requester → Change |
| Search tickets | Left panel → search field |
| Filter your view | Left panel → filter bar |
| Manage snippets | Left nav → Snippets |
| Edit your signature | Left nav → Account |
| Manage contacts | Left nav → Contacts |
