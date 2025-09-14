// pages/api/chatbots/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

/**
 * POST /api/chatbots/create
 * Body: { ownerId: string, name: string, model: string, instructions: string, temperature?: number }
 * Creates a brand-new Assistant (v2) with metadata.ownerId so it belongs to this account.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ownerId, name, model, instructions, temperature } = req.body || {};
    if (!ownerId || !name || !model) {
      return res.status(400).json({ error: 'ownerId, name and model are required' });
    }

    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing' });

    const payload: any = {
      name: String(name),
      model: String(model),
      instructions: typeof instructions === 'string' ? instructions : '',
      metadata: {
        ownerId: String(ownerId),
        ...(typeof temperature === 'number' ? { temperature: String(temperature) } : {}),
      },
    };

    const r = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(r.status).json({ error: text || `Upstream ${r.status}` });
    }

    const a = await r.json();
    return res.status(200).json({
      ok: true,
      assistant: {
        id: a.id,
        name: a.name,
        model: a.model,
        createdAt: a.created_at ? Number(a.created_at) * 1000 : Date.now(),
        temperature: parseFloat(a?.metadata?.temperature ?? '0.5') || 0.5,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'create failed' });
  }
}

function parseFloatSafe(x: any, d = 0.5) {
  const n = typeof x === 'string' ? parseFloat(x) : typeof x === 'number' ? x : NaN;
  return Number.isFinite(n) ? (n as number) : d;
}
