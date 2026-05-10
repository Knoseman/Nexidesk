import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { tags } from "@/lib/schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const admin = await requireAdmin(session);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const tagId = Number(id);
  if (Number.isNaN(tagId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: any = {};
  if ("name" in body) updates.name = body.name;
  if ("color" in body) updates.color = body.color;
  if ("sortOrder" in body) updates.sortOrder = body.sortOrder;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(tags)
    .set(updates)
    .where(eq(tags.id, tagId))
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
  const admin = await requireAdmin(session);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const tagId = Number(id);
  if (Number.isNaN(tagId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [deleted] = await db.delete(tags).where(eq(tags.id, tagId)).returning();

  if (!deleted)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
