'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';

function LoginForm () {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/app/tickets';
  const err = searchParams.get('error');
  const [busy, setBusy] = useState(false);

  async function signInWithMicrosoft () {
    setBusy(true);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        scopes: 'openid profile email',
      },
    });
    if (error) {
      setBusy(false);
      alert(error.message);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Nexidesk</h1>
      <p className="mb-8 text-sm text-zinc-600">
        Sign in with your Microsoft 365 work account. Your email must exist in the <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">agents</code> roster.
      </p>

      {err && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Sign-in failed ({err}). Check Entra + Supabase provider configuration.
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => void signInWithMicrosoft()}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? 'Redirecting…' : 'Continue with Microsoft'}
      </button>

      <p className="mt-6 text-center text-xs text-zinc-500">
        <Link href="/">Back</Link>
      </p>
    </div>
  );
}

export default function LoginPage () {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
