// /lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Helpful in Vercel logs if envs are missing
  console.warn('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const isBrowser = typeof window !== 'undefined';

// Single client (prevents multiple instances in dev/HMR)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',              // required for OAuth
    persistSession: true,          // keep session across reloads
    autoRefreshToken: true,        // refresh access token automatically
    detectSessionInUrl: isBrowser, // don't let SSR try to parse OAuth params
    storage: isBrowser ? window.localStorage : undefined,
    storageKey: 'reducai.auth',
    // If you serve both apex and www, uncomment this so cookies work on both:
    // cookieOptions: { domain: '.reducai.com', sameSite: 'lax', secure: true },
  },
  global: {
    headers: { 'X-Client-Info': 'reducai-web' },
  },
});
