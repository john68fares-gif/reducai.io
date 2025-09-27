// pages/api/voice/agent/[id]/publish.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Ok = { ok: true; url?: string };
type Err = { ok: false; error: string };

const mem: Record<string, any> =
  (global as any).__AGENT_STORE__ || ((global as any).__AGENT_STORE__ = {});

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }
  try {
    const id = (req.query.id || '').toString();
    if (!id) return res.status(400).json({ ok: false, error: 'Missing agent id' });

    // “Publish” is a no-op demo: mark as live + return a synthetic URL
    const agent = mem[id] || {};
    mem[id] = { ...agent, _publishedAt: Date.now() };

    const base =
      process.env.PUBLIC_BASE_URL ||
      `${(req.headers['x-forwarded-proto'] as string) || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const url = `${base}/voice-agent?agent=${encodeURIComponent(id)}`;

    return res.status(200).json({ ok: true, url });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Publish error' });
  }
}
