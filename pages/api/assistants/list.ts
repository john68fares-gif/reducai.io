// pages/api/assistants/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

/**
 * Lists assistants from OpenAI so the Dashboard can sync them into storage.
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
    const { apiKeyPlain, limit = 25 } = (req.body || {}) as { apiKeyPlain?: string; limit?: number };
    const key = (apiKeyPlain || process.env.OPENAI_API_KEY || '').trim();

    if (!key) {
      return res.status(400).json({ ok: false, error: 'Missing API key (apiKeyPlain or OPENAI_API_KEY).' });
    }

    const client = new OpenAI({ apiKey: key });

    // Fetch assistants (most recently updated first)
    const assistants = await client.beta.assistants.list({ limit: Math.max(1, Math.min(100, limit)) });

    // Normalize minimal shape for the dashboard
    const items = (assistants?.data || []).map((a) => ({
      id: a.id,
      name: a.name || 'Untitled Assistant',
      model: (a.model as string) || '',
      instructions: (a as any).instructions || '',
      created_at: a.created_at ? new Date(a.created_at * 1000).toISOString() : null,
      updated_at: a.updated_at ? new Date(a.updated_at * 1000).toISOString() : null,
      metadata: a.metadata || {},
    }));

    return res.status(200).json({ ok: true, items });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Failed to list assistants' });
  }
}
