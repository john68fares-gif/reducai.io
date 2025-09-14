// pages/api/chatbots/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

type MinimalAsst = {
  id: string;
  name: string;
  createdAt: number;
  model: string;
  temperature: number; // stored in metadata as string
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing on server' });

  try {
    if (req.method === 'GET') {
      // Only list assistants for THIS account
      const userId = String(req.query.userId || '').trim();
      if (!userId) return res.status(400).json({ error: 'userId required' });

      const all: any[] = [];
      let after: string | undefined;
      let guard = 0;

      while (guard++ < 6) {
        const url = new URL('https://api.openai.com/v1/assistants');
        url.searchParams.set('limit', '100');
        if (after) url.searchParams.set('after', after);

        const r = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2',
          },
          cache: 'no-store',
        });
        if (!r.ok) return res.status(r.status).json({ error: await safeText(r) });

        const data = await r.json();
        const items: any[] = Array.isArray(data?.data) ? data.data : [];
        all.push(...items);
        if (data?.has_more && data?.last_id) after = data.last_id;
        else break;
      }

      const list: MinimalAsst[] = all
        .filter(a => a?.id?.startsWith?.('asst_'))
        // strict per-account filter via metadata
        .filter(a => a?.metadata?.ownerId === userId && a?.metadata?.app === 'reducai')
        .map(a => ({
          id: a.id,
          name: a.name || 'Untitled Agent',
          createdAt: a?.created_at ? Number(a.created_at) * 1000 : Date.now(),
          model: a?.model || 'gpt-4o-mini',
          temperature: parseTemp(a?.metadata?.temperature, 0.5),
        }))
        .sort((a, b) => b.createdAt - a.createdAt);

      return res.status(200).json({ ok: true, data: list });
    }

    if (req.method === 'POST') {
      // Builder "Generate" – create assistant tied to this account
      const {
        userId,
        name = 'Untitled Agent',
        instructions = '',
        model = 'gpt-4o-mini',
        temperature = 0.5,
      } = req.body || {};

      if (!userId) return res.status(400).json({ error: 'userId required' });

      const payload = {
        name,
        model,
        instructions,
        // put ownership + app tag + temperature in metadata
        metadata: {
          app: 'reducai',
          ownerId: String(userId),
          temperature: String(Number.isFinite(temperature) ? temperature : 0.5),
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
      if (!r.ok) return res.status(r.status).json({ error: await safeText(r) });
      const a = await r.json();

      const out: MinimalAsst = {
        id: a.id,
        name: a.name || 'Untitled Agent',
        createdAt: a?.created_at ? Number(a.created_at) * 1000 : Date.now(),
        model: a?.model || model,
        temperature: parseTemp(a?.metadata?.temperature, 0.5),
      };

      return res.status(200).json({ ok: true, data: out });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
}

function parseTemp(v: unknown, dflt: number) {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? (n as number) : dflt;
}
async function safeText(r: Response) {
  try { return await r.text(); } catch { return `Upstream ${r.status}`; }
}
