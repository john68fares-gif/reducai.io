import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Lists assistants from OpenAI (Assistants v2) using fetch.
 * Priority for API key:
 *  1) req.body.apiKeyPlain
 *  2) process.env.OPENAI_API_KEY
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { apiKeyPlain, limit = 50 } = (req.body || {}) as {
      apiKeyPlain?: string;
      limit?: number;
    };

    const key = (apiKeyPlain || process.env.OPENAI_API_KEY || '').trim();
    if (!key) {
      return res.status(400).json({ ok: false, error: 'Missing API key (apiKeyPlain or OPENAI_API_KEY).' });
    }

    const capped = Math.max(1, Math.min(100, Number(limit) || 50));
    const url = `https://api.openai.com/v1/assistants?limit=${encodeURIComponent(String(capped))}`;

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // 👇 Required for Assistants v2
        'OpenAI-Beta': 'assistants=v2',
      },
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res
        .status(resp.status)
        .json({ ok: false, error: json?.error?.message || 'Failed to list assistants' });
    }

    const items = Array.isArray(json?.data) ? json.data : [];

    const normalized = items.map((a: any) => {
      const created =
        typeof a?.created_at === 'number' ? new Date(a.created_at * 1000).toISOString() : null;
      const updated =
        typeof a?.updated_at === 'number' ? new Date(a.updated_at * 1000).toISOString() : created;

      return {
        id: String(a?.id || ''),
        name: a?.name || 'Untitled Assistant',
        model: String(a?.model || ''),
        instructions: a?.instructions || '',
        created_at: created,
        updated_at: updated,
        metadata: a?.metadata || {},
      };
    });

    return res.status(200).json({ ok: true, items: normalized });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'Failed to list assistants' });
  }
}
