import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * REQUIREMENTS
 * 1) Env vars:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY   (service key; used ONLY on server)
 *
 * 2) Table (run once in Supabase SQL editor):
 *
 *    create table if not exists api_key_claims (
 *      id uuid primary key default gen_random_uuid(),
 *      user_id uuid not null,
 *      key_hash text not null unique,              -- SHA-256 of key + server salt
 *      last4 text not null,
 *      label text,
 *      created_at timestamptz not null default now()
 *    );
 *
 *    -- RLS (optional but recommended)
 *    alter table api_key_claims enable row level security;
 *    create policy "read own rows" on api_key_claims
 *      for select using (auth.uid() = user_id);
 *    create policy "insert own rows" on api_key_claims
 *      for insert with check (auth.uid() = user_id);
 *
 * 3) Your front-end sends: { key: "sk-...", label?: "My Project" }
 *    along with the user's access token in Authorization: Bearer <jwt>
 *    OR you can pass the supabase auth cookie; we also accept "x-ra-user" for dev.
 */

type Body = { key?: string; label?: string };
type Out =
  | { ok: true; data: { last4: string } }
  | { ok: false; error: { code: string; message: string } };

const SALT = process.env.API_KEY_FINGERPRINT_SALT || 'changeme-super-secret-salt';

function sha256Hex(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function fingerprintKey(raw: string) {
  // Normalize & hash with salt. We never store the key itself.
  const key = (raw || '').trim();
  const toHash = `${SALT}:${key}`;
  return sha256Hex(toHash);
}

function getBearer(req: NextApiRequest) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] || '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Out>) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: { code: 'method_not_allowed', message: 'POST only' } });
    return;
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as Body;
  const rawKey = (body.key || '').trim();
  const label = (body.label || '').trim();

  if (!rawKey || !rawKey.startsWith('sk-') || rawKey.length < 12) {
    res.status(400).json({ ok: false, error: { code: 'bad_key', message: 'Provide a valid OpenAI key (starts with sk-).' } });
    return;
  }

  // Identify the user
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string, // server-only
    { auth: { persistSession: false } }
  );

  // Accept either a Bearer JWT from supabase-auth-helpers or a dev header
  const accessToken = getBearer(req);
  let userId: string | null = null;

  if (accessToken) {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      res.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Invalid token' } });
      return;
    }
    userId = user.id;
  } else if (req.headers['x-ra-user']) {
    // Dev fallback (remove in prod)
    userId = String(req.headers['x-ra-user']);
  } else {
    res.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Missing auth' } });
    return;
  }

  const keyHash = fingerprintKey(rawKey);
  const last4 = rawKey.slice(-4);

  // Try to insert. Unique constraint on key_hash prevents duplicates across ALL users.
  const { error: insertErr } = await supabase
    .from('api_key_claims')
    .insert({ user_id: userId, key_hash: keyHash, last4, label })
    .select()
    .single();

  if (insertErr) {
    // 23505 = unique_violation (Postgres). Another user already claimed the same key.
    const unique = (insertErr as any).code === '23505';
    res
      .status(unique ? 409 : 500)
      .json({
        ok: false,
        error: {
          code: unique ? 'already_claimed' : 'db_error',
          message: unique
            ? 'This API key is already in use by a different account.'
            : (insertErr as any).message || 'Failed to claim API key.',
        },
      });
    return;
  }

  res.status(200).json({ ok: true, data: { last4 } });
}
