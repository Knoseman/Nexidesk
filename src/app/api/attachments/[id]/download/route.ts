import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachments } from "@/lib/schema";
import { r2Get } from "@/lib/r2";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  void agentId;

  const { id } = await params;
  const attId = Number(id);
  if (Number.isNaN(attId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [row] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, attId))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stream = await r2Get(row.storageKey);
  if (!stream)
    return NextResponse.json({ error: "File not in storage" }, { status: 404 });

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer),
    );
  }
  const buf = Buffer.concat(chunks);

  const safe = row.filename.replace(/[\x00-\x1f"\\]/g, "_");
  const star = encodeURIComponent(row.filename);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": row.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safe}"; filename*=UTF-8''${star}`,
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
