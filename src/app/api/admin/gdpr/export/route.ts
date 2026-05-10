import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents, tickets, messages } from "@/lib/schema";

async function requireAdmin(session: Session | null): Promise<boolean> {
  if (!session?.user?.email) return false;
  const email = session.user.email.toLowerCase().trim();
  const [row] = await db
    .select({ role: agents.role })
    .from(agents)
    .where(sql`lower(${agents.email}::text) = ${email}`)
    .limit(1);
  return row?.role === "admin";
}

export async function GET(req: Request) {
  const session = await auth();
  if (!(await requireAdmin(session)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase().trim();
  if (!email || !email.includes("@"))
    return NextResponse.json(
      { error: "email query param required" },
      { status: 400 },
    );

  const ticketRows = await db
    .select({
      id: tickets.id,
      number: tickets.number,
      subjectNormalized: tickets.subjectNormalized,
      status: tickets.status,
      requesterEmail: tickets.requesterEmail,
      requesterEmailHash: tickets.requesterEmailHash,
      anonymisedAt: tickets.anonymisedAt,
      createdAt: tickets.createdAt,
      closedAt: tickets.closedAt,
    })
    .from(tickets)
    .where(sql`lower(${tickets.requesterEmail}::text) = ${email}`)
    .orderBy(asc(tickets.createdAt));

  const result = await Promise.all(
    ticketRows.map(async (t) => {
      const msgs = await db
        .select({
          id: messages.id,
          direction: messages.direction,
          fromEmail: messages.fromEmail,
          toEmails: messages.toEmails,
          subject: messages.subject,
          bodyText: messages.bodyText,
          receivedAt: messages.receivedAt,
          sentAt: messages.sentAt,
          anonymisedAt: messages.anonymisedAt,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.ticketId, t.id))
        .orderBy(asc(messages.createdAt));

      return {
        ...t,
        anonymisedAt: t.anonymisedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        closedAt: t.closedAt?.toISOString() ?? null,
        messages: msgs.map((m) => ({
          ...m,
          receivedAt: m.receivedAt?.toISOString() ?? null,
          sentAt: m.sentAt?.toISOString() ?? null,
          anonymisedAt: m.anonymisedAt?.toISOString() ?? null,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    }),
  );

  return NextResponse.json({ email, tickets: result });
}
