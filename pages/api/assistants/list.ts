// pages/api/assistants/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Lists assistants straight from OpenAI using fetch (no 'openai' SDK needed).
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
    const { apiKeyPlain, limit = 25 } = (req.body || {}) as {
      apiKeyPlain?: string;
      limit?: number;
    };

    const key = (apiKeyPlain || process.env.OPENAI_API_KEY || '').trim();
    if (!key) {
      return res.status(400).json({ ok: false, error: 'Missing API key (apiKeyPlain or OPENAI_API_KEY).' });
    }

    // Clamp limit 1..100 (OpenAI accepts up to 100)
    const capped = Math.max(1, Math.min(100, Number(limit) || 25));

    // Call OpenAI Assistants list endpoint
    const url = `https://api.openai.com/v1/assistants?limit=${encodeURIComponent(String(capped))}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // No special beta header needed for v1 Assistants list
      },
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(resp.status).json({
        ok: false,
        error: (json && (json.error?.message || json.error)) || 'Failed to list assistants',
      });
    }

    const items = Array.isArray(json?.data) ? json.data : [];

    // Normalize what the dashboard expects
    const normalized = items.map((a: any) => {
      const createdAt =
        typeof a?.created_at === 'number' ? new Date(a.created_at * 1000).toISOString() : null;
      const updatedAt =
        typeof a?.updated_at === 'number' ? new Date(a.updated_at * 1000).toISOString() : createdAt;

      return {
        id: String(a?.id || ''),
        name: a?.name || 'Untitled Assistant',
        model: String(a?.model || ''),
        instructions: a?.instructions || '',
        created_at: createdAt,
        updated_at: updatedAt,
        metadata: a?.metadata || {},
      };
    });

    return res.status(200).json({ ok: true, items: normalized });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'Failed to list assistants' });
  }
}
