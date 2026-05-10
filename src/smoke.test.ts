import { describe, it, expect } from "vitest";

/**
 * Sanity checks that the test runner, TypeScript paths, and module resolution
 * are all working correctly.
 */
describe("project smoke tests", () => {
  it("vitest is alive", () => {
    expect(1 + 1).toBe(2);
  });

  it("can import from @/lib aliases", async () => {
    const { normalizeSubject } = await import("@/lib/threading");
    expect(normalizeSubject("Re: Hello")).toBe("hello");
  });

  it("can import Node built-ins", () => {
    const { createHash } = require("crypto");
    const hash = createHash("sha256").update("test").digest("hex");
    expect(hash).toHaveLength(64);
  });

  it("process.env is accessible", () => {
    // Basic sanity that we are in a Node environment
    expect(typeof process.env).toBe("object");
  });
});
