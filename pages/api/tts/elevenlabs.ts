// pages/api/tts/elevenlabs.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { text, voiceId, apiKey } = req.body as { text: string; voiceId: string; apiKey?: string };

  const key = apiKey || process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(400).json({ error: "Missing ElevenLabs API key" });
  if (!text || !voiceId) return res.status(400).json({ error: "Missing text or voiceId" });

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      voice_settings: { stability: 0.4, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true },
    }),
  });

  if (!r.ok) {
    const msg = await r.text();
    return res.status(r.status).json({ error: `ElevenLabs error: ${msg}` });
  }

  const buf = Buffer.from(await r.arrayBuffer());
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(buf);
}
