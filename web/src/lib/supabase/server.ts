import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Session-aware Supabase client for Route Handlers and Server Components.
 * Respects Postgres RLS using the authenticated user's JWT.
 */
export async function createClient () {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll () {
          return cookieStore.getAll();
        },
        setAll (cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options));
        },
      },
    },
  );
}
