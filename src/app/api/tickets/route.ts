import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts, tickets, messages } from "@/lib/schema";

export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const requesterEmail =
    typeof body.requesterEmail === "string"
      ? body.requesterEmail.trim().toLowerCase()
      : "";
  const bodyText =
    typeof body.body === "string" ? body.body.trim() || null : null;

  if (!subject)
    return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  if (!requesterEmail || !requesterEmail.includes("@"))
    return NextResponse.json(
      { error: "Valid requester email is required" },
      { status: 400 },
    );

  const result = await db.transaction(async (tx) => {
    // Find or create contact
    let [contact] = await tx
      .select()
      .from(contacts)
      .where(sql`lower(${contacts.email}::text) = ${requesterEmail}`)
      .limit(1);

    if (!contact) {
      [contact] = await tx
        .insert(contacts)
        .values({ email: requesterEmail })
        .returning();
    }

    const placeholder = `tmp-${randomUUID()}`;
    const [ticket] = await tx
      .insert(tickets)
      .values({
        number: placeholder,
        subjectNormalized: subject,
        requesterEmail,
        requesterId: contact.id,
      })
      .returning({ id: tickets.id });

    await tx
      .update(tickets)
      .set({
        number: `CID-${String(ticket.id).padStart(5, "0")}`,
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticket.id));

    if (bodyText) {
      await tx.insert(messages).values({
        ticketId: ticket.id,
        direction: "internal_note",
        bodyText,
        agentId,
      });
    }

    return {
      ticketId: ticket.id,
      number: `CID-${String(ticket.id).padStart(5, "0")}`,
    };
  });

  return NextResponse.json(result, { status: 201 });
}
