import { describe, it, expect } from "vitest";
import {
  normalizeSubject,
  uniqRefs,
  resolveInboundThread,
} from "@/lib/threading";

// ── normalizeSubject ─────────────────────────────────────────────────────────

describe("normalizeSubject", () => {
  it("returns (no subject) for undefined", () => {
    expect(normalizeSubject(undefined)).toBe("(no subject)");
  });

  it("returns (no subject) for empty string", () => {
    expect(normalizeSubject("")).toBe("(no subject)");
  });

  it("returns (no subject) for whitespace-only string", () => {
    expect(normalizeSubject("   ")).toBe("(no subject)");
  });

  it("trims Re: prefixes", () => {
    expect(normalizeSubject("Re: Hello")).toBe("hello");
  });

  it("trims Fwd: prefixes", () => {
    expect(normalizeSubject("Fwd: Important")).toBe("important");
  });

  it("trims Fw: prefixes", () => {
    expect(normalizeSubject("Fw: Document")).toBe("document");
  });

  it("trims Aw: (German) prefixes", () => {
    expect(normalizeSubject("Aw: Antwort")).toBe("antwort");
  });

  it("trims Sv: (Swedish) prefixes", () => {
    expect(normalizeSubject("Sv: Svar")).toBe("svar");
  });

  it("strips nested prefixes recursively", () => {
    expect(normalizeSubject("Re: Fwd: Re: Hello World")).toBe("hello world");
  });

  it("lowercases and collapses whitespace", () => {
    expect(normalizeSubject("Re:   Hello    WORLD  ")).toBe("hello world");
  });

  it("is case-insensitive for prefixes", () => {
    expect(normalizeSubject("RE: Hello")).toBe("hello");
    expect(normalizeSubject("FWD: Hello")).toBe("hello");
  });

  it("handles colons without spaces", () => {
    expect(normalizeSubject("Re:Hello")).toBe("hello");
  });

  it("preserves non-prefix colons in the body", () => {
    expect(normalizeSubject("Meeting: tomorrow")).toBe("meeting: tomorrow");
  });
});

// ── uniqRefs ─────────────────────────────────────────────────────────────────

describe("uniqRefs", () => {
  it("returns empty array when both inputs are empty", () => {
    expect(uniqRefs(null, [])).toEqual([]);
  });

  it("includes inReplyTo when present", () => {
    expect(uniqRefs("msg-1", [])).toEqual(["msg-1"]);
  });

  it("includes unique references", () => {
    expect(uniqRefs(null, ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("deduplicates inReplyTo and references", () => {
    expect(uniqRefs("a", ["a", "b"])).toEqual(["a", "b"]);
  });

  it("filters out null/empty references", () => {
    expect(uniqRefs(null, ["a", "", "b", null as any])).toEqual(["a", "b"]);
  });

  it("preserves order: inReplyTo first then references", () => {
    expect(uniqRefs("z", ["a", "b"])).toEqual(["z", "a", "b"]);
  });
});

// ── resolveInboundThread (with mock tx) ──────────────────────────────────────

function createMockTx(results: {
  messageCandidates?: Array<{ ticketId: number; lastSeen: Date }>;
  ticketByToken?: Array<{ id: number }>;
  ticketBySubject?: Array<{ id: number }>;
}) {
  let lastTable = "";
  let hasOrderBy = false;
  const tableNameSymbol = Symbol.for("drizzle:Name");

  const chain: any = {
    from: (table: any) => {
      lastTable = table?.[tableNameSymbol] || "";
      hasOrderBy = false;
      return chain;
    },
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => {
      hasOrderBy = true;
      return chain;
    },
    limit: async () => {
      if (lastTable === "messages") {
        return results.messageCandidates ?? [];
      }
      if (lastTable === "tickets") {
        // Token query never uses orderBy; subject query always does
        return hasOrderBy
          ? (results.ticketBySubject ?? [])
          : (results.ticketByToken ?? []);
      }
      return [];
    },
    returning: async () => [],
    values: async () => [],
  };

  return {
    select: () => chain,
    insert: () => ({ values: async () => [] }),
  } as any;
}

describe("resolveInboundThread", () => {
  it("returns new when no refs and no matches", async () => {
    const tx = createMockTx({});
    const result = await resolveInboundThread(tx, {
      subject: "Hello",
      subjectNormalized: "hello",
      fromEmail: "a@b.com",
      inReplyTo: null,
      referencesIds: [],
    });
    expect(result).toEqual({ kind: "new" });
  });

  it("matches existing ticket by message refs", async () => {
    const tx = createMockTx({
      messageCandidates: [{ ticketId: 42, lastSeen: new Date() }],
    });
    const result = await resolveInboundThread(tx, {
      subject: "Re: Hello",
      subjectNormalized: "hello",
      fromEmail: "a@b.com",
      inReplyTo: "msg-1",
      referencesIds: [],
    });
    expect(result).toEqual({ kind: "existing", ticketId: 42 });
  });

  it("matches by CID token in subject", async () => {
    const tx = createMockTx({
      ticketByToken: [{ id: 7 }],
    });
    const result = await resolveInboundThread(tx, {
      subject: "Re: [CID-0007] Hello",
      subjectNormalized: "hello",
      fromEmail: "a@b.com",
      inReplyTo: null,
      referencesIds: [],
    });
    expect(result).toEqual({ kind: "existing", ticketId: 7 });
  });

  it("falls back to subject+email match when no token", async () => {
    const tx = createMockTx({
      ticketBySubject: [{ id: 9 }],
    });
    const result = await resolveInboundThread(tx, {
      subject: "Hello",
      subjectNormalized: "hello",
      fromEmail: "a@b.com",
      inReplyTo: null,
      referencesIds: [],
    });
    expect(result).toEqual({ kind: "existing", ticketId: 9 });
  });

  it("returns new when CID token does not match any ticket", async () => {
    const tx = createMockTx({
      ticketByToken: [],
      ticketBySubject: [],
    });
    const result = await resolveInboundThread(tx, {
      subject: "Re: [CID-9999] Hello",
      subjectNormalized: "hello",
      fromEmail: "a@b.com",
      inReplyTo: null,
      referencesIds: [],
    });
    expect(result).toEqual({ kind: "new" });
  });

  it("prefers message-ref match over token match", async () => {
    const tx = createMockTx({
      messageCandidates: [{ ticketId: 1, lastSeen: new Date() }],
      ticketByToken: [{ id: 2 }],
    });
    const result = await resolveInboundThread(tx, {
      subject: "Re: [CID-0002] Hello",
      subjectNormalized: "hello",
      fromEmail: "a@b.com",
      inReplyTo: "msg-1",
      referencesIds: [],
    });
    expect(result).toEqual({ kind: "existing", ticketId: 1 });
  });
});
