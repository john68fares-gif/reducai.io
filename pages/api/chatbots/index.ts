// pages/api/chatbots/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

/**
 * GET /api/chatbots?ownerId=USER_ID
 * Returns assistants that have metadata.ownerId === ownerId
 * [{ id, name, createdAt, model, temperature }]
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ownerId = String(req.query.ownerId || '').trim();
    if (!ownerId) return res.status(200).json([]); // no user yet → empty

    if (!OPENAI_API_KEY) {
      return res.status(200).json([]); // No key configured → empty list (keeps UI clean)
    }

    const all: any[] = [];
    let after: string | undefined;
    let pages = 0;

    while (pages++ < 10) {
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

      if (!r.ok) {
        const text = await r.text().catch(() => '');
        return res.status(r.status).json({ error: text || `Upstream ${r.status}` });
      }

      const data = await r.json();
      const items: any[] = Array.isArray(data?.data) ? data.data : [];
      all.push(...items);
      if (data?.has_more && data?.last_id) after = data.last_id; else break;
    }

    const list = all
      .filter(a => String(a?.metadata?.ownerId || '') === ownerId)
      .map(a => ({
        id: a.id,
        name: a.name || 'Untitled Agent',
        createdAt: a?.created_at ? Number(a.created_at) * 1000 : Date.now(),
        model: a?.model || 'gpt-4o-mini',
        temperature: parseTemp(a?.metadata?.temperature, 0.5),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    return res.status(200).json(list);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed to list assistants' });
  }
}

function parseTemp(v: unknown, dflt: number) {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? (n as number) : dflt;
}
