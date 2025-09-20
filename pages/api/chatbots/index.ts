import type { NextApiRequest, NextApiResponse } from 'next';
import { listByOwner, upsert, type ChatBot } from '@/lib/chatbots-store';

type Json = Record<string, any>;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

function getOwnerId(req: NextApiRequest): string {
  const h = (req.headers['x-owner-id'] || req.headers['x-user-id'] || '') as string;
  if (h && h.trim()) return h.trim();
  if (typeof req.query.ownerId === 'string' && req.query.ownerId.trim()) return req.query.ownerId.trim();
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)ra_uid=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  return 'anon';
}

/**
 * Hydrate local store from OpenAI for *this* owner only.
 * STRICT: Only assistants with metadata.ownerId === ownerId are imported.
 * Ownerless assistants are ignored (use a migration tool to tag them).
 */
async function hydrateFromOpenAI(ownerId: string) {
  if (!OPENAI_API_KEY) return; // skip hydration without a key

  let url: string | null = 'https://api.openai.com/v1/assistants?limit=100';

  for (let guard = 0; guard < 12 && url; guard++) {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
      },
      cache: 'no-store',
    });
    if (!r.ok) break;

    const j = await r.json().catch(() => null);
    const list = Array.isArray(j?.data) ? j.data : [];

    for (const a of list) {
      const metaOwner = (a?.metadata?.ownerId ?? '').toString();
      if (!metaOwner || metaOwner !== ownerId) continue; // STRICT filter

      const temperature = Number.parseFloat(a?.metadata?.temperature ?? '') || 0.5;

      upsert({
        id: a.id,
        ownerId: metaOwner, // never adopt with a fallback
        name: a.name || 'Untitled Agent',
        model: a.model || 'gpt-4o',
        temperature,
        system: String(a.instructions ?? ''), // Improve editor uses "system"
      } as ChatBot);
    }

    url =
      j?.has_more && j?.last_id
        ? `https://api.openai.com/v1/assistants?limit=100&after=${encodeURIComponent(j.last_id)}`
        : null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  res.setHeader('Cache-Control', 'no-store');
  const ownerId = getOwnerId(req);

  if (req.method === 'GET') {
    // (1) Pull fresh from OpenAI for this owner (strict filter)
    await hydrateFromOpenAI(ownerId);

    // (2) Return local list
    const items = listByOwner(ownerId);
    return res.status(200).json({ ok: true, data: items });
  }

  if (req.method === 'POST') {
    // Allow Builder to upsert directly into local store (no OpenAI call here)
    const {
      id,
      name,
      model = 'gpt-4o-mini',
      temperature = 0.5,
      system = '',
    } = (req.body || {}) as Partial<ChatBot>;

    if (!name && !id) {
      return res.status(400).json({ error: 'Missing "name" or existing "id".' });
    }

    const saved = upsert({
      id: id || '',
      ownerId,
      name: name || 'Untitled Agent',
      model,
      temperature: Number(temperature) || 0.5,
      system: system || '',
    });

    if (saved.ownerId !== ownerId) {
      return res.status(500).json({ error: 'Owner mismatch after save.' });
    }
    return res.status(200).json({ ok: true, data: saved });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
