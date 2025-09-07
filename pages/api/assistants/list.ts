// pages/api/chatbots/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET /api/chatbots/list?userId=uuid
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const userId = String(req.query.userId || '');
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing userId' });

    const { data, error } = await supabase
      .from('chatbots')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json({ ok: true, chatbots: data || [] });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Failed to list chatbots' });
  }
}
