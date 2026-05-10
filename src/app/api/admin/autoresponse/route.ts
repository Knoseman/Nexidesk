import { NextResponse } from "next/server";
import {} from "drizzle-orm";
import { auth, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { autoresponderConfig } from "@/lib/schema";

export async function GET() {
  const session = await auth();
  const admin = await requireAdmin(session);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [row] = await db.select().from(autoresponderConfig).limit(1);
  if (!row) {
    return NextResponse.json({
      enabled: false,
      subject: "Re: [{{ticket.number}}] {{ticket.subject}}",
      bodyHtml:
        "<p>Thank you for contacting us. Your request has been received and assigned ticket number <strong>{{ticket.number}}</strong>.</p><p>We will get back to you as soon as possible.</p>",
      bodyText:
        "Thank you for contacting us. Your request has been received and assigned ticket number {{ticket.number}}.\n\nWe will get back to you as soon as possible.",
    });
  }

  return NextResponse.json({
    enabled: row.enabled,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    bodyText: row.bodyText,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const admin = await requireAdmin(session);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Partial<{
    enabled: boolean;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    updatedAt: Date;
    updatedBy: number;
  }> = {};

  if ("enabled" in body) {
    if (typeof body.enabled !== "boolean")
      return NextResponse.json(
        { error: "enabled must be boolean" },
        { status: 400 },
      );
    updates.enabled = body.enabled;
  }
  if ("subject" in body) {
    if (typeof body.subject !== "string" || !body.subject.trim())
      return NextResponse.json({ error: "subject required" }, { status: 400 });
    updates.subject = body.subject.trim();
  }
  if ("bodyHtml" in body) {
    if (typeof body.bodyHtml !== "string")
      return NextResponse.json(
        { error: "bodyHtml must be string" },
        { status: 400 },
      );
    updates.bodyHtml = body.bodyHtml;
  }
  if ("bodyText" in body) {
    if (typeof body.bodyText !== "string")
      return NextResponse.json(
        { error: "bodyText must be string" },
        { status: 400 },
      );
    updates.bodyText = body.bodyText;
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });

  updates.updatedAt = new Date();
  updates.updatedBy = admin.id;

  await db
    .insert(autoresponderConfig)
    .values({
      id: 1,
      enabled: false,
      subject: "",
      bodyHtml: "",
      bodyText: "",
      ...updates,
    })
    .onConflictDoUpdate({ target: autoresponderConfig.id, set: updates });

  return NextResponse.json({ ok: true });
}
