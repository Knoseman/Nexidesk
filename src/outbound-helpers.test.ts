import { describe, it, expect } from "vitest";
import { backoffSeconds, buildReplySubject } from "@/lib/outbound";

// ── backoffSeconds ───────────────────────────────────────────────────────────

describe("backoffSeconds", () => {
  it("returns 15 for 0 attempts", () => {
    expect(backoffSeconds(0)).toBe(15);
  });

  it("returns 15 for 1 attempt", () => {
    expect(backoffSeconds(1)).toBe(15);
  });

  it("doubles each time (attempt 2 → 30)", () => {
    expect(backoffSeconds(2)).toBe(30);
  });

  it("doubles each time (attempt 3 → 60)", () => {
    expect(backoffSeconds(3)).toBe(60);
  });

  it("doubles each time (attempt 4 → 120)", () => {
    expect(backoffSeconds(4)).toBe(120);
  });

  it("doubles each time (attempt 5 → 240)", () => {
    expect(backoffSeconds(5)).toBe(240);
  });

  it("caps at 300 seconds", () => {
    expect(backoffSeconds(6)).toBe(300);
    expect(backoffSeconds(10)).toBe(300);
    expect(backoffSeconds(100)).toBe(300);
  });

  it("handles negative attempts gracefully", () => {
    expect(backoffSeconds(-1)).toBe(15);
  });
});

// ── buildReplySubject ────────────────────────────────────────────────────────

describe("buildReplySubject", () => {
  it("prepends ticket token when not present", () => {
    expect(buildReplySubject("CID-0001", "hello world")).toBe(
      "Re: [CID-0001] hello world",
    );
  });

  it("prepends Re: even if subject already contains cid-", () => {
    // The function checks lowercase but preserves the original subject casing
    expect(buildReplySubject("CID-0001", "re: [CID-0001] hello world")).toBe(
      "Re: re: [CID-0001] hello world",
    );
  });

  it("handles empty subject", () => {
    expect(buildReplySubject("CID-0042", "")).toBe("Re: [CID-0042] ");
  });

  it("handles subject with only whitespace", () => {
    expect(buildReplySubject("CID-0042", "   ")).toBe("Re: [CID-0042]    ");
  });

  it("handles very long subjects", () => {
    const long = "a".repeat(500);
    expect(buildReplySubject("CID-0001", long)).toBe(`Re: [CID-0001] ${long}`);
  });
});
