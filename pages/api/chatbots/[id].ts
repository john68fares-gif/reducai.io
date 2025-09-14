// pages/api/chatbots/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

/**
 * GET  /api/chatbots/[id]?ownerId=USER_ID   → Fetch one assistant (verifies ownership)
 * POST /api/chatbots/[id]  body: { ownerId, model?, temperature?, name?, instructions? }
 *      → Safely updates assistant by merging metadata (keeps ownerId).
 *
 * Note: OpenAI Assistants v2 uses POST to /assistants/{id} for updates.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ error: 'id required' });

  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing' });

  try {
    if (req.method === 'GET') {
      const ownerId = String(req.query.ownerId || '');
      const current = await getAssistant(id);
      if (!current.ok) return res.status(current.status).json({ error: current.error });

      if (ownerId && current.assistant?.metadata?.ownerId !== ownerId) {
        return res.status(403).json({ error: 'Forbidden (not your assistant)' });
      }

      const a = current.assistant!;
      return res.status(200).json({
        id: a.id,
        name: a.name || 'Untitled Agent',
        model: a.model || 'gpt-4o-mini',
        createdAt: a.created_at ? Number(a.created_at) * 1000 : Date.now(),
        temperature: parseTemp(a?.metadata?.temperature, 0.5),
        ownerId: a?.metadata?.ownerId || null,
      });
    }

    if (req.method === 'POST') {
      const { ownerId, model, temperature, name, instructions } = req.body || {};
      if (!ownerId) return res.status(400).json({ error: 'ownerId required' });

      // Read first to check owner + merge metadata
      const current = await getAssistant(id);
      if (!current.ok) return res.status(current.status).json({ error: current.error });

      const a = current.assistant!;
      if (a?.metadata?.ownerId !== ownerId) {
        return res.status(403).json({ error: 'Forbidden (not your assistant)' });
      }

      const nextMeta = {
        ...(a?.metadata || {}),
        ...(typeof temperature === 'number' ? { temperature: String(temperature) } : {}),
        ownerId: String(ownerId),
      };

      const payload: any = {
        ...(name ? { name: String(name) } : {}),
        ...(model ? { model: String(model) } : {}),
        ...(instructions ? { instructions: String(instructions) } : {}),
        metadata: nextMeta,
      };

      const r = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
        method: 'POST',
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

      const updated = await r.json();
      return res.status(200).json({
        ok: true,
        assistant: {
          id: updated.id,
          name: updated.name || 'Untitled Agent',
          model: updated.model || 'gpt-4o-mini',
          createdAt: updated.created_at ? Number(updated.created_at) * 1000 : Date.now(),
          temperature: parseTemp(updated?.metadata?.temperature, 0.5),
        },
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
}

function parseTemp(v: unknown, dflt: number) {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? (n as number) : dflt;
}

async function getAssistant(id: string): Promise<{ ok: boolean; status: number; assistant?: any; error?: string }> {
  const r = await fetch(`https://api.openai.com/v1/assistants/${id}`, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2',
    },
    cache: 'no-store',
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    return { ok: false, status: r.status, error: text || `Upstream ${r.status}` };
  }
  const assistant = await r.json();
  return { ok: true, status: 200, assistant };
}
