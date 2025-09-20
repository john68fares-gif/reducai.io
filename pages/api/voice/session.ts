// pages/api/voice/session.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js'; // if you store keys in supabase

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { agentId } = req.body;
  // look up agent → get apiKey for OpenAI
  // for now: use a server-stored OPENAI_API_KEY
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No server API key' });

  // ask OpenAI for ephemeral session
  const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-realtime-preview',
      voice: 'alloy', // map agent.voiceName here
      instructions: agentId ? `Use agent ${agentId}` : undefined,
    }),
  });
  const j = await r.json();
  return res.status(200).json(j);
}
