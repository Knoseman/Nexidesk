import { createClient } from '@/lib/supabase/server';

export default async function TicketsPage () {
  const supabase = await createClient();
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id, number, subject_normalized, status, requester_email, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Could not load tickets: {error.message}
      </div>
    );
  }

  if (!tickets?.length) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-semibold">Tickets</h1>
        <p className="text-zinc-600">
          No tickets yet. After Microsoft sign-in, data appears here when inbound email is wired up (Milestone 2).
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Tickets</h1>
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {tickets.map((t) => (
          <li key={t.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-zinc-900">
                {t.number}{' '}
                <span className="font-normal text-zinc-600">{t.subject_normalized}</span>
              </p>
              <p className="text-xs text-zinc-500">{t.requester_email}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                {t.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
