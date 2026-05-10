import { NextResponse } from "next/server";
import { asc, sql } from "drizzle-orm";
import { auth, getAgentIdFromSession, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { tags } from "@/lib/schema";

export async function GET(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  let query = db.select().from(tags).$dynamic();
  if (q) {
    query = query.where(sql`${tags.name} ilike ${`%${q}%`}`);
  }

  const results = await query.orderBy(asc(tags.sortOrder), asc(tags.createdAt));
  return NextResponse.json(results);
}

export async function POST(req: Request) {
  const session = await auth();
  const admin = await requireAdmin(session);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const color = typeof body.color === "string" ? body.color.trim() : "#6366f1";
  if (!name)
    return NextResponse.json({ error: "Name is required" }, { status: 400 });

  try {
    const [maxRow] = await db
      .select({ max: sql<number>`coalesce(max(${tags.sortOrder}), -1)` })
      .from(tags);
    const sortOrder = (maxRow?.max ?? -1) + 1;
    const [inserted] = await db
      .insert(tags)
      .values({ name, color, sortOrder })
      .returning();
    return NextResponse.json(inserted, { status: 201 });
  } catch (e: any) {
    if (e.code === "23505") {
      return NextResponse.json(
        { error: "Tag already exists" },
        { status: 409 },
      );
    }
    throw e;
  }
}
