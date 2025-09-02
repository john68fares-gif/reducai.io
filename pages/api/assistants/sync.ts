// pages/api/assistants/sync.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Ok = { ok: true; assistantId: string };
type Err = { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST' });

  const key = (req.headers['x-api-key'] as string || '').trim();
  if (!/^sk-/.test(key)) return res.status(401).json({ ok: false, error: 'Missing or invalid OpenAI key' });

  try {
    const {
      assistantId,         // optional: pass to update instead of create
      name,                // bot name
      model,               // "gpt-4o", "gpt-4.1", "gpt-4o-mini", etc.
      instructions,        // your compiled prompt
      description,         // optional
      metadata,            // optional { buildId, ... }
      tools,               // optional e.g. [{ type: 'code_interpreter' }]
    } = (req.body || {}) as Record<string, any>;

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    };

    const payload = {
      name: name || 'Assistant',
      model: model || 'gpt-4o-mini',
      instructions: instructions || 'You are a concise website assistant.',
      description: description || undefined,
      metadata: metadata || undefined,
      tools: Array.isArray(tools) ? tools : undefined,
    };

    const base = 'https://api.openai.com/v1/assistants';

    // Update if we have an id, else create
    const url = assistantId ? `${base}/${assistantId}` : base;
    const method = assistantId ? 'PATCH' : 'POST';

    const r = await fetch(url, { method, headers, body: JSON.stringify(payload) });
    const j = await r.json();

    if (!r.ok || !j?.id) {
      return res.status(502).json({ ok: false, error: j?.error?.message || 'OpenAI Assistants API error' });
    }

    return res.status(200).json({ ok: true, assistantId: j.id });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
