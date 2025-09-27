// /lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Fail early (helps on Vercel if you forgot to add envs)
if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anon, {
  auth: {
    // Required for Google OAuth + redirects
    flowType: 'pkce',
    // Keep the session in localStorage and auto-refresh tokens
    persistSession: true,
    autoRefreshToken: true,
    // Let the SDK read the OAuth code from the callback URL
    detectSessionInUrl: true,
  },
});
