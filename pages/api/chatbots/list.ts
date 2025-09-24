import type { NextApiRequest, NextApiResponse } from 'next';
import { sb, requireUserId } from './_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const userId = await requireUserId(req, res);
  if (!userId) return;

  try {
    const { data, error } = await sb
      .from('chatbots')
      .select('id, assistant_id, user_id, name, payload, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      ok: true,
      items: (data || []).map((row) => ({
        id: row.id,
        assistant_id: row.assistant_id,
        user_id: row.user_id,
        name: row.name,
        payload: row.payload,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'List failed' });
  }
}
