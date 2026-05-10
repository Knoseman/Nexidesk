import { NextResponse } from "next/server";
import { asc, isNull } from "drizzle-orm";
import { auth, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents } from "@/lib/schema";

export async function GET(req: Request) {
  const session = await auth();
  const admin = await requireAdmin(session);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const includeDeleted = searchParams.get("includeDeleted") === "1";

  let qb = db
    .select({
      id: agents.id,
      email: agents.email,
      name: agents.name,
      phone: agents.phone,
      role: agents.role,
      isActive: agents.isActive,
      labelColorBg: agents.labelColorBg,
      labelColorText: agents.labelColorText,
      deletedAt: agents.deletedAt,
      createdAt: agents.createdAt,
    })
    .from(agents)
    .orderBy(asc(agents.createdAt))
    .$dynamic();

  if (!includeDeleted) {
    qb = qb.where(isNull(agents.deletedAt));
  }

  const rows = await qb;

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      deletedAt: r.deletedAt?.toISOString() ?? null,
    })),
  );
}

export async function POST(req: Request) {
  const session = await auth();
  const admin = await requireAdmin(session);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone =
    typeof body.phone === "string" ? body.phone.trim() || null : null;
  const role = body.role === "admin" ? "admin" : "agent";

  if (!email || !email.includes("@"))
    return NextResponse.json(
      { error: "Valid email required" },
      { status: 400 },
    );
  if (!name)
    return NextResponse.json({ error: "Name required" }, { status: 400 });

  const [created] = await db
    .insert(agents)
    .values({ email, name, phone, role, isActive: true })
    .returning({
      id: agents.id,
      email: agents.email,
      name: agents.name,
      phone: agents.phone,
      role: agents.role,
      isActive: agents.isActive,
      createdAt: agents.createdAt,
    });

  return NextResponse.json(
    { ...created, createdAt: created.createdAt.toISOString() },
    { status: 201 },
  );
}
