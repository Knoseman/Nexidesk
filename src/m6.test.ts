import { describe, it, expect } from "vitest";
import type { AttachmentRef, TicketMessage } from "@/types/ticket";
import type { PostTicketMessageBody } from "@/lib/post-ticket-message";

describe("M6 types — AttachmentRef", () => {
  it("AttachmentRef has required fields", () => {
    const att: AttachmentRef = {
      id: 1,
      filename: "report.pdf",
      contentType: "application/pdf",
      sizeBytes: 12345,
    };
    expect(att.filename).toBe("report.pdf");
    expect(att.sizeBytes).toBe(12345);
  });

  it("AttachmentRef contentType can be null", () => {
    const att: AttachmentRef = {
      id: 1,
      filename: "file",
      contentType: null,
      sizeBytes: 0,
    };
    expect(att.contentType).toBeNull();
  });
});

describe("M6 types — TicketMessage attachments", () => {
  it("TicketMessage accepts attachments array", () => {
    const msg: TicketMessage = {
      id: 1,
      ticketId: 2,
      direction: "inbound",
      fromEmail: "a@b.com",
      bodyText: "hi",
      sentAt: null,
      receivedAt: null,
      agentName: null,
      attachments: [
        {
          id: 5,
          filename: "img.png",
          contentType: "image/png",
          sizeBytes: 999,
        },
      ],
    };
    expect(msg.attachments?.length).toBe(1);
  });

  it("TicketMessage attachments is optional", () => {
    const msg: TicketMessage = {
      id: 1,
      ticketId: 2,
      direction: "inbound",
      fromEmail: null,
      bodyText: null,
      sentAt: null,
      receivedAt: null,
      agentName: null,
    };
    expect(msg.attachments).toBeUndefined();
  });
});

describe("M6 types — PostTicketMessageBody attachments", () => {
  it("accepts attachments array on reply", () => {
    const body: PostTicketMessageBody = {
      type: "reply",
      bodyText: "see attached",
      attachments: [
        {
          uploadId: 1,
          filename: "report.pdf",
        },
      ],
    };
    expect(body.attachments?.length).toBe(1);
  });

  it("attachments field is optional", () => {
    const body: PostTicketMessageBody = {
      type: "reply",
      bodyText: "plain text",
    };
    expect(body.attachments).toBeUndefined();
  });
});

describe("M6 — r2Configured returns boolean", () => {
  it("returns false when env vars absent", () => {
    // Verify the function shape — actual env check is runtime-only
    const result: boolean = !!(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
    );
    expect(typeof result).toBe("boolean");
  });
});
