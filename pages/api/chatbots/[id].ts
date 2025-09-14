// /pages/api/chatbots/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getById, updateById, removeById } from '@/lib/chatbots-store';

type Json = Record<string, any>;

function getOwnerId(req: NextApiRequest): string {
  // Prefer explicit header, then query, then cookie fallback, else 'anon'
  const h = (req.headers['x-owner-id'] || req.headers['x-user-id'] || '') as string;
  if (h) return h.trim();

  if (typeof req.query.ownerId === 'string' && req.query.ownerId.trim()) {
    return req.query.ownerId.trim();
  }

  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)ra_uid=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);

  return 'anon';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  res.setHeader('Cache-Control', 'no-store');

  const id = (req.query.id as string) || '';
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const ownerId = getOwnerId(req);

  // Fetch once so we can enforce ownership for all methods.
  const existing = getById(id);

  if (!existing) {
    // 404 for all methods to avoid leaking existence.
    if (['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method || '')) {
      return res.status(404).json({ error: 'Not found' });
    }
  } else if (existing.ownerId !== ownerId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, data: existing });
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const body = (req.body || {}) as Partial<{
      name: string;
      model: string;
      temperature: number;
      system: string;
    }>;

    const { name, model, temperature, system } = body;

    const updated = updateById(id, {
      // Never allow id/ownerId changes via API
      ...(name !== undefined ? { name } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(temperature !== undefined ? { temperature: Number(temperature) } : {}),
      ...(system !== undefined ? { system } : {}),
    });

    if (!updated) return res.status(404).json({ error: 'Not found' });
    if (updated.ownerId !== ownerId) return res.status(403).json({ error: 'Forbidden' });

    return res.status(200).json({ ok: true, data: updated });
  }

  if (req.method === 'DELETE') {
    const ok = removeById(id); // we already validated ownership
    return res.status(ok ? 200 : 404).json({ ok });
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}
