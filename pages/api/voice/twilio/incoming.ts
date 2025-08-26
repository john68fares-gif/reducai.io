// pages/api/voice/twilio/incoming.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getStore } from '../../../../lib/store'; // <-- exactly four ../

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const store = getStore();
  const voice = store.settings.ttsVoice || 'Polly.Joanna';
  const agentId = (req.query.agentId as string) || 'agent_default';

  const greeting =
    (store.settings.systemPrompt || '').slice(0, 160) ||
    `Hello! Your voice agent "${agentId}" is connected and ready.`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${greeting}</Say>
  <Pause length="60"/>
</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml);
}
