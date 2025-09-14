// pages/api/chatbots/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OA = 'https://api.openai.com/v1';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!OPENAI_API_KEY) {
    // Still return something so the UI doesn't die in previews
    if (req.method === 'GET') return res.status(200).json([]);
    return res.status(200).json({ ok: true, claimed: 0 });
  }

  try {
    if (req.method === 'GET') {
      // ownerId comes from client (supabase user id)
      const ownerId = String(req.query.ownerId || '').trim();
      if (!ownerId) return res.status(400).json({ error: 'ownerId required' });

      const all = await listAllAssistants();
      const mine = all
        .filter(a => a?.metadata?.ownerUserId === ownerId)
        .map(mapAssistant);

      return res.status(200).json(mine);
    }

    if (req.method === 'POST') {
      // Sync: claim assistants that have no ownerUserId yet
      const { ownerId } = (req.body || {}) as { ownerId?: string };
      if (!ownerId) return res.status(400).json({ error: 'ownerId required' });

      const all = await listAllAssistants();
      let claimed = 0;

      for (const a of all) {
        const hasOwner = !!a?.metadata?.ownerUserId;
        if (!hasOwner) {
          await fetch(`${OA}/assistants/${a.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              'OpenAI-Beta': 'assistants=v2',
            },
            body: JSON.stringify({
              metadata: { ...(a.metadata || {}), ownerUserId: ownerId },
            }),
          });
          claimed++;
        }
      }

      return res.status(200).json({ ok: true, claimed });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
}

function mapAssistant(a: any) {
  return {
    id: a.id,
    name: a.name || 'Untitled Agent',
    createdAt: (a.created_at ? Number(a.created_at) * 1000 : Date.now()),
    model: a.model || 'gpt-4o-mini',
    temperature: safeTemp(a?.metadata?.temperature, 0.5),
  };
}

function safeTemp(v: unknown, dflt: number) {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? (n as number) : dflt;
}

async function listAllAssistants(): Promise<any[]> {
  const out: any[] = [];
  let after: string | undefined;
  let guard = 0;

  while (guard++ < 8) {
    const url = new URL(`${OA}/assistants`);
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
    if (!r.ok) break;
    const data = await r.json();
    const items: any[] = Array.isArray(data?.data) ? data.data : [];
    out.push(...items);
    if (data?.has_more && data?.last_id) { after = data.last_id; } else break;
  }
  return out;
}
