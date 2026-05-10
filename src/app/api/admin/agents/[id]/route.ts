import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth, getAgentIdFromSession, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents } from "@/lib/schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const admin = await requireAdmin(session);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const agentId = await getAgentIdFromSession(session);

  const { id } = await params;
  const targetId = Number(id);
  if (Number.isNaN(targetId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;
  const updates: Partial<{
    name: string;
    phone: string | null;
    role: string;
    isActive: boolean;
  }> = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name)
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    updates.name = name;
  }
  if ("phone" in body) {
    updates.phone =
      typeof body.phone === "string" ? body.phone.trim() || null : null;
  }
  if ("role" in body) {
    if (body.role !== "agent" && body.role !== "admin")
      return NextResponse.json(
        { error: "role must be agent or admin" },
        { status: 400 },
      );
    // Prevent self-downgrade
    if (targetId === agentId && body.role !== "admin") {
      return NextResponse.json(
        { error: "Cannot downgrade yourself" },
        { status: 400 },
      );
    }
    updates.role = body.role;
  }
  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean")
      return NextResponse.json(
        { error: "isActive must be boolean" },
        { status: 400 },
      );
    updates.isActive = body.isActive;
  }

  // Prevent editing deleted agents
  const [target] = await db
    .select({ deletedAt: agents.deletedAt })
    .from(agents)
    .where(eq(agents.id, targetId))
    .limit(1);
  if (target?.deletedAt)
    return NextResponse.json(
      { error: "Cannot edit a deleted agent" },
      { status: 400 },
    );

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });

  const [updated] = await db
    .update(agents)
    .set(updates)
    .where(eq(agents.id, targetId))
    .returning({
      id: agents.id,
      email: agents.email,
      name: agents.name,
      phone: agents.phone,
      role: agents.role,
      isActive: agents.isActive,
      deletedAt: agents.deletedAt,
      createdAt: agents.createdAt,
    });

  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    deletedAt: updated.deletedAt?.toISOString() ?? null,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const admin = await requireAdmin(session);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const agentId = await getAgentIdFromSession(session);

  const { id } = await params;
  const targetId = Number(id);
  if (Number.isNaN(targetId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  // Prevent self-deletion
  if (targetId === agentId)
    return NextResponse.json(
      { error: "Cannot delete yourself" },
      { status: 400 },
    );

  const [target] = await db
    .select({ deletedAt: agents.deletedAt })
    .from(agents)
    .where(eq(agents.id, targetId))
    .limit(1);
  if (!target)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.deletedAt)
    return NextResponse.json({ error: "Already deleted" }, { status: 400 });

  const [updated] = await db
    .update(agents)
    .set({
      name: "Deleted agent",
      email: `deleted-${targetId}@anonymized.local`,
      phone: null,
      isActive: false,
      deletedAt: new Date(),
    })
    .where(eq(agents.id, targetId))
    .returning({ id: agents.id });

  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
