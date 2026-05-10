import { describe, it, expect } from "vitest";
import type { PostTicketMessageBody } from "@/lib/post-ticket-message";

// ── PostTicketMessageBody validation ─────────────────────────────────────────

describe("PostTicketMessageBody validation", () => {
  it("accepts valid reply", () => {
    const body: PostTicketMessageBody = {
      type: "reply",
      bodyText: "Hello",
    };
    expect(body.type).toBe("reply");
  });

  it("accepts valid internal_note", () => {
    const body: PostTicketMessageBody = {
      type: "internal_note",
      bodyText: "Note",
    };
    expect(body.type).toBe("internal_note");
  });

  it("rejects invalid type at compile time", () => {
    // @ts-expect-error invalid type
    const body: PostTicketMessageBody = { type: "invalid", bodyText: "x" };
    expect(body.type).toBe("invalid");
  });

  it("bodyHtml is optional", () => {
    const body: PostTicketMessageBody = { type: "reply", bodyText: "Hello" };
    expect(body.bodyHtml).toBeUndefined();
  });

  it("accepts null bodyHtml", () => {
    const body: PostTicketMessageBody = {
      type: "reply",
      bodyText: "Hello",
      bodyHtml: null,
    };
    expect(body.bodyHtml).toBeNull();
  });

  it("inReplyToMessageId is optional", () => {
    const body: PostTicketMessageBody = { type: "reply", bodyText: "Hello" };
    expect(body.inReplyToMessageId).toBeUndefined();
  });

  it("accepts numeric inReplyToMessageId", () => {
    const body: PostTicketMessageBody = {
      type: "reply",
      bodyText: "Hello",
      inReplyToMessageId: 42,
    };
    expect(body.inReplyToMessageId).toBe(42);
  });

  it("accepts null inReplyToMessageId", () => {
    const body: PostTicketMessageBody = {
      type: "reply",
      bodyText: "Hello",
      inReplyToMessageId: null,
    };
    expect(body.inReplyToMessageId).toBeNull();
  });

  it("accepts attachments array", () => {
    const body: PostTicketMessageBody = {
      type: "reply",
      bodyText: "Hello",
      attachments: [
        {
          uploadId: 1,
          filename: "file.pdf",
        },
      ],
    };
    expect(body.attachments).toHaveLength(1);
  });

  it("accepts ccEmails and bccEmails", () => {
    const body: PostTicketMessageBody = {
      type: "reply",
      bodyText: "Hello",
      ccEmails: ["cc@example.com"],
      bccEmails: ["bcc@example.com"],
    };
    expect(body.ccEmails).toEqual(["cc@example.com"]);
    expect(body.bccEmails).toEqual(["bcc@example.com"]);
  });
});

// ── Runtime validation rules (mirrored from handler) ─────────────────────────

describe("runtime validation rules", () => {
  function validateBody(
    raw: unknown,
  ): { ok: true; body: PostTicketMessageBody } | { ok: false; error: string } {
    if (typeof raw !== "object" || raw === null) {
      return { ok: false, error: "Invalid JSON body" };
    }
    const body = raw as PostTicketMessageBody;
    if (body.type !== "reply" && body.type !== "internal_note") {
      return { ok: false, error: 'type must be "reply" or "internal_note"' };
    }
    const bodyText =
      typeof body.bodyText === "string" ? body.bodyText.trim() : "";
    if (!bodyText) {
      return { ok: false, error: "bodyText required" };
    }
    if (
      body.inReplyToMessageId != null &&
      Number.isNaN(Number(body.inReplyToMessageId))
    ) {
      return { ok: false, error: "Invalid inReplyToMessageId" };
    }
    return { ok: true, body };
  }

  it("rejects non-object body", () => {
    expect(validateBody(null).ok).toBe(false);
    expect(validateBody("string").ok).toBe(false);
    expect(validateBody(42).ok).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = validateBody({ type: "spam", bodyText: "x" });
    expect(result.ok).toBe(false);
  });

  it("rejects empty bodyText", () => {
    const result = validateBody({ type: "reply", bodyText: "" });
    expect(result.ok).toBe(false);
  });

  it("rejects whitespace-only bodyText", () => {
    const result = validateBody({ type: "reply", bodyText: "   " });
    expect(result.ok).toBe(false);
  });

  it("rejects missing bodyText", () => {
    const result = validateBody({ type: "reply" });
    expect(result.ok).toBe(false);
  });

  it("accepts valid body", () => {
    const result = validateBody({ type: "reply", bodyText: "Hello" });
    expect(result.ok).toBe(true);
  });

  it("rejects NaN inReplyToMessageId", () => {
    const result = validateBody({
      type: "reply",
      bodyText: "Hello",
      inReplyToMessageId: "not-a-number",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts numeric inReplyToMessageId", () => {
    const result = validateBody({
      type: "reply",
      bodyText: "Hello",
      inReplyToMessageId: 42,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts null inReplyToMessageId", () => {
    const result = validateBody({
      type: "reply",
      bodyText: "Hello",
      inReplyToMessageId: null,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts zero as inReplyToMessageId", () => {
    const result = validateBody({
      type: "reply",
      bodyText: "Hello",
      inReplyToMessageId: 0,
    });
    expect(result.ok).toBe(true);
  });
});

// ── Merge guard logic ────────────────────────────────────────────────────────

describe("merge guard logic", () => {
  function checkMerge(
    mergedIntoTicketId: number | null,
  ): { blocked: true; status: number } | { blocked: false } {
    if (mergedIntoTicketId != null) {
      return { blocked: true, status: 409 };
    }
    return { blocked: false };
  }

  it("allows non-merged ticket", () => {
    expect(checkMerge(null)).toEqual({ blocked: false });
  });

  it("allows undefined mergedIntoTicketId", () => {
    expect(checkMerge(undefined as any)).toEqual({ blocked: false });
  });

  it("blocks merged ticket", () => {
    expect(checkMerge(42)).toEqual({ blocked: true, status: 409 });
  });

  it("blocks merged ticket with zero id", () => {
    // 0 is still a valid id, so it should block
    expect(checkMerge(0)).toEqual({ blocked: true, status: 409 });
  });
});
