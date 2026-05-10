import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function Home () {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect('/app/tickets');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Nexidesk</h1>
      <p className="mb-8 text-zinc-600">
        O365 shared mailbox → ticketing. See the programme plan in{' '}
        <code className="rounded bg-zinc-100 px-1 text-sm">docs/PROJECT_PLAN.md</code>.
      </p>
      <Link
        href="/login"
        className="inline-flex w-fit rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Sign in
      </Link>
    </div>
  );
}
