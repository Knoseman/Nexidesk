import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function signOutAction () {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function AppShellLayout ({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/app/tickets" className="font-medium text-zinc-900">
              Tickets
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-xs text-zinc-600">
            <span className="truncate max-w-[200px]" title={user.email}>{user.email}</span>
            <form action={signOutAction}>
              <button type="submit" className="text-blue-600 hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
