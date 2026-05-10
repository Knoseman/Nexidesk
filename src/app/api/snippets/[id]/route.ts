import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { snippets } from "@/lib/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const snippetId = Number(id);
  if (Number.isNaN(snippetId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [snippet] = await db
    .select()
    .from(snippets)
    .where(eq(snippets.id, snippetId))
    .limit(1);

  if (!snippet)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(snippet);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const snippetId = Number(id);
  if (Number.isNaN(snippetId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: any = {};
  if ("title" in body) updates.title = body.title;
  if ("content" in body) updates.content = body.content;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  updates.updatedAt = new Date();

  const [updated] = await db
    .update(snippets)
    .set(updates)
    .where(eq(snippets.id, snippetId))
    .returning();

  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const snippetId = Number(id);
  if (Number.isNaN(snippetId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [deleted] = await db
    .delete(snippets)
    .where(eq(snippets.id, snippetId))
    .returning();

  if (!deleted)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
