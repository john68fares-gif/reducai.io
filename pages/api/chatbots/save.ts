// pages/api/chatbots/save.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { upsert, type ChatBot, getById } from '@/lib/chatbots-store';

type Json = Record<string, any>;

function getOwnerId(req: NextApiRequest): string {
  const h = (req.headers['x-owner-id'] || req.headers['x-user-id'] || '') as string;
  if (h) return h;
  if (typeof req.query.ownerId === 'string') return req.query.ownerId;
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)ra_uid=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  return 'anon';
}

/**
 * Builder posts here when you click "Generate" / "Save".
 * This ONLY persists to the local store (no OpenAI calls).
 * Returns { ok, data } with the saved bot.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ownerId = getOwnerId(req);

  const {
    id,
    name,
    model = 'gpt-4o-mini',
    temperature = 0.5,
    system = '', // compiled personality/rules
  } = (req.body || {}) as Partial<ChatBot>;

  if (!name && !id) {
    return res.status(400).json({ error: 'Missing "name" or existing "id".' });
  }

  // If an id is provided, ensure caller owns it before updating.
  if (id) {
    const existing = getById(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.ownerId !== ownerId) return res.status(403).json({ error: 'Forbidden' });
  }

  const saved = upsert({
    id: id || '', // allow store to generate if empty
    ownerId,
    name: name || 'Untitled Agent',
    model,
    temperature: Number(temperature) || 0.5,
    system: system || '',
  });

  // Safety: never leak cross-tenant data
  if (saved.ownerId !== ownerId) {
    return res.status(500).json({ error: 'Owner mismatch after save.' });
  }

  return res.status(200).json({ ok: true, data: saved });
}
