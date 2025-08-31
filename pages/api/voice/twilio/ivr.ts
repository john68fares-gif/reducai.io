import type { NextApiRequest, NextApiResponse } from 'next';
const xml = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
const esc = (s='') => s.replace(/[<>&]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'} as any)[m]);
const baseUrl = (req: NextApiRequest) => {
  const proto = (req.headers['x-forwarded-proto'] as string) || (req.headers['x-forwarded-protocol'] as string) || 'https';
  const host  = (req.headers['x-forwarded-host'] as string) || (req.headers['host'] as string) || '';
  return `${proto}://${host}`.replace(/\/+$/,'');
};
const say = (voice:string, lang:string, text:string) => `<Say voice="${esc(voice)}" language="${esc(lang)}">${esc(text)}</Say>`;

type Session = { path?: 'new'|'reschedule'|'cancel'|'frontdesk'; name?: string; dob?: string; when?: string };
const SESSIONS = new Map<string, Session>();

export default function ivr(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).send('Method Not Allowed'); }

    const base = baseUrl(req);
    const q = req.query || {};
    const lang  = (q.lang  || 'en-US').toString();
    const voice = (q.voice || 'Polly.Joanna').toString();
    const brand = (q.brand || '').toString();
    const step  = (q.step || 'detect').toString();

    const callSid = (req.body?.CallSid || '').toString();
    if (!callSid) return res.status(200).setHeader('Content-Type','text/xml').send(xml(say('alice','en-US','Goodbye.') + '<Hangup/>'));

    const s = SESSIONS.get(callSid) || {};
    SESSIONS.set(callSid, s);

    // utility to keep absolute URL
    const urlFor = (next: string) => {
      const u = new URL('/api/voice/twilio/ivr', base);
      u.searchParams.set('step', next);
      [['lang',lang],['voice',voice],['brand',brand]].forEach(([k,v]) => v && u.searchParams.set(k as string, v as string));
      return u.toString();
    };

    if (step === 'detect') {
      const speech = (req.body?.SpeechResult || '').toString().toLowerCase();

      let choice: Session['path'] | undefined;
      if (/\b(new|book|schedule|first appointment)\b/.test(speech)) choice = 'new';
      else if (/re.?schedule|move|change\b/.test(speech)) choice = 'reschedule';
      else if (/cancel|call off|drop\b/.test(speech)) choice = 'cancel';
      else if (/front.*desk|operator|reception|human|agent/.test(speech)) choice = 'frontdesk';

      if (!choice) {
        const prompt = brand
          ? `I can help with new appointments, rescheduling, cancellations, or reaching the front desk at ${brand}. What would you like to do?`
          : `I can help with new appointments, rescheduling, cancellations, or reaching the front desk. What would you like to do?`;
        const tw =
          `<Gather input="speech" language="${esc(lang)}" timeout="7" speechTimeout="auto"
                   action="${esc(urlFor('detect'))}" method="POST">
             ${say(voice, lang, prompt)}
           </Gather>
           <Redirect method="POST">${esc(urlFor('detect'))}</Redirect>`;
        return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
      }

      s.path = choice;
      if (choice === 'frontdesk') {
        return res.status(200).setHeader('Content-Type','text/xml')
          .send(xml(say(voice,lang,'Please hold while we notify the front desk.') + '<Pause length="1"/><Hangup/>'));
      }

      const ask = 'Great. Please say your full name after the tone.';
      const tw =
        `<Gather input="speech" language="${esc(lang)}" timeout="6" speechTimeout="auto"
                 action="${esc(urlFor('name'))}" method="POST">
           ${say(voice, lang, ask)}
         </Gather>
         <Redirect method="POST">${esc(urlFor('name'))}</Redirect>`;
      return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
    }

    if (step === 'name') {
      const spoken = (req.body?.SpeechResult || '').toString().trim();
      if (spoken) s.name = spoken;

      if (!s.name) {
        const reprompt = 'Sorry, I did not catch that. Please say your full name.';
        const tw =
          `<Gather input="speech" language="${esc(lang)}" timeout="6" speechTimeout="auto"
                   action="${esc(urlFor('name'))}" method="POST">
             ${say(voice, lang, reprompt)}
           </Gather>
           <Redirect method="POST">${esc(urlFor('name'))}</Redirect>`;
        return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
      }

      const askDob = 'Thanks. Please enter your date of birth using the keypad, in eight digits. For example: May twenty second nineteen ninety is 05221990.';
      const tw =
        `<Gather input="dtmf" numDigits="8" timeout="7"
                 action="${esc(urlFor('dob'))}" method="POST">
           ${say(voice, lang, askDob)}
         </Gather>
         <Redirect method="POST">${esc(urlFor('dob'))}</Redirect>`;
      return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
    }

    if (step === 'dob') {
      const entered = (req.body?.Digits || '').toString().trim();
      if (/^\d{8}$/.test(entered)) s.dob = entered;

      if (!s.dob) {
        const reprompt = 'Apologies, that did not look like eight digits. Please try again.';
        const tw =
          `<Gather input="dtmf" numDigits="8" timeout="7"
                   action="${esc(urlFor('dob'))}" method="POST">
             ${say(voice, lang, reprompt)}
           </Gather>
           <Redirect method="POST">${esc(urlFor('dob'))}</Redirect>`;
        return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
      }

      const askWhen = 'Please briefly say your preferred date and time, for example: next Tuesday afternoon, or October twelfth at 10 A.M.';
      const tw =
        `<Gather input="speech" language="${esc(lang)}" timeout="7" speechTimeout="auto"
                 action="${esc(urlFor('when'))}" method="POST">
           ${say(voice, lang, askWhen)}
         </Gather>
         <Redirect method="POST">${esc(urlFor('when'))}</Redirect>`;
      return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
    }

    if (step === 'when') {
      const spoken = (req.body?.SpeechResult || '').toString().trim();
      if (spoken) s.when = spoken;

      if (!s.when) {
        const reprompt = 'Sorry, I did not catch that. Please say a preferred date and time.';
        const tw =
          `<Gather input="speech" language="${esc(lang)}" timeout="7" speechTimeout="auto"
                   action="${esc(urlFor('when'))}" method="POST">
             ${say(voice, lang, reprompt)}
           </Gather>
           <Redirect method="POST">${esc(urlFor('when'))}</Redirect>`;
        return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
      }

      const brandLine = brand ? ` Thank you for calling ${brand}.` : '';
      const summary = `Thank you. I have your ${s.path} request for ${s.name}, date of birth ${s.dob}, preferred time "${s.when}". Our team will confirm shortly.${brandLine}`;
      SESSIONS.delete(callSid);

      return res.status(200).setHeader('Content-Type','text/xml')
        .send(xml(say(voice, lang, summary) + '<Pause length="1"/><Hangup/>'));
    }

    // default: bounce back to detect
    return res.status(200).setHeader('Content-Type','text/xml')
      .send(xml(say(voice, lang, 'Let’s try that again.') + `<Redirect method="POST">${esc(urlFor('detect'))}</Redirect>`));
  } catch {
    return res.status(200).setHeader('Content-Type','text/xml')
      .send(xml(`<Say voice="alice">Sorry, an error occurred.</Say><Hangup/>`));
  }
}
