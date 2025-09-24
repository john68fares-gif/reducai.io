import type { NextApiRequest, NextApiResponse } from 'next';
import { sb, requireUserId } from './_utils';

/** Body: { assistantId: string } */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const userId = await requireUserId(req, res);
  if (!userId) return;

  const { assistantId } = (req.body || {}) as { assistantId?: string };
  if (!assistantId) {
    return res.status(400).json({ ok: false, error: 'Missing assistantId' });
  }

  try {
    const { error } = await sb
      .from('chatbots')
      .delete()
      .eq('user_id', userId)
      .eq('assistant_id', assistantId);

    if (error) throw error;
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'Delete failed' });
  }
}
