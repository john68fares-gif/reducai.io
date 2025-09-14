// pages/api/chatbots/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing on server' });

  const id = String(req.query.id || '');
  if (!id.startsWith('asst_')) return res.status(400).json({ error: 'invalid assistant id' });

  try {
    if (req.method === 'GET') {
      const userId = String(req.query.userId || '').trim();
      if (!userId) return res.status(400).json({ error: 'userId required' });

      const a = await fetchAsst(id);
      if (!a) return res.status(404).json({ error: 'Not found' });

      // enforce per-account ownership
      if (a?.metadata?.ownerId !== userId || a?.metadata?.app !== 'reducai') {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.status(200).json({
        ok: true,
        data: {
          id: a.id,
          name: a.name || 'Untitled Agent',
          createdAt: a?.created_at ? Number(a.created_at) * 1000 : Date.now(),
          model: a?.model || 'gpt-4o-mini',
          temperature: parseTemp(a?.metadata?.temperature, 0.5),
          instructions: a?.instructions || '',
        },
      });
    }

    if (req.method === 'PATCH') {
      const { userId, name, instructions, model, temperature } = req.body || {};
      if (!userId) return res.status(400).json({ error: 'userId required' });

      const a = await fetchAsst(id);
      if (!a) return res.status(404).json({ error: 'Not found' });
      if (a?.metadata?.ownerId !== userId || a?.metadata?.app !== 'reducai') {
        return res.status(404).json({ error: 'Not found' });
      }

      const payload: any = {
        name: typeof name === 'string' ? name : a.name,
        model: typeof model === 'string' ? model : a.model,
        instructions: typeof instructions === 'string' ? instructions : a.instructions,
        metadata: {
          ...(a.metadata || {}),
          app: 'reducai',
          ownerId: a?.metadata?.ownerId || String(userId),
          temperature: String(
            Number.isFinite(temperature) ? Number(temperature) : parseTemp(a?.metadata?.temperature, 0.5)
          ),
        },
      };

      const r = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify(payload),
      });
      if (!r.ok) return res.status(r.status).json({ error: await safeText(r) });
      const updated = await r.json();

      return res.status(200).json({
        ok: true,
        data: {
          id: updated.id,
          name: updated.name || 'Untitled Agent',
          createdAt: updated?.created_at ? Number(updated.created_at) * 1000 : Date.now(),
          model: updated?.model || a.model,
          temperature: parseTemp(updated?.metadata?.temperature, 0.5),
          instructions: updated?.instructions || '',
        },
      });
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
}

async function fetchAsst(id: string) {
  const r = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2',
    },
    cache: 'no-store',
  });
  if (!r.ok) return null;
  return await r.json();
}

function parseTemp(v: unknown, dflt: number) {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? (n as number) : dflt;
}
async function safeText(r: Response) {
  try { return await r.text(); } catch { return `Upstream ${r.status}`; }
}
