// pages/api/voice/ephemeral.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Ephemeral token minting for OpenAI Realtime.
 * Accepts API key via header X-OpenAI-Key, body.apiKey, or OPENAI_API_KEY env.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      model,
      systemPrompt,
      voiceName,
      // assistantName,   // ❌ DO NOT forward this, Realtime sessions don’t support it
      apiKey: apiKeyInBody,
    } = (req.body || {}) as {
      model?: string;
      systemPrompt?: string;
      voiceName?: string;
      assistantName?: string; // ignored
      apiKey?: string;
    };

    // Resolve API key: header -> body -> env
    const headerKey = (req.headers['x-openai-key'] || '') as string;
    const serverKey = process.env.OPENAI_API_KEY || '';
    const apiKey = headerKey || apiKeyInBody || serverKey;

    if (!apiKey) {
      return res.status(400).json({
        error:
          'Missing OpenAI API key. Send it via header "X-OpenAI-Key", body.apiKey, or set OPENAI_API_KEY on the server.',
      });
    }
    // 🔧 Don’t over-validate format; OpenAI issues several key prefixes (sk-, sk-proj-, sk-live-…)
    if (typeof apiKey !== 'string' || apiKey.length < 20) {
      return res.status(400).json({ error: 'Invalid OpenAI API key.' });
    }

    // Build voice value supported by Realtime (alloy/verse etc.)
    const voice =
      (voiceName || '').toLowerCase().includes('verse') ? 'verse' : 'alloy';

    // Create the short-lived Realtime session
    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-realtime-preview',
        voice,
        // ✅ supported:
        instructions: systemPrompt || '',
        // ❌ NOT supported by this endpoint:
        // name: assistantName,
      }),
    });

    const text = await r.text();
    if (!r.ok) {
      // Pass through OpenAI’s error so the UI shows the real reason
      return res.status(r.status).json({ error: `OpenAI session failed: ${text}` });
    }

    const sessionJson = JSON.parse(text);
    return res.status(200).json(sessionJson);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
