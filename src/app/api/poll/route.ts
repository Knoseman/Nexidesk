import { NextResponse } from "next/server";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { pollImap } from "@/lib/imap";

export async function POST() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await pollImap();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Poll failed";
    console.error("[poll] error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
