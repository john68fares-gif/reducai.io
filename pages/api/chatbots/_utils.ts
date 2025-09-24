import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL as string;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// single service client (server only)
export const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function readCookie(req: NextApiRequest, name: string): string | undefined {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Get the current user_id by verifying a Supabase access token. */
export async function requireUserId(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  // Prefer Authorization: Bearer <access_token>
  const auth = (req.headers.authorization || '').trim();
  let token = '';
  if (auth.toLowerCase().startsWith('bearer ')) token = auth.slice(7).trim();

  // Fallback: cookie set by @supabase/auth-ui / your auth flow
  if (!token) token = readCookie(req, 'sb-access-token') || '';

  if (!token) {
    res.status(401).json({ ok: false, error: 'Unauthorized: no access token' });
    return null;
  }

  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user?.id) {
    res.status(401).json({ ok: false, error: 'Unauthorized: invalid token' });
    return null;
  }
  return data.user.id;
}
