// pages/api/tts.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, voiceId }:{ text?:string; voiceId?:string } = req.body || {};
    if (!text || !voiceId) return res.status(400).json({ error: 'Missing text or voiceId' });
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) return res.status(500).json({ error: 'Missing ELEVENLABS_API_KEY' });

    // v1 TTS (returns mp3 by default)
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        // model: 'eleven_multilingual_v2',  // uncomment if you want to force this model
        text: String(text),
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

    // Stream audio back to the browser
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    const buf = Buffer.from(await r.arrayBuffer());
    res.status(200).send(buf);
  } catch (e:any) {
    res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}
