import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    // READ
    if (req.method === 'GET') {
      if (!OPENAI_API_KEY) return res.status(404).json({ error: 'Not found' });

      const r = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',   // <-- add here
        },
        cache: 'no-store',
      });
      if (!r.ok) return res.status(r.status).json({ error: await r.text().catch(() => '') });

      const a = await r.json();
      return res.status(200).json({
        id: a.id,
        name: a.name || 'Untitled Agent',
        model: a.model || 'gpt-4o-mini',
        createdAt: a?.created_at ? a.created_at * 1000 : Date.now(),
        instructions: a.instructions || '',
        temperature: parseMetaNumber(a?.metadata?.temperature, 0.5),
      });
    }

    // UPDATE
    if (req.method === 'PATCH') {
      if (!OPENAI_API_KEY) return res.status(400).json({ error: 'OPENAI_API_KEY not set' });

      const { name, model, prompt, temperature } = req.body || {};

      const payload: any = {};
      if (typeof name === 'string') payload.name = name;
      if (typeof model === 'string') payload.model = model;
      if (typeof prompt === 'string') payload.instructions = prompt;
      if (typeof temperature === 'number') {
        payload.metadata = { ...(payload.metadata || {}), temperature: String(temperature) };
      }

      // <-- THIS is the exact call you asked about (Assistants update is POST to the resource)
      const r = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',   // <-- add here
        },
        body: JSON.stringify(payload),
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
        createdAt: a?.created_at ? a.created_at * 1000 : Date.now(),
        instructions: a.instructions || '',
        temperature: parseMetaNumber(a?.metadata?.temperature, 0.5),
      });
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
}

function parseMetaNumber(v: any, dflt: number) {
  const n = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : NaN);
  return Number.isFinite(n) ? n : dflt;
}
