import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth, getAgentIdFromSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { tickets } from '@/lib/schema';
import { markTicketRead } from '@/lib/tickets-list';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agentId = await getAgentIdFromSession(session);
  if (agentId == null) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const ticketId = Number(id);
  if (Number.isNaN(ticketId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [row] = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await markTicketRead(agentId, ticketId);

  return NextResponse.json({ ok: true });
}
