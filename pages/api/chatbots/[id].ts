// pages/api/chatbots/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'id required' });

  const ownerId =
    (req.headers['x-owner-id'] as string) ||
    (req.query.ownerId as string) ||
    (req.body?.ownerId as string) ||
    '';

  if (!ownerId) return res.status(400).json({ error: 'ownerId required' });

  if (!OPENAI_API_KEY) {
    // In environments without a key, just noop so the UI doesn’t break
    if (req.method === 'GET') return res.status(200).json(null);
    if (req.method === 'PATCH') return res.status(204).end();
    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    // Always fetch the latest assistant so we can check metadata.ownerId and merge metadata.
    const current = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      cache: 'no-store',
    });

    if (!current.ok) {
      const t = await current.text().catch(() => '');
      return res.status(current.status).json({ error: t || `Upstream ${current.status}` });
    }

    const asst = await current.json();
    const existingMeta = (asst?.metadata ?? {}) as Record<string, any>;
    const existingOwner = existingMeta.ownerId ? String(existingMeta.ownerId) : '';

    // Enforce ownership:
    // - If assistant already has an owner and it's NOT this user → forbid.
    // - If it has no owner, we'll stamp the current user on PATCH.
    if (req.method === 'GET') {
      if (existingOwner && existingOwner !== String(ownerId)) {
        return res.status(404).json({ error: 'Not found' }); // hide existence from other users
      }

      // Return a compact summary
      return res.status(200).json({
        id: asst.id,
        name: asst.name || 'Untitled Agent',
        model: asst.model || 'gpt-4o-mini',
        createdAt: asst?.created_at ? Number(asst.created_at) * 1000 : Date.now(),
        temperature: parseTemp(existingMeta.temperature, 0.5),
      });
    }

    if (req.method === 'PATCH') {
      const { model, temperature } = (req.body || {}) as {
        model?: string;
        temperature?: number;
      };

      if (existingOwner && existingOwner !== String(ownerId)) {
        return res.status(403).json({ error: 'Forbidden (different owner)' });
      }

      // Merge metadata, stamp ownerId, and keep any other metadata keys
      const nextMeta: Record<string, any> = { ...existingMeta, ownerId: String(ownerId) };
      if (typeof temperature === 'number') {
        nextMeta.temperature = String(temperature);
      }

      const payload: Record<string, any> = { metadata: nextMeta };
      if (typeof model === 'string' && model.trim()) payload.model = model.trim();

      const r = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
        method: 'POST', // update
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const text = await r.text().catch(() => '');
        return res.status(r.status).json({ error: text || `Upstream ${r.status}` });
      }

      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).end('Method Not Allowed');
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
}

function parseTemp(v: unknown, dflt: number) {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? (n as number) : dflt;
}
