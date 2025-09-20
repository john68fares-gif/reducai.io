// pages/api/voice/ephemeral.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * REQUIREMENTS:
 *  - Env var OPENAI_API_KEY = your real server key
 *  - The client calls this to mint a short-lived "ephemeral" token that can be
 *    used directly in the browser for Realtime voice calls.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { model, systemPrompt, voiceName, assistantName } = req.body || {};

    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-realtime-preview',
        voice: voiceName || 'alloy',
        // You can pass system prompt and assistant name as session defaults:
        instructions: systemPrompt || '',
        name: assistantName || '',
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: `Failed: ${t}` });
    }
    const j = await r.json();

    // Typically returns: { id, client_secret: { value, expires_at }, ... }
    return res.status(200).json(j);
  } catch (err: any) {
    console.error('ephemeral error', err);
    return res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
