import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Ephemeral token minting for OpenAI Realtime.
 * Accepts key in header `X-OpenAI-Key`, body.apiKey, or OPENAI_API_KEY env.
 * We do not log or persist any keys.
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
      apiKey: apiKeyFromBody,
    } = (req.body || {}) as {
      model?: string;
      systemPrompt?: string;
      voiceName?: string;
      assistantName?: string;
      apiKey?: string;
    };

    // Resolve API key: header -> body -> env
    const headerKey = String(req.headers['x-openai-key'] || '').trim();
    const bodyKey   = String(apiKeyFromBody || '').trim();
    const envKey    = String(process.env.OPENAI_API_KEY || '').trim();
    const apiKey    = headerKey || bodyKey || envKey;

    if (!apiKey) {
      return res.status(400).json({
        error:
          'Missing OpenAI API key. Provide it via header "X-OpenAI-Key", body.apiKey, or set OPENAI_API_KEY on the server.',
      });
    }

    // ✅ NEW: be permissive—OpenAI uses multiple key prefixes now (sk-, sk-proj-, sk-live-, etc.)
    // Just a minimal sanity check to avoid obvious junk; let OpenAI do the real validation.
    if (!apiKey.startsWith('sk-') || apiKey.length < 24) {
      return res.status(400).json({ error: 'Invalid OpenAI API key format.' });
    }

    // Prepare session creation
    const resolvedModel =
      model && model.toLowerCase().includes('realtime') ? model : 'gpt-4o-realtime-preview';

    // Map voice label -> OpenAI voice id
    const v = String(voiceName || '').toLowerCase();
    const voice =
      v.includes('alloy') ? 'alloy' :
      v.includes('verse') ? 'verse' :
      v.includes('coral') ? 'coral' :
      v.includes('amber') ? 'amber' :
      'alloy';

    // Create ephemeral session
    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // ✅ IMPORTANT for sessions API
        'OpenAI-Beta': 'realtime=v1',
      },
      body: JSON.stringify({
        model: resolvedModel,
        voice,
        instructions: systemPrompt || '',
        name: assistantName || '',
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: `OpenAI session failed: ${t}` });
    }

    const session = await r.json();
    // returns: { id, client_secret: { value, expires_at }, ... }
    return res.status(200).json(session);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
