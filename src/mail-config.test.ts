import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  graphSendConfigured,
  graphMailboxFromAddress,
  graphMailboxFromName,
} from "@/lib/graph-access-token";

// ── Graph config ─────────────────────────────────────────────────────────────

describe("graphSendConfigured", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GRAPH_OAUTH_CLIENT_ID;
    delete process.env.IMAP_OAUTH_CLIENT_ID;
    delete process.env.AZURE_AD_CLIENT_ID;
    delete process.env.GRAPH_OAUTH_REFRESH_TOKEN;
    delete process.env.GRAPH_MAILBOX_USER;
    delete process.env.IMAP_USER;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns false when all env vars missing", () => {
    expect(graphSendConfigured()).toBe(false);
  });

  it("returns false when only clientId present", () => {
    process.env.AZURE_AD_CLIENT_ID = "client-id";
    expect(graphSendConfigured()).toBe(false);
  });

  it("returns false when only refresh token present", () => {
    process.env.GRAPH_OAUTH_REFRESH_TOKEN = "token";
    expect(graphSendConfigured()).toBe(false);
  });

  it("returns false when only mailbox user present", () => {
    process.env.GRAPH_MAILBOX_USER = "user@example.com";
    expect(graphSendConfigured()).toBe(false);
  });

  it("returns true when all required vars present", () => {
    process.env.AZURE_AD_CLIENT_ID = "client-id";
    process.env.GRAPH_OAUTH_REFRESH_TOKEN = "token";
    process.env.GRAPH_MAILBOX_USER = "user@example.com";
    expect(graphSendConfigured()).toBe(true);
  });

  it("falls back to IMAP_OAUTH_CLIENT_ID for clientId", () => {
    process.env.IMAP_OAUTH_CLIENT_ID = "imap-client-id";
    process.env.GRAPH_OAUTH_REFRESH_TOKEN = "token";
    process.env.GRAPH_MAILBOX_USER = "user@example.com";
    expect(graphSendConfigured()).toBe(true);
  });

  it("falls back to IMAP_USER for mailbox user", () => {
    process.env.AZURE_AD_CLIENT_ID = "client-id";
    process.env.GRAPH_OAUTH_REFRESH_TOKEN = "token";
    process.env.IMAP_USER = "imap@example.com";
    expect(graphSendConfigured()).toBe(true);
  });
});

describe("graphMailboxFromAddress", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GRAPH_MAILBOX_FROM;
    delete process.env.GRAPH_MAILBOX_USER;
    delete process.env.IMAP_USER;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("prefers GRAPH_MAILBOX_FROM", () => {
    process.env.GRAPH_MAILBOX_FROM = "alias@example.com";
    process.env.GRAPH_MAILBOX_USER = "user@example.com";
    expect(graphMailboxFromAddress()).toBe("alias@example.com");
  });

  it("falls back to GRAPH_MAILBOX_USER", () => {
    process.env.GRAPH_MAILBOX_USER = "user@example.com";
    expect(graphMailboxFromAddress()).toBe("user@example.com");
  });

  it("falls back to IMAP_USER", () => {
    process.env.IMAP_USER = "imap@example.com";
    expect(graphMailboxFromAddress()).toBe("imap@example.com");
  });

  it("returns empty string when nothing set", () => {
    expect(graphMailboxFromAddress()).toBe("");
  });
});

describe("graphMailboxFromName", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GRAPH_MAILBOX_FROM_NAME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns env value when set", () => {
    process.env.GRAPH_MAILBOX_FROM_NAME = "Support Team";
    expect(graphMailboxFromName()).toBe("Support Team");
  });

  it("returns undefined when not set", () => {
    expect(graphMailboxFromName()).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    process.env.GRAPH_MAILBOX_FROM_NAME = "";
    expect(graphMailboxFromName()).toBeUndefined();
  });
});

// ── IMAP config ──────────────────────────────────────────────────────────────

// Replicate the pure helpers from imap.ts since they are not exported
function imapConfigured(): boolean {
  return Boolean(
    process.env.IMAP_USER &&
    process.env.IMAP_HOST &&
    process.env.IMAP_OAUTH_CLIENT_ID &&
    process.env.IMAP_OAUTH_REFRESH_TOKEN &&
    process.env.AZURE_AD_TENANT_ID,
  );
}

function inboxPath(): string {
  return process.env.IMAP_INBOX_PATH?.trim() || "INBOX";
}

function ticketedPath(): string {
  const leaf = process.env.IMAP_TICKETED_LEAF?.trim() || "Ticketed";
  const inbox = inboxPath();
  const delim =
    process.env.IMAP_MAILBOX_DELIM?.trim() ||
    (inbox.includes("/") && !inbox.includes(".") ? "/" : ".");
  return `${inbox}${delim}${leaf}`;
}

describe("imapConfigured", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.IMAP_USER;
    delete process.env.IMAP_HOST;
    delete process.env.IMAP_OAUTH_CLIENT_ID;
    delete process.env.IMAP_OAUTH_REFRESH_TOKEN;
    delete process.env.AZURE_AD_TENANT_ID;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns false when all missing", () => {
    expect(imapConfigured()).toBe(false);
  });

  it("returns false when one missing", () => {
    process.env.IMAP_USER = "user";
    process.env.IMAP_HOST = "host";
    process.env.IMAP_OAUTH_CLIENT_ID = "id";
    process.env.IMAP_OAUTH_REFRESH_TOKEN = "token";
    // AZURE_AD_TENANT_ID missing
    expect(imapConfigured()).toBe(false);
  });

  it("returns true when all present", () => {
    process.env.IMAP_USER = "user";
    process.env.IMAP_HOST = "host";
    process.env.IMAP_OAUTH_CLIENT_ID = "id";
    process.env.IMAP_OAUTH_REFRESH_TOKEN = "token";
    process.env.AZURE_AD_TENANT_ID = "tenant";
    expect(imapConfigured()).toBe(true);
  });
});

describe("inboxPath", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.IMAP_INBOX_PATH;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("defaults to INBOX", () => {
    expect(inboxPath()).toBe("INBOX");
  });

  it("reads env var", () => {
    process.env.IMAP_INBOX_PATH = "Inbox";
    expect(inboxPath()).toBe("Inbox");
  });

  it("trims whitespace", () => {
    process.env.IMAP_INBOX_PATH = "  INBOX  ";
    expect(inboxPath()).toBe("INBOX");
  });
});

describe("ticketedPath", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.IMAP_INBOX_PATH;
    delete process.env.IMAP_TICKETED_LEAF;
    delete process.env.IMAP_MAILBOX_DELIM;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("defaults to INBOX.Ticketed", () => {
    expect(ticketedPath()).toBe("INBOX.Ticketed");
  });

  it("uses custom leaf", () => {
    process.env.IMAP_TICKETED_LEAF = "Processed";
    expect(ticketedPath()).toBe("INBOX.Processed");
  });

  it("detects / delimiter when inbox contains /", () => {
    process.env.IMAP_INBOX_PATH = "INBOX/Sub";
    expect(ticketedPath()).toBe("INBOX/Sub/Ticketed");
  });

  it("uses explicit delimiter", () => {
    process.env.IMAP_MAILBOX_DELIM = "|";
    expect(ticketedPath()).toBe("INBOX|Ticketed");
  });

  it("uses . delimiter when inbox has dots", () => {
    process.env.IMAP_INBOX_PATH = "INBOX.Sub";
    expect(ticketedPath()).toBe("INBOX.Sub.Ticketed");
  });
});

// ── R2 config ────────────────────────────────────────────────────────────────

import { r2Configured } from "@/lib/r2";

describe("r2Configured", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns false when all missing", () => {
    expect(r2Configured()).toBe(false);
  });

  it("returns false when one missing", () => {
    process.env.R2_ACCOUNT_ID = "id";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    // R2_BUCKET missing
    expect(r2Configured()).toBe(false);
  });

  it("returns true when all present", () => {
    process.env.R2_ACCOUNT_ID = "id";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET = "bucket";
    expect(r2Configured()).toBe(true);
  });
});
