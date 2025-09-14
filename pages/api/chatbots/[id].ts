// pages/api/chatbots/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'Missing id' });

  if (!OPENAI_API_KEY) {
    // no key → return a minimal mock so UI doesn’t crash
    if (req.method === 'GET') {
      return res.status(200).json({
        id, name: 'Assistant', createdAt: Date.now(),
        model: 'gpt-4o-mini', instructions: '', temperature: 0.5,
      });
    }
    if (req.method === 'PATCH') return res.status(200).json({ ok: true, id });
  }

  try {
    if (req.method === 'GET') {
      const r = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        cache: 'no-store',
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        return res.status(r.status).json({ error: text || `Upstream ${r.status}` });
      }
      const a = await r.json();

      return res.status(200).json({
        id: a?.id,
        name: a?.name || 'Assistant',
        createdAt: a?.created_at ? a.created_at * 1000 : Date.now(),
        model: a?.model || 'gpt-4o-mini',
        instructions: a?.instructions || '',
        temperature: parseTemp(a?.metadata?.temperature, 0.5),
      });
    }

    if (req.method === 'PATCH') {
      const { model, temperature, prompt } = (req.body || {}) as {
        model?: string; temperature?: number; prompt?: string;
      };

      // fetch current to merge metadata
      const cur = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        cache: 'no-store',
      });
      if (!cur.ok) {
        const text = await cur.text().catch(() => '');
        return res.status(cur.status).json({ error: text || `Upstream ${cur.status}` });
      }
      const a = await cur.json();

      const payload: any = {};
      if (typeof model === 'string' && model.trim()) payload.model = model.trim();
      if (typeof prompt === 'string') payload.instructions = prompt;
      const meta = { ...(a?.metadata || {}) };
      if (typeof temperature === 'number') meta.temperature = String(temperature);
      payload.metadata = meta;

      const r = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
        method: 'POST', // assistants v2 update via POST to resource path
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
      const a2 = await r.json();

      return res.status(200).json({
        id: a2?.id,
        name: a2?.name || 'Assistant',
        createdAt: a2?.created_at ? a2.created_at * 1000 : Date.now(),
        model: a2?.model || 'gpt-4o-mini',
        instructions: a2?.instructions || '',
        temperature: parseTemp(a2?.metadata?.temperature, 0.5),
      });
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
}

function parseTemp(v: any, dflt: number) {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : dflt;
}
