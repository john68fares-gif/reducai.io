// pages/api/chatbots/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * GET /api/chatbots
 * Requires: header x-user-id: <string>
 * Returns only assistants where metadata.ownerId === x-user-id
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = String(req.headers['x-user-id'] || '').trim();
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id' });

  if (!OPENAI_API_KEY) return res.status(200).json([]); // no key, empty list so UI doesn't explode

  try {
    const all: any[] = [];
    let after: string | undefined;
    let guard = 0;

    while (guard++ < 5) {
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
      if (data?.has_more && data?.last_id) after = data.last_id;
      else break;
    }

    // Filter to logged-in user only (ownerId)
    const list = all
      .filter((a) => a?.id && a?.id.startsWith?.('asst_'))
      .filter((a) => (a?.metadata?.ownerId || '') === userId)
      .map((a) => ({
        id: a.id as string,
        name: (a.name as string) || 'Untitled Agent',
        createdAt: a.created_at ? Number(a.created_at) * 1000 : Date.now(),
        model: (a.model as string) || 'gpt-4o-mini',
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
