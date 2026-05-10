import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents } from "@/lib/schema";
import { anonymiseRequester } from "@/lib/gdpr";

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

export async function POST(req: Request) {
  const session = await auth();
  if (!(await requireAdmin(session)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as Record<string, unknown>;
  const ticketId = typeof body.ticketId === "number" ? body.ticketId : null;
  if (!ticketId)
    return NextResponse.json({ error: "ticketId required" }, { status: 400 });

  try {
    const result = await anonymiseRequester(ticketId);
    return NextResponse.json({ ticketId, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("not found"))
      return NextResponse.json({ error: msg }, { status: 404 });
    console.error("[gdpr] anonymise error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
