// pages/api/voice/inbound.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { twiml } from 'twilio';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Must only handle POSTs from Twilio
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const agentId = (req.query.agentId as string) || '';
    if (!agentId) {
      return res.status(400).send('Missing agentId');
    }

    const VoiceResponse = twiml.VoiceResponse;
    const vr = new VoiceResponse();

    // Basic connect — you can replace this with streaming to your AI service
    vr.say({ voice: 'alice', language: 'en-US' }, `Hello. You have reached the AI agent for ${agentId}.`);

    // Example: record caller message
    vr.record({
      transcribe: true,
      maxLength: 60,
      playBeep: true,
    });

    vr.hangup();

    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(vr.toString());
  } catch (e: any) {
    res.status(500).send(e?.message || 'Inbound error');
  }
}
