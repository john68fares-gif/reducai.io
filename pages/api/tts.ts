// pages/api/tts.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // BYO-KEY: must be provided in header
    const xiKey = (req.headers['x-elevenlabs-key'] || '').toString().trim();
    if (!xiKey) return res.status(401).json({ error: 'Missing x-elevenlabs-key header' });

    const { text, voiceId } = (req.body || {}) as { text?: string; voiceId?: string };
    if (!text || !voiceId) return res.status(400).json({ error: 'Missing text or voiceId' });

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': xiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        // Pick the best-sounding model for naturalness:
        model_id: 'eleven_multilingual_v2',
        text,
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.82,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
    });

    if (!r.ok) {
      const err = await r.text().catch(() => '');
      return res.status(r.status).json({ error: `ElevenLabs error ${r.status}: ${err}` });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(buf);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}
