// pages/api/chatbots/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OA = 'https://api.openai.com/v1';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!OPENAI_API_KEY) return res.status(200).json({ ok: true });

  const { id } = req.query;
  if (!id || Array.isArray(id)) return res.status(400).json({ error: 'invalid id' });

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${OA}/assistants/${id}`, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        return res.status(r.status).json({ error: text || `Upstream ${r.status}` });
      }
      const a = await r.json();
      return res.status(200).json({
        id: a.id,
        name: a.name || 'Untitled Agent',
        model: a.model || 'gpt-4o-mini',
        temperature: safeTemp(a?.metadata?.temperature, 0.5),
      });
    }

    if (req.method === 'PATCH') {
      const { model, temperature, ownerId } = req.body || {};
      const r = await fetch(`${OA}/assistants/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({
          ...(model ? { model } : {}),
          metadata: {
            ...(typeof temperature === 'number' ? { temperature: String(temperature) } : {}),
            ...(ownerId ? { ownerUserId: ownerId } : {}),
          },
        }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        return res.status(r.status).json({ error: text || `Upstream ${r.status}` });
      }
      const a = await r.json();
      return res.status(200).json({
        id: a.id,
        name: a.name || 'Untitled Agent',
        model: a.model || 'gpt-4o-mini',
        temperature: safeTemp(a?.metadata?.temperature, 0.5),
      });
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
}

function safeTemp(v: unknown, dflt: number) {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? (n as number) : dflt;
}
