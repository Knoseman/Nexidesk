import { NextResponse } from 'next/server';
import { auth, getAgentIdFromSession } from '@/lib/auth';
import { handlePostTicketMessage } from '@/lib/post-ticket-message';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agentId = await getAgentIdFromSession(session);
  if (agentId == null) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const ticketId = Number(id);
  if (Number.isNaN(ticketId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  return handlePostTicketMessage(agentId, ticketId, json);
}
