// pages/api/chatbots/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { listAgentsByOwner } from '@/lib/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // The client sends this (see Improve edits below).
    const ownerId =
      (req.headers['x-owner-id'] as string) ||
      (req.query.ownerId as string) ||
      '';

    if (!ownerId) {
      return res.status(400).json({ ok: false, error: 'ownerId required' });
    }

    const rows = await listAgentsByOwner(ownerId);

    // Reduce to the small shape Improve wants
    const data = rows.map(a => ({
      id: a.id,
      name: a.name || 'Untitled Agent',
      createdAt: a.createdAt ?? a.updatedAt ?? Date.now(),
      model: a.model || 'gpt-4o-mini',
      temperature: typeof a.temperature === 'number' ? a.temperature : 0.5,
    }));

    return res.status(200).json({ ok: true, data });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'failed' });
  }
}
