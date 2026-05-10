import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/schema";
import { eq, ne } from "drizzle-orm";
import {
  agents,
  contacts,
  tickets,
  messages,
  auditLogs,
  emailEvents,
  outboundQueue,
} from "@/lib/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

const NEXI_ISSUES = [
  {
    subject: "Payment authorization timeout on Nexi POS terminal",
    firstMessage:
      "We're experiencing intermittent timeout errors when processing payments through the Nexi POS API. The authorization takes longer than expected and sometimes fails completely. This is impacting our sales.",
  },
  {
    subject: "Nexi API authentication failure after token refresh",
    firstMessage:
      "Our integration keeps failing after the OAuth token refreshes. We're getting 401 errors even though the token should be valid. Can you help us debug the token refresh flow?",
  },
  {
    subject: "Transaction reconciliation missing Nexi payments",
    firstMessage:
      "Our daily reconciliation reports are missing some transactions from the Nexi POS system. It seems like batched transactions aren't being reported correctly through the API.",
  },
  {
    subject: "Nexi webhook signatures invalid after certificate rotation",
    firstMessage:
      "After the certificate rotation on Nexi's side, our webhook signature verification started failing. All incoming webhooks are now being rejected. We need the new certificate details.",
  },
  {
    subject: "Duplicate transactions appearing in Nexi history",
    firstMessage:
      "We're seeing the same transaction appear twice in our transaction history from the Nexi API. This is causing data integrity issues in our reporting.",
  },
  {
    subject: "Nexi refund API returning incorrect status codes",
    firstMessage:
      "When we process refunds through the Nexi API, the response status codes don't match the actual refund state. We can't reliably determine if a refund succeeded.",
  },
  {
    subject: "Rate limiting on Nexi API endpoints",
    firstMessage:
      "We're hitting rate limits on the Nexi API during peak hours. The documentation doesn't specify the rate limits clearly. Can we increase our quota?",
  },
  {
    subject: "Nexi payment method retrieval endpoint broken",
    firstMessage:
      "The endpoint to retrieve available payment methods is returning empty results. We need this to show customers their options at checkout.",
  },
  {
    subject: "Error handling inconsistency in Nexi responses",
    firstMessage:
      "Different error conditions from the Nexi API are returning inconsistent error codes and messages. We can't reliably parse error responses.",
  },
  {
    subject: "Nexi account balance endpoint timeout",
    firstMessage:
      "Our background job that checks account balance via the Nexi API is timing out periodically. This is causing incomplete billing cycles.",
  },
  {
    subject: "Settlement report generation failing for Nexi transactions",
    firstMessage:
      "The settlement reports we download from Nexi don't include all transactions. Some transactions are missing from the report files.",
  },
  {
    subject: "Nexi 3D Secure challenge not working",
    firstMessage:
      "When 3D Secure authentication is triggered through Nexi API, the challenge page isn't loading properly. Customers can't complete their authentication.",
  },
  {
    subject: "API documentation missing required Nexi parameters",
    firstMessage:
      "The Nexi API documentation is missing details about which parameters are required for certain endpoints. We're getting validation errors for missing fields.",
  },
  {
    subject: "Nexi batch processing results incomplete",
    firstMessage:
      "When we submit batch transactions to Nexi, only some of them are processed. The response doesn't indicate which ones failed.",
  },
  {
    subject: "Terminal configuration sync with Nexi API not working",
    firstMessage:
      "Changes we make to terminal configurations in our system aren't syncing to the Nexi POS terminals. The API calls seem to succeed but nothing changes.",
  },
];

const AGENT_RESPONSES = [
  "I've reviewed your account and found the issue. Can you try the following steps: [solution]. Let me know if this resolves the problem.",
  "Thank you for reporting this. We've identified a potential race condition in the webhook processing. We're working on a fix and will have an update within 24 hours.",
  "This appears to be related to a known issue we're tracking. Here's a workaround in the meantime: [workaround]. We're prioritizing a permanent fix.",
  "I've escalated this to our integration team. They'll reach out directly to help you debug this. In the meantime, can you share your recent API logs?",
  "Great catch! This is indeed a bug on our end. We've deployed a hotfix. Please clear your cache and try again.",
];

const REQUESTER_REPLIES = [
  "Thanks for the quick response. We'll test that solution right away and let you know the results.",
  "We tried that but it's still not working. The error message we're getting is: [error details]. Any other ideas?",
  "That workaround works but seems like a band-aid. When will the permanent fix be available?",
  "We've sent you the logs. Looking forward to hearing from the integration team.",
  "Perfect! That fixed it. Thank you for the fast turnaround. Can you also help us with the related issue we're experiencing with refunds?",
];

async function generateTickets() {
  console.log("Starting test data generation...");

  // Get all non-admin agents
  const allAgents = await db
    .select()
    .from(agents)
    .where(ne(agents.role, "admin"));

  if (allAgents.length === 0) {
    throw new Error("No agents found. Please create at least one agent first.");
  }

  console.log(`Found ${allAgents.length} agents`);

  // Delete all existing data (in correct order to respect foreign keys)
  console.log("Deleting existing data...");
  await db.delete(emailEvents);
  await db.delete(outboundQueue);
  await db.delete(auditLogs);
  await db.delete(tickets);

  // Create requester contacts for variation
  const requesterEmails = [
    "merchant1@nexipos.com",
    "merchant2@nexipos.com",
    "merchant3@nexipos.com",
    "merchant4@nexipos.com",
    "merchant5@nexipos.com",
  ];

  const existingContacts = await db.select().from(contacts);
  const existingEmails = new Set(existingContacts.map((c) => c.email));

  for (const email of requesterEmails) {
    if (!existingEmails.has(email)) {
      await db.insert(contacts).values({
        email,
        name: email.split("@")[0],
        companyName: "Nexi Merchant",
      });
    }
  }

  // Generate 50 tickets
  console.log("Generating 50 tickets with Nexi POS API issues...");

  const statuses = ["new", "open", "pending", "resolved"];
  const priorities = ["low", "normal", "high", "urgent"];
  let ticketCounter = 1;

  for (let i = 0; i < 50; i++) {
    const issue = NEXI_ISSUES[i % NEXI_ISSUES.length];
    const assignee = allAgents[i % allAgents.length];
    const requesterEmail = requesterEmails[i % requesterEmails.length];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];

    // Get requester contact
    const requester = await db
      .select()
      .from(contacts)
      .where(eq(contacts.email, requesterEmail))
      .limit(1);

    const requesterId = requester[0]?.id;

    // Create ticket
    const ticketNumber = `#${String(1000 + ticketCounter).slice(1)}`;
    ticketCounter++;

    const [ticket] = await db
      .insert(tickets)
      .values({
        number: ticketNumber,
        subjectNormalized: issue.subject.toLowerCase(),
        status,
        priority,
        assigneeId: assignee.id,
        requesterId,
        requesterEmail,
      })
      .returning();

    console.log(`Created ticket ${ticketNumber}: ${issue.subject}`);

    // Create initial message from requester
    const baseTime = new Date();
    baseTime.setHours(baseTime.getHours() - (50 - i));

    await db.insert(messages).values({
      ticketId: ticket.id,
      direction: "inbound",
      fromEmail: requesterEmail,
      toEmails: [process.env.MAILBOX_ADDRESS || "support@nexidesk.local"],
      subject: issue.subject,
      bodyText: issue.firstMessage,
      receivedAt: new Date(baseTime.getTime()),
    });

    // Create 4-5 alternating messages (agent response, requester reply, etc)
    const messageCount = 4 + Math.floor(Math.random() * 2);
    for (let j = 0; j < messageCount; j++) {
      const isAgentMessage = j % 2 === 0;
      const messageTime = new Date(
        baseTime.getTime() + (j + 1) * 60 * 60 * 1000
      );

      if (isAgentMessage) {
        const response =
          AGENT_RESPONSES[Math.floor(Math.random() * AGENT_RESPONSES.length)];
        await db.insert(messages).values({
          ticketId: ticket.id,
          direction: "outbound",
          fromEmail: process.env.MAILBOX_ADDRESS || "support@nexidesk.local",
          toEmails: [requesterEmail],
          subject: `Re: ${issue.subject}`,
          bodyText: response,
          agentId: assignee.id,
          sentAt: messageTime,
        });
      } else {
        const reply =
          REQUESTER_REPLIES[Math.floor(Math.random() * REQUESTER_REPLIES.length)];
        await db.insert(messages).values({
          ticketId: ticket.id,
          direction: "inbound",
          fromEmail: requesterEmail,
          toEmails: [process.env.MAILBOX_ADDRESS || "support@nexidesk.local"],
          subject: `Re: ${issue.subject}`,
          bodyText: reply,
          receivedAt: messageTime,
        });
      }
    }

    // Create audit log entry
    await db.insert(auditLogs).values({
      ticketId: ticket.id,
      agentId: assignee.id,
      action: "ticket_created",
      metadata: {
        source: "test_data_generation",
      },
    });
  }

  console.log("✓ Successfully generated 50 test tickets with conversations");
  console.log(
    "All tickets contain 4-5 message exchanges between agents and requesters"
  );
}

generateTickets()
  .catch((error) => {
    console.error("Error generating tickets:", error);
    process.exit(1);
  })
  .finally(() => {
    client.end();
  });
