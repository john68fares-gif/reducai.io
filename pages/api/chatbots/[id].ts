// pages/api/chatbots/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAgentById, updateAgentById } from '@/lib/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });

  // owner check comes from client header
  const ownerId = (req.headers['x-owner-id'] as string) || '';

  if (req.method === 'GET') {
    const a = await getAgentById(id);
    if (!a) return res.status(404).json({ ok: false, error: 'Not found' });
    if (ownerId && a.ownerId !== ownerId) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    return res.status(200).json({ ok: true, data: a });
  }

  if (req.method === 'PATCH') {
    try {
      const a = await getAgentById(id);
      if (!a) return res.status(404).json({ ok: false, error: 'Not found' });
      if (!ownerId || a.ownerId !== ownerId) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
        // (Optional) On a trusted backend you could infer owner from session instead.
      }

      const { name, model, temperature, prompt } = req.body || {};
      const updated = await updateAgentById(id, {
        ...(name ? { name } : {}),
        ...(model ? { model } : {}),
        ...(typeof temperature === 'number' ? { temperature } : {}),
        ...(typeof prompt === 'string' ? { prompt } : {}),
      });

      return res.status(200).json({ ok: true, data: updated });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || 'update failed' });
    }
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
