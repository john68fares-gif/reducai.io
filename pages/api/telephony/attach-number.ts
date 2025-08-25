import type { NextApiRequest, NextApiResponse } from 'next';

// Uses dynamic import so the build never chokes on 'twilio'
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { agentId = 'agent_default', phoneNumber } =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!phoneNumber) throw new Error('phoneNumber is required');

    const SID = process.env.TWILIO_ACCOUNT_SID;
    const TOKEN = process.env.TWILIO_AUTH_TOKEN;
    if (!SID || !TOKEN) throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');

    const twilioModule: any = await import('twilio');
    const client = twilioModule.default(SID, TOKEN);

    // Stable domain for Twilio: prefer APP_URL if set, otherwise use current host
    const host = process.env.APP_URL || `https://${req.headers.host}`;
    const voiceUrl = `${host}/api/voice/twilio/incoming`;

    // Look up the number in your Twilio account and point it to the webhook
    const [num] = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
    if (!num) throw new Error('Phone number not found in your Twilio account');
    await client.incomingPhoneNumbers(num.sid).update({ voiceUrl, voiceMethod: 'POST' });

    return res.status(200).json({ ok: true, phoneNumber, agentId, voiceUrl });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'failed' });
  }
}
