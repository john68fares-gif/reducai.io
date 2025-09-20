import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertAgent, getAgentByPhoneNumberId, Agent } from '@/lib/store';

/**
 * Minimal owner scoping:
 * - Reads owner from header/query/cookie and requires it to match payload.ownerId on POST.
 * - Does not expose the raw OpenAI key in responses.
 */

function getOwnerId(req: NextApiRequest): string {
  const h = (req.headers['x-owner-id'] || req.headers['x-user-id'] || '') as string;
  if (h && h.trim()) return h.trim();
  if (typeof req.query.ownerId === 'string' && req.query.ownerId.trim()) return req.query.ownerId.trim();
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)ra_uid=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  return 'anon';
}

// NOTE: Add real auth here. Right now this does a basic owner check only.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const callerOwnerId = getOwnerId(req);

    const {
      id,
      ownerId,
      phoneNumberId,
      prompt,
      model = 'gpt-4o-mini',
      openaiApiKey,
      enabled = true,
    } = req.body || {};

    if (!id || !ownerId || !phoneNumberId || !prompt || !openaiApiKey) {
      res.status(400).json({ ok: false, error: 'Missing required fields.' });
      return;
    }

    if (ownerId !== callerOwnerId) {
      res.status(403).json({ ok: false, error: 'Forbidden: owner mismatch.' });
      return;
    }

    const saved = await upsertAgent({
      id,
      ownerId,
      phoneNumberId,
      prompt,
      model,
      openaiApiKey,
      enabled,
    });

    // never return the key
    res.status(200).json({ ok: true, data: { ...saved, openaiApiKey: '***' } });
    return;
  }

  if (req.method === 'GET') {
    const phoneNumberId = (req.query.phoneNumberId as string) || '';
    if (!phoneNumberId) {
      res.status(400).json({ ok: false, error: 'phoneNumberId required' });
      return;
    }

    const agent = await getAgentByPhoneNumberId(phoneNumberId);
    if (!agent) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }

    const masked: Agent & { openaiApiKey: string } = { ...agent, openaiApiKey: '***' };
    res.status(200).json({ ok: true, data: masked });
    return;
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end('Method Not Allowed');
}
