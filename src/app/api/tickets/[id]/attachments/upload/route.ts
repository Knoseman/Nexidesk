import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth, getAgentIdFromSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachmentUploads } from "@/lib/schema";
import { r2Configured, r2Put } from "@/lib/r2";

export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!r2Configured()) {
    return NextResponse.json(
      { error: "Attachment storage not configured" },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const MAX_BYTES = 20 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 20 MB limit" },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const sha256hex = createHash("sha256").update(buf).digest("hex");
  const storageKey = `at/${sha256hex}`;
  const contentType = file.type || "application/octet-stream";

  await r2Put(storageKey, buf, contentType);

  const [row] = await db
    .insert(attachmentUploads)
    .values({
      agentId,
      storageKey,
      sha256: Buffer.from(sha256hex, "hex"),
      contentType,
      sizeBytes: buf.byteLength,
    })
    .returning({ id: attachmentUploads.id });

  return NextResponse.json({
    uploadId: row.id,
    filename: file.name,
    contentType,
    sizeBytes: buf.byteLength,
  });
}
