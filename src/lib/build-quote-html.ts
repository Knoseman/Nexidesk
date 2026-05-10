import type { TicketMessage } from "@/types/ticket";

const MAX_MESSAGES = 10;
const MAX_BYTES = 100 * 1024;

// Allowed tags for quote HTML sanitization (browser-safe, no jsdom)
const ALLOWED_TAGS = new Set([
  "A",
  "B",
  "BR",
  "DIV",
  "EM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "I",
  "LI",
  "OL",
  "P",
  "SPAN",
  "STRONG",
  "U",
  "UL",
  "BLOCKQUOTE",
  "HR",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(["href", "title"]),
};

const GLOBAL_ATTRS = new Set(["class"]);

const ALLOWED_URI_RE = /^(?:(?:https?|mailto):|\/|#)/i;

export function buildQuoteHtml(
  messages: TicketMessage[],
  pivotMessageId: number | null,
): string {
  let endIdx = messages.length - 1;
  if (pivotMessageId != null) {
    const found = messages.findIndex((m) => m.id === pivotMessageId);
    if (found < 0) return "";
    endIdx = found;
  }

  const eligible = messages.slice(0, endIdx + 1).filter((m) => {
    if (m.direction === "note") return false;
    if (m.kind === "auto_reply") return false;
    if (
      m.direction === "outbound" &&
      (m.queueStatus === "failed" || m.queueStatus === "dead")
    )
      return false;
    return true;
  });
  if (eligible.length === 0) return "";

  const newestFirst = [...eligible].reverse().slice(0, MAX_MESSAGES);

  const parts: string[] = [];
  let bytes = 0;
  for (const msg of newestFirst) {
    const block = renderAttributionAndBlockquote(msg);
    const blockBytes = byteLengthUtf8(block);
    if (bytes + blockBytes > MAX_BYTES && parts.length > 0) break;
    parts.push(block);
    bytes += blockBytes;
  }

  return `<div class="nexidesk-quote">${parts.join("")}</div>`;
}

function sanitizeHtml(html: string): string {
  // Fast path: if no tags, just escape
  if (!/<[a-zA-Z\/][^>]*>/.test(html)) return escapeHtml(html);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent ?? "");
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toUpperCase();
      if (!ALLOWED_TAGS.has(tag)) {
        // Strip tag, keep children
        return Array.from(el.childNodes).map(walk).join("");
      }

      const attrs: string[] = [];
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const allowed = GLOBAL_ATTRS.has(name) || ALLOWED_ATTRS[tag]?.has(name);
        if (!allowed) continue;
        if (name === "href" || name === "src") {
          if (!ALLOWED_URI_RE.test(attr.value)) continue;
        }
        attrs.push(`${attr.name}="${escapeHtml(attr.value)}"`);
      }

      const attrStr = attrs.length ? ` ${attrs.join(" ")}` : "";
      const children = Array.from(el.childNodes).map(walk).join("");
      if (tag === "BR" || tag === "HR") {
        return `<${tag.toLowerCase()}${attrStr}>`;
      }
      return `<${tag.toLowerCase()}${attrStr}>${children}</${tag.toLowerCase()}>`;
    }
    return "";
  }

  return Array.from(doc.body.childNodes).map(walk).join("");
}

function renderAttributionAndBlockquote(m: TicketMessage): string {
  const ts = formatTs(m.sentAt ?? m.receivedAt);
  const display = escapeHtml(resolveDisplayName(m));
  const email = escapeHtml(m.fromEmail ?? "unknown@example.com");
  const header = `<p>On ${ts}, ${display} &lt;${email}&gt; wrote:</p>`;

  let body: string;
  if (m.bodyHtml?.trim()) {
    body = sanitizeHtml(m.bodyHtml);
  } else {
    body = `<p>${escapeHtml(m.bodyText ?? "")}</p>`;
  }

  const attLines = (m.attachments ?? [])
    .map((a) => `<p>[Attachment: ${escapeHtml(a.filename)}]</p>`)
    .join("");

  return `${header}<blockquote style="border-left:3px solid #cbd5e1;margin:0;padding-left:12px;color:#64748b">${body}${attLines}</blockquote>`;
}

function resolveDisplayName(m: TicketMessage): string {
  if (m.direction === "outbound" && m.agentName) return m.agentName;
  const username = (m.fromEmail ?? "unknown").split("@")[0];
  return username.replace(/[._-]/g, " ");
}

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function byteLengthUtf8(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x80) n += 1;
    else if (code < 0x800) n += 2;
    else if (code < 0xd800 || code >= 0xe000) n += 3;
    else {
      n += 4;
      i++;
    }
  }
  return n;
}
