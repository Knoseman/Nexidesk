import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents } from "@/lib/schema";

export async function GET() {
  const session = await auth();
  const agentId = await getAgentIdFromSession(session);
  if (!agentId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      email: agents.email,
      labelColorBg: agents.labelColorBg,
      labelColorText: agents.labelColorText,
    })
    .from(agents)
    .where(and(isNull(agents.deletedAt), eq(agents.isActive, true)))
    .orderBy(asc(agents.name));

  return NextResponse.json({ agents: rows, currentAgentId: agentId });
}
