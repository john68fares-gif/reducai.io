import type { NextApiRequest, NextApiResponse } from 'next';
import { listByOwner, upsert, ChatBot } from '@/lib/chatbots-store';

function getOwnerId(req: NextApiRequest): string {
  const h = (req.headers['x-owner-id'] || req.headers['x-user-id'] || '') as string;
  if (h) return h;
  if (typeof req.query.ownerId === 'string') return req.query.ownerId;
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/ra_uid=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  return 'anon';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ownerId = getOwnerId(req);

  if (req.method === 'GET') {
    const bots = listByOwner(ownerId)
      .map(b => ({
        id: b.id,
        name: b.name || 'Untitled Agent',
        createdAt: b.createdAt,
        model: b.model,
        temperature: b.temperature,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
    return res.status(200).json(bots);
  }

  if (req.method === 'POST') {
    const { id, name, model = 'gpt-4o-mini', temperature = 0.5, system = '' } = (req.body || {}) as Partial<ChatBot>;
    if (!name && !id) return res.status(400).json({ error: 'Missing "name" or existing "id".' });

    const saved = upsert({
      id: id || '',
      ownerId,
      name: name || 'Untitled Agent',
      model,
      temperature: Number(temperature) || 0.5,
      system,
    });

    return res.status(200).json({ ok: true, data: saved });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
