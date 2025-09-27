import type { NextApiRequest, NextApiResponse } from 'next';

type Ok = { ok: true };
type Err = { ok: false; error: string };

const mem: Record<string, any> =
  (global as any).__AGENT_STORE__ || ((global as any).__AGENT_STORE__ = {});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }
  try {
    const agentId = String(req.query.agentId || '');
    if (!agentId) return res.status(400).json({ ok: false, error: 'Missing agent id' });

    const payload = req.body || {};
    mem[agentId] = { ...(mem[agentId] || {}), ...payload, _updatedAt: Date.now() };
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Save error' });
  }
}
