// pages/api/voice/ephemeral.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Ephemeral token minting for OpenAI Realtime.
 *
 * ❗ How keys are handled:
 *   - Preferred: client sends the selected user key in the header `X-OpenAI-Key`.
 *   - Alternative: client sends `apiKey` in the JSON body.
 *   - Fallback: use server env `OPENAI_API_KEY` (optional).
 *
 * We never log or persist any provided key.
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
      assistantName,
    } = (req.body || {}) as {
      model?: string;
      systemPrompt?: string;
      voiceName?: string;
      assistantName?: string;
      apiKey?: string; // optional if sent in body
    };

    // 1) Resolve API key: header -> body -> env
    const headerKey = (req.headers['x-openai-key'] || '') as string;
    const bodyKey = (req.body?.apiKey || '') as string;
    const serverKey = process.env.OPENAI_API_KEY || '';

    const apiKey = headerKey || bodyKey || serverKey;

    if (!apiKey) {
      return res.status(400).json({
        error:
          'Missing OpenAI API key. Send it via header "X-OpenAI-Key", body.apiKey, or set OPENAI_API_KEY on the server.',
      });
    }
    if (!/^sk-[A-Za-z0-9]{20,}$/.test(apiKey)) {
      // basic sanity check; avoids logging
      return res.status(400).json({ error: 'Invalid OpenAI API key format.' });
    }

    // 2) Create a short-lived session (ephemeral) with OpenAI
    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Use your UI selections; provide sensible defaults
        model: model || 'gpt-4o-realtime-preview',
        voice: (voiceName || 'Alloy (American)').toLowerCase().includes('alloy') ? 'alloy' : 'verse',
        instructions: systemPrompt || '',
        name: assistantName || '',
        // You can add more realtime session options here if needed
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: `OpenAI session failed: ${t}` });
    }
    const sessionJson = await r.json();

    // 3) Return ephemeral session details to the browser
    // OpenAI returns { id, client_secret: { value, expires_at }, ... }
    return res.status(200).json(sessionJson);
  } catch (err: any) {
    // Do not log secrets; just a generic error
    return res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
