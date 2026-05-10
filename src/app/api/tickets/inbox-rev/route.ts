import { NextResponse } from 'next/server';
import { auth, getAgentIdFromSession } from '@/lib/auth';
import { getInboxDataRevMs } from '@/lib/inbox-revision';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agentId = await getAgentIdFromSession(session);
  if (agentId == null) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rev = await getInboxDataRevMs();
  return NextResponse.json({ rev });
}
