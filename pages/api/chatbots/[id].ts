// pages/api/chatbots/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * GET  /api/chatbots/[id]   -> returns assistant meta (only if owned by user)
 * PATCH /api/chatbots/[id]  -> update model/temperature/prompt; "claim" if no owner yet
 *
 * Requires: header x-user-id: <string>
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || '').trim();
  if (!id || !id.startsWith('asst_')) return res.status(400).json({ error: 'Bad id' });

  const userId = String(req.headers['x-user-id'] || '').trim();
  if (!userId) return res.status(401).json({ error: 'Missing x-user-id' });

  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing' });

  try {
    // Always fetch the assistant first so we can check ownership
    const existing = await getAssistant(id);
    if (!existing) return res.status(404).json({ error: 'Assistant not found' });

    const owner = String(existing?.metadata?.ownerId || '');

    if (req.method === 'GET') {
      if (owner !== userId) return res.status(404).json({ error: 'Chatbot not found for this user/assistantId' });
      return res.status(200).json({
        id: existing.id,
        name: existing.name || 'Untitled Agent',
        model: existing.model || 'gpt-4o-mini',
        temperature: parseTemp(existing?.metadata?.temperature, 0.5),
        createdAt: existing.created_at ? Number(existing.created_at) * 1000 : Date.now(),
      });
    }

    if (req.method === 'PATCH') {
      const { model, temperature, prompt } = (req.body || {}) as {
        model?: string;
        temperature?: number;
        prompt?: string;
      };

      // Claim-on-first-update: if no ownerId set yet, assign it now.
      let nextMeta = { ...(existing.metadata || {}) };
      if (!owner) {
        nextMeta.ownerId = userId;
      } else if (owner !== userId) {
        return res.status(403).json({ error: 'This assistant belongs to a different user' });
      }

      if (typeof temperature === 'number') {
        nextMeta.temperature = String(temperature);
      }

      const payload: any = {
        model: model || existing.model || 'gpt-4o-mini',
        metadata: nextMeta,
      };
      if (typeof prompt === 'string') payload.instructions = prompt;

      const r = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
        method: 'POST', // v2 uses POST for update
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const text = await r.text().catch(() => '');
        return res.status(r.status).json({ error: text || `Upstream ${r.status}` });
      }
      const a2 = await r.json();

      return res.status(200).json({
        id: a2.id,
        name: a2.name || 'Untitled Agent',
        model: a2.model || 'gpt-4o-mini',
        temperature: parseTemp(a2?.metadata?.temperature, 0.5),
        createdAt: a2.created_at ? Number(a2.created_at) * 1000 : Date.now(),
      });
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
}

async function getAssistant(id: string) {
  const r = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2',
    },
    cache: 'no-store',
  });
  if (!r.ok) return null;
  return await r.json();
}

function parseTemp(v: unknown, dflt: number) {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? (n as number) : dflt;
}
