// pages/api/profile.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]'; // make sure [...nextauth].ts exports authOptions
import { supabaseAdmin } from '@/lib/supabase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const session = await getServerSession(req, res, authOptions as any);
  if (!session?.user?.email) return res.status(401).json({ ok: false, error: 'Unauthenticated' });

  const { name, heard_from } = (req.body ?? {}) as { name?: string; heard_from?: string };
  const email = session.user.email as string;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(
      { email, name: name ?? null, heard_from: heard_from ?? null },
      { onConflict: 'email' }
    )
    .select('*')
    .single();

  if (error) return res.status(500).json({ ok: false, error: error.message });

  res.status(200).json({ ok: true, profile: data });
}
