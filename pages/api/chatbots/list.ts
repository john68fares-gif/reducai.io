import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const supabase = supabaseServer(req, res);
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });

    const { data, error } = await supabase
      .from('chatbots')
      .select('id, user_id, assistant_id, name, model, payload, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      ok: true,
      items: (data || []).map((r) => ({
        id: r.id,
        assistant_id: r.assistant_id,
        name: r.name,
        model: r.model,
        payload: r.payload || null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
