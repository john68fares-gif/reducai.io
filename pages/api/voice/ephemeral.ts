// pages/api/voice/ephemeral.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { model, voiceName, systemPrompt } = req.body || {};
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

  try {
    // Create a short-lived Realtime session for the browser
    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-realtime-preview',
        // Ask the model to speak; the name must be one of OpenAI’s realtime voices
        voice: (voiceName || 'alloy').toLowerCase().split(' ')[0], // "Alloy (American)" -> "alloy"
        modalities: ['audio'], // we want audio out
        instructions: systemPrompt || 'You are a helpful assistant.',
        // Optional: turn on server VAD if you like
        // turn_detection: { type: 'server_vad' }
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: text });
    }
    const j = await r.json();
    // The client needs the client_secret.value (ephemeral token)
    return res.status(200).json({ token: j?.client_secret?.value });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to create session' });
  }
}
