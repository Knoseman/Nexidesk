import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth, getAgentIdFromSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { contacts, tickets } from '@/lib/schema';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const contactId = Number(id);
  if (Number.isNaN(contactId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: any = {};
  if ('name' in body) updates.name = body.name;
  if ('phone' in body) updates.phone = body.phone;
  if ('title' in body) updates.title = body.title;
  if ('companyName' in body) updates.companyName = body.companyName;
  if ('email' in body) updates.email = body.email.toLowerCase();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(contacts)
    .set(updates)
    .where(eq(contacts.id, contactId))
    .returning();

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const agentId = await getAgentIdFromSession(session);
  if (agentId == null) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const contactId = Number(id);
  if (Number.isNaN(contactId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // Unlink tickets before deleting so the FK constraint doesn't block
  await db.update(tickets).set({ requesterId: null }).where(eq(tickets.requesterId, contactId));
  await db.delete(contacts).where(eq(contacts.id, contactId));

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const contactId = Number(id);
  if (Number.isNaN(contactId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(contact);
}
