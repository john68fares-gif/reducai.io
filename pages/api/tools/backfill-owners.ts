// pages/api/tools/backfill-owners.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

/**
 * POST /api/tools/backfill-owners
 * Body: { ownerId: string, ids?: string[] }
 * For each assistant (or only given ids), set metadata.ownerId if missing.
 * Protect or delete after use!
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing' });

  try {
    const { ownerId, ids } = req.body || {};
    if (!ownerId) return res.status(400).json({ error: 'ownerId required' });

    const targets = Array.isArray(ids) && ids.length ? ids : await listAllIds();

    const results: any[] = [];
    for (const id of targets) {
      const current = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
      });
      if (!current.ok) continue;
      const a = await current.json();
      if (a?.metadata?.ownerId) continue; // already tagged

      const r = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({ metadata: { ...(a?.metadata || {}), ownerId: String(ownerId) } }),
      });
      results.push({ id, ok: r.ok });
    }

    return res.status(200).json({ ok: true, results });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'backfill failed' });
  }
}

async function listAllIds(): Promise<string[]> {
  const ids: string[] = [];
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
    });
    if (!r.ok) break;
    const data = await r.json();
    for (const a of data?.data ?? []) ids.push(a.id);
    if (data?.has_more && data?.last_id) after = data.last_id; else break;
  }
  return ids;
}
