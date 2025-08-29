// pages/api/voice/agents.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Ok<T> = { ok: true; [key: string]: any } & { data?: T };
type Err   = { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok<{ agentId: string }> | Err>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    // Body from the VoiceAgentSection "createAgent" call
    const {
      agentId: requestedAgentId,
      fromNumber,
      voice,
      language,
      prompt,
    } = req.body || {};

    // Basic validations so users must fill real info on the site
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
      return res.status(400).json({ ok: false, error: 'Prompt is required and should be at least 10 characters.' });
    }
    if (language && typeof language !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid language.' });
    }
    if (voice && typeof voice !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid voice.' });
    }
    if (fromNumber && !/^\+[1-9]\d{1,14}$/.test(fromNumber)) {
      return res.status(400).json({ ok: false, error: 'From number must be E.164 (e.g. +15551234567).' });
    }

    // In a real app you would create the agent with your provider here.
    // For now we "mock" creation and hand back an agentId that your UI can use.
    const id =
      (requestedAgentId && String(requestedAgentId)) ||
      `agent_${Math.random().toString(36).slice(2, 10)}`;

    // Return shape the UI expects
    return res.status(200).json({
      ok: true,
      agentId: id,
      data: { agentId: id },
      meta: {
        created: true,
        provider: 'mock',
        language: language || 'en-US',
        voice: voice || 'default',
        fromNumber: fromNumber || null,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
