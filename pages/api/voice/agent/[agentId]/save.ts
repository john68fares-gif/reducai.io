// pages/api/voice/agent/[agentId]/save.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type AgentData = {
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  firstMode: string;
  firstMsg: string;
  systemPrompt: string;
  language?: string;
  ttsProvider: 'openai' | 'elevenlabs';
  voiceName: string;
  apiKeyId?: string;
  asrProvider: 'deepgram' | 'whisper' | 'assemblyai';
  asrModel: string;
  denoise: boolean;
  numerals: boolean;
};

const memStore = (global as any).__VA_MEM__ || new Map<string, AgentData>();
(global as any).__VA_MEM__ = memStore;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const { agentId } = req.query;
  if (!agentId || typeof agentId !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing agentId' });
  }

  const payload = req.body as AgentData | undefined;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
  }
  if (!payload.name || !payload.systemPrompt) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  // Log for verification
  console.log('[SAVE]', agentId, {
    name: payload.name,
    model: payload.model,
    voiceName: payload.voiceName,
    systemPromptSample: payload.systemPrompt.slice(0, 120) + '…',
  });

  // Store in-memory for now
  memStore.set(agentId, payload);

  return res.status(200).json({
    ok: true,
    agentId,
    savedAt: Date.now(),
  });
}
