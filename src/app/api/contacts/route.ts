import { NextResponse } from "next/server";
import { desc, or, sql } from "drizzle-orm";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts } from "@/lib/schema";

export async function GET(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  let query = db.select().from(contacts).$dynamic();

  if (q) {
    // Basic search across name, email, company
    query = query.where(
      or(
        sql`${contacts.name} ilike ${`%${q}%`}`,
        sql`${contacts.email} ilike ${`%${q}%`}`,
        sql`${contacts.companyName} ilike ${`%${q}%`}`,
      ),
    );
  }

  const results = await query.orderBy(desc(contacts.createdAt));
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

  const { email, name, phone, title, companyName } = body;
  if (!email)
    return NextResponse.json({ error: "Email is required" }, { status: 400 });

  try {
    const [inserted] = await db
      .insert(contacts)
      .values({
        email: email.toLowerCase(),
        name,
        phone,
        title,
        companyName,
      })
      .returning();
    return NextResponse.json(inserted);
  } catch (e: any) {
    if (e.code === "23505") {
      return NextResponse.json(
        { error: "Contact already exists" },
        { status: 409 },
      );
    }
    throw e;
  }
}
