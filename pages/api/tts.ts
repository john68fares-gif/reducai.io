// pages/api/tts.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const { voiceId, text } = req.body || {};
    const headerKey = (req.headers['x-11labs-key'] as string) || '';
    const envKey = process.env.ELEVENLABS_API_KEY || '';
    const apiKey = headerKey || envKey;

    if (!apiKey) return res.status(500).send('Missing ElevenLabs API key');

    const id = voiceId || 'Rachel';
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      }),
    });

    if (!r.ok) {
      const msg = await r.text();
      return res.status(r.status).send(`TTS error: ${msg}`);
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('cache-control', 'no-store');
    return res.status(200).send(buf);
  } catch (e: any) {
    return res.status(500).send(`TTS exception: ${e?.message || e}`);
  }
}
