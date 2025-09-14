import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!OPENAI_API_KEY) return res.status(200).json([]); // no key => empty list, UI still works

    const r = await fetch('https://api.openai.com/v1/assistants?limit=100', {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      cache: 'no-store',
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(r.status).json({ error: text || `Upstream ${r.status}` });
    }

    const data = await r.json();
    const items: any[] = Array.isArray(data?.data) ? data.data : [];

    const list = items.map((a) => ({
      id: a?.id, // asst_…
      name: a?.name || 'Untitled Agent',
      createdAt: a?.created_at ? a.created_at * 1000 : Date.now(),
      model: a?.model || 'gpt-4o-mini',
      temperature: parseMetaNumber(a?.metadata?.temperature, 0.5),
    }));

    list.sort((a, b) => b.createdAt - a.createdAt);
    return res.status(200).json(list);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed to list assistants' });
  }
}

function parseMetaNumber(v: any, dflt: number) {
  const n = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : NaN);
  return Number.isFinite(n) ? n : dflt;
}
