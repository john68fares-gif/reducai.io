// pages/api/voice/agent/[agentId]/publish.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const memStore = (global as any).__VA_MEM__ || new Map();
(global as any).__VA_MEM__ = memStore;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const { agentId } = req.query;
  if (!agentId || typeof agentId !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing agentId' });
  }

  const existing = memStore.get(agentId);
  if (!existing) {
    return res.status(404).json({ ok: false, error: 'Agent not found. Save first.' });
  }

  // Pretend to publish — log it so you can verify in server logs
  console.log('[PUBLISH]', agentId, {
    name: existing.name,
    model: existing.model,
    voiceName: existing.voiceName,
  });

  return res.status(200).json({
    ok: true,
    agentId,
    publishedAt: Date.now(),
  });
}
