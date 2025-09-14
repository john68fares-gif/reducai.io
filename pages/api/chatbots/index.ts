// pages/api/chatbots/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

type Mini = {
  id: string;
  name: string;
  createdAt: number;
  model: string;
  temperature: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ownerId =
    (req.headers['x-owner-id'] as string) ||
    (req.query.ownerId as string) ||
    '';

  if (!ownerId) return res.status(400).json({ error: 'ownerId required' });

  // If you don't have a key in Preview locally, just return empty list
  if (!OPENAI_API_KEY) return res.status(200).json([]);

  try {
    const all: any[] = [];
    let after: string | undefined;
    // Assistants API doesn't let us filter by metadata on the server,
    // so we page and filter client-side.
    for (let i = 0; i < 6; i++) {
      const url = new URL('https://api.openai.com/v1/assistants');
      url.searchParams.set('limit', '100');
      if (after) url.searchParams.set('after', after);

      const r = await fetch(url.toString(), {
        method: 'GET',
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
      if (data?.has_more && data?.last_id) {
        after = data.last_id;
      } else {
        break;
      }
    }

    // Only show assistants that belong to this account
    const mine = all.filter(a => {
      const meta = (a?.metadata ?? {}) as Record<string, any>;
      return String(meta.ownerId || '') === String(ownerId);
    });

    const out: Mini[] = mine
      .map(a => ({
        id: String(a.id),
        name: String(a.name || 'Untitled Agent'),
        createdAt: a?.created_at ? Number(a.created_at) * 1000 : Date.now(),
        model: String(a.model || 'gpt-4o-mini'),
        temperature: parseTemp((a?.metadata ?? {}).temperature, 0.5),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    return res.status(200).json(out);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed to list assistants' });
  }
}

function parseTemp(v: unknown, dflt: number) {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? (n as number) : dflt;
}
