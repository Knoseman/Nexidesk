// GET /api/tickets/:id/queue-status?messageId=N
// Returns { status: string | null }
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { outboundQueue } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const ticketId = Number(id);
  const url = new URL(req.url);
  const messageId = Number(url.searchParams.get('messageId'));
  if (Number.isNaN(ticketId) || Number.isNaN(messageId)) {
    return NextResponse.json({ status: null });
  }
  const [row] = await db
    .select({ status: outboundQueue.status })
    .from(outboundQueue)
    .where(eq(outboundQueue.stagedMessageId, messageId))
    .limit(1);
  return NextResponse.json({ status: row?.status ?? null });
}
