import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents } from "@/lib/schema";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [agent] = await db
    .select({
      id: agents.id,
      email: agents.email,
      name: agents.name,
      phone: agents.phone,
      role: agents.role,
      signatureHtml: agents.signatureHtml,
      labelColorBg: agents.labelColorBg,
      labelColorText: agents.labelColorText,
    })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = raw as Record<string, unknown>;
  const updates: {
    signatureHtml?: string | null;
    name?: string;
    phone?: string | null;
    labelColorBg?: string | null;
    labelColorText?: string | null;
    theme?: string;
  } = {};

  if ("signatureHtml" in body) {
    const sig = body.signatureHtml;
    if (sig !== null && typeof sig !== "string") {
      return NextResponse.json(
        { error: "signatureHtml must be a string or null" },
        { status: 400 },
      );
    }
    updates.signatureHtml =
      sig === null ? null : (sig as string).trim() || null;
  }

  if ("name" in body) {
    const name = body.name;
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name must be a non-empty string" },
        { status: 400 },
      );
    }
    if (name.trim().length > 120) {
      return NextResponse.json(
        { error: "name must be 120 characters or fewer" },
        { status: 400 },
      );
    }
    updates.name = name.trim();
  }

  if ("phone" in body) {
    const ph = body.phone;
    if (ph !== null && typeof ph !== "string") {
      return NextResponse.json(
        { error: "phone must be a string or null" },
        { status: 400 },
      );
    }
    updates.phone = ph === null ? null : (ph as string).trim() || null;
  }

  if ("labelColorBg" in body) {
    const bg = body.labelColorBg;
    if (bg !== null && typeof bg !== "string") {
      return NextResponse.json(
        { error: "labelColorBg must be a string or null" },
        { status: 400 },
      );
    }
    updates.labelColorBg = bg;
  }

  if ("labelColorText" in body) {
    const text = body.labelColorText;
    if (text !== null && typeof text !== "string") {
      return NextResponse.json(
        { error: "labelColorText must be a string or null" },
        { status: 400 },
      );
    }
    updates.labelColorText = text;
  }

  if ("theme" in body) {
    const t = body.theme;
    if (t !== "light" && t !== "dark" && t !== "auto") {
      return NextResponse.json(
        { error: "theme must be light, dark, or auto" },
        { status: 400 },
      );
    }
    updates.theme = t as string;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(agents)
    .set(updates)
    .where(eq(agents.id, agentId))
    .returning({
      id: agents.id,
      email: agents.email,
      name: agents.name,
      phone: agents.phone,
      role: agents.role,
      signatureHtml: agents.signatureHtml,
      theme: agents.theme,
      labelColorBg: agents.labelColorBg,
      labelColorText: agents.labelColorText,
    });

  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
