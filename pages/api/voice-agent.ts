// pages/api/voice-agent.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Settings = {
  systemPrompt: string;
  ttsVoice: string;
  language: string;
  fromE164: string;
  assistantId?: string;
  publicKey?: string;
};

let cachedSettings: Partial<Settings> = {};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, ...cachedSettings });
  }

  if (req.method === 'PUT') {
    try {
      const body = req.body || {};
      cachedSettings = { ...cachedSettings, ...body };
      return res.status(200).json({ ok: true, data: cachedSettings });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || 'Failed to save' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
