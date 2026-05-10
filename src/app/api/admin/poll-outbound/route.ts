import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents } from "@/lib/schema";
import { processOutboundQueueOnce } from "@/lib/outbound";

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

export async function POST() {
  const session = await auth();
  if (!(await requireAdmin(session)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await processOutboundQueueOnce();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin] poll-outbound error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
