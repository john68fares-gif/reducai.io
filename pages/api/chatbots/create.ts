// pages/api/chatbots/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsert } from '@/lib/chatbots-store'; // ← ADD THIS
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

/** Resolve owner from header → query → cookie → 'anon' (don’t trust body) */
function getOwnerId(req: NextApiRequest): string {
  const h = ((req.headers['x-owner-id'] || req.headers['x-user-id']) ?? '') as string;
  if (h && h.trim()) return h.trim();
  if (typeof req.query.ownerId === 'string' && req.query.ownerId.trim()) return req.query.ownerId.trim();
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)ra_uid=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  return 'anon';
}

/**
 * POST /api/chatbots/create
 * Body: { name, model, instructions?, temperature? }
 * NOTE: ownerId is taken from request context, not the body.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ownerId = getOwnerId(req);              // ← use consistent owner resolution
    const { name, model, instructions = '', temperature } = req.body || {};
    if (!ownerId || !name || !model) {
      return res.status(400).json({ error: 'ownerId (context), name and model are required' });
    }
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing' });

    const payload: any = {
      name: String(name),
      model: String(model),
      instructions: String(instructions ?? ''),
      metadata: {
        ownerId, // ← record owner in OpenAI metadata too
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

    // ← PERSIST to your local store so Improve can list it
    const saved = upsert({
      id: a.id, // keep the OpenAI id so you can use it later
      ownerId,
      name: a.name ?? name,
      model: a.model ?? model,
      temperature:
        typeof temperature === 'number'
          ? temperature
          : parseFloat(a?.metadata?.temperature ?? '0.5') || 0.5,
      system: String(instructions ?? ''), // store instructions into system for Improve editor
    });

    return res.status(200).json({ ok: true, data: saved }); // ← matches Improve’s expected shape
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'create failed' });
  }
}
