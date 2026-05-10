import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { tags } from "@/lib/schema";

export async function PATCH(req: Request) {
  const session = await auth();
  const admin = await requireAdmin(session);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Expected array of ids" }, { status: 400 });
  }

  const ids = body as number[];
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.update(tags).set({ sortOrder: i }).where(eq(tags.id, ids[i]));
    }
  });

  return NextResponse.json({ ok: true });
}
