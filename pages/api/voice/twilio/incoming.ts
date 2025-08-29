// pages/api/voice/twilio/incoming.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Twilio hits this URL when your number receives a call.
 * We return valid TwiML so Twilio won't say "An application error has occurred".
 *
 * If you want something fancier later (streaming, handoff to a real agent, etc.)
 * you can replace the <Say/> + <Pause/> below with your own TwiML.
 */

// Twilio can POST x-www-form-urlencoded; we don't need the body here.
// Disabling Next's body parser avoids 415/500 surprises for non-JSON bodies.
export const config = { api: { bodyParser: false } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Optional customizations via query string
    const voice = String((req.query.voice ?? 'alice') || 'alice');
    const greeting =
      String(req.query.greeting ?? 'Your Reduc A I voice agent is online. This is a test answer. Stay on the line.');

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${xml(voice)}">${xml(greeting)}</Say>
  <!-- Keep the call up for a minute so you can hear something instead of an error -->
  <Pause length="60"/>
</Response>`.trim();

    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(twiml);
  } catch (err) {
    // Even on error, reply with TwiML so Twilio doesn't play an error prompt
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, an internal error occurred. Please try again later.</Say>
</Response>`.trim();
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(fallback);
  }
}

function xml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' } as const)[c]!
  );
}
