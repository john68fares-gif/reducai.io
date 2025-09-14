// pages/api/chatbots/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { listByOwner, upsert, type ChatBot } from '@/lib/chatbots-store';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  res.setHeader('Cache-Control', 'no-store');
  const ownerId = getOwnerId(req);

  if (req.method === 'GET') {
    // Used by Tuning/Improve to show your bots
    const items = listByOwner(ownerId);
    return res.status(200).json({ ok: true, data: items });
  }

  if (req.method === 'POST') {
    // Allow Builder Step 4 to create/update without calling OpenAI
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
