import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { auth, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents } from "@/lib/schema";
import { createGraphInvitation, createGraphUser } from "@/lib/graph-users";

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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone =
    typeof body.phone === "string" ? body.phone.trim() || null : null;

  if (!name)
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!email || !email.includes("@"))
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 },
    );

  // Check email doesn't already exist
  const [existing] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(sql`lower(${agents.email}::text) = ${email}`)
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "An agent with this email already exists" },
      { status: 409 },
    );
  }

  const emailDomain = email.split("@")[1];
  const upnDomain = process.env.AZURE_AD_UPN_DOMAIN;

  // If AZURE_AD_UPN_DOMAIN is configured, treat non-matching domains as external.
  // External users are invited as B2B guests so they can sign in via the
  // tenant-specific endpoint with their personal/work credentials.
  const isExternal = upnDomain
    ? upnDomain.toLowerCase() !== emailDomain.toLowerCase()
    : false;

  let graphUserId: string | null = null;

  try {
    if (isExternal) {
      const redirectUrl = process.env.NEXTAUTH_URL
        ? `${process.env.NEXTAUTH_URL.replace(/\/$/, "")}/`
        : "https://nexidesk.up.railway.app/";

      console.log("[register] sending B2B invitation to:", email);
      const invitation = await createGraphInvitation({
        email,
        displayName: name,
        redirectUrl,
      });
      graphUserId = invitation.invitedUserId;
    } else {
      const mailNickname = email.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "");
      let userPrincipalName = email;
      let finalMailNickname = mailNickname || "user";

      if (upnDomain && upnDomain.toLowerCase() !== emailDomain.toLowerCase()) {
        const suffix = Math.random().toString(36).slice(2, 6);
        finalMailNickname = mailNickname
          ? `${mailNickname.slice(0, 20)}_${suffix}`
          : `user_${suffix}`;
        userPrincipalName = `${finalMailNickname}@${upnDomain}`;
      }

      console.log(
        "[register] creating Entra member with UPN:",
        userPrincipalName,
      );
      const graphUser = await createGraphUser({
        displayName: name,
        mailNickname: finalMailNickname,
        userPrincipalName,
        mail: email,
      });
      graphUserId = graphUser.id;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Entra provisioning failed";
    console.error("[register] Entra provisioning failed:", e);
    return NextResponse.json(
      { error: `Failed to create Microsoft account: ${msg}` },
      { status: 502 },
    );
  }

  // Insert local agent row (inactive)
  const [created] = await db
    .insert(agents)
    .values({
      email,
      name,
      phone,
      role: "agent",
      isActive: false,
    })
    .returning({
      id: agents.id,
      email: agents.email,
      name: agents.name,
      isActive: agents.isActive,
    });

  return NextResponse.json(
    {
      id: created.id,
      email: created.email,
      name: created.name,
      isActive: created.isActive,
      graphUserId,
    },
    { status: 201 },
  );
}
