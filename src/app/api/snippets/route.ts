import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { snippets } from "@/lib/schema";

export async function GET(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  let query = db.select().from(snippets).$dynamic();

  if (q) {
    query = query.where(
      sql`${snippets.title} ilike ${`%${q}%`}`,
    );
  }

  const results = await query.orderBy(desc(snippets.updatedAt));
  return NextResponse.json(results);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  if (!title)
    return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const [inserted] = await db
    .insert(snippets)
    .values({
      title,
      content,
      createdBy: agentId,
      isGlobal: true,
    })
    .returning();

  return NextResponse.json(inserted, { status: 201 });
}
