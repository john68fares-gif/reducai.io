// pages/api/chatbots/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const supabase = createServerSupabaseClient({ req, res });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return res.status(401).json({ ok: false, error: 'Not authenticated' });

  const { data, error } = await supabase
    .from('chatbots')
    .select('id, assistant_id, user_id, name, payload, created_at, updated_at')
    .eq('user_id', auth.user.id)
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ ok: false, error: error.message });

  // Dashboard expects an array named items
  return res.status(200).json({ ok: true, items: data || [] });
}
