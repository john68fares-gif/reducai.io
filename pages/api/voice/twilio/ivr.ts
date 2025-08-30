// pages/api/voice/twilio/ivr.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const xmlWrap = (inner: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
const esc = (s = '') => s.replace(/[<>&]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'} as any)[m]);

type Session = { path?: 'new'|'reschedule'|'cancel'|'frontdesk'; name?: string; dob?: string; when?: string };
const SESSIONS = new Map<string, Session>();

function say(voice:string, lang:string, text:string) {
  return `<Say voice="${esc(voice)}" language="${esc(lang)}">${esc(text)}</Say>`;
}

export default function ivr(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow','POST');
      return res.status(405).send('Method Not Allowed');
    }

    const q = req.query || {};
    const lang  = (q.lang  || 'en-US').toString();
    const voice = (q.voice || 'Polly.Joanna').toString();
    const rate  = Number(q.rate ?? 100);  // passed through but not used in this minimal flow
    const pitch = Number(q.pitch ?? 0);   // passed through but not used in this minimal flow
    const step  = (q.step || 'menu').toString();

    const callSid = (req.body?.CallSid || '').toString();
    const digits  = (req.body?.Digits || '').toString();
    const speech  = (req.body?.SpeechResult || '').toString().toLowerCase();

    if (!callSid) {
      return res.status(200).setHeader('Content-Type','text/xml')
        .send(xmlWrap(say('alice','en-US','We could not identify this call. Goodbye.') + '<Hangup/>'));
    }

    const s = SESSIONS.get(callSid) || {};
    SESSIONS.set(callSid, s);

    const keep = new URLSearchParams({ lang, voice, rate: String(rate), pitch: String(pitch) }).toString();

    // ----- MENU -----
    if (step === 'menu') {
      let choice: Session['path'] | undefined;
      if (digits === '1' || /(^|\b)new|\bbook|\bschedule/.test(speech)) choice = 'new';
      else if (digits === '2' || /re.?schedule/.test(speech)) choice = 'reschedule';
      else if (digits === '3' || /cancel/.test(speech)) choice = 'cancel';
      else if (digits === '0' || /front.*desk|operator/.test(speech)) choice = 'frontdesk';

      if (!choice) {
        const prompt = 'I did not get that. For a new appointment press 1, to reschedule press 2, to cancel press 3, to reach the front desk press 0.';
        const tw =
          `<Gather input="speech dtmf" language="${esc(lang)}" timeout="6" speechTimeout="auto"
                   action="/api/voice/twilio/ivr?step=menu&${esc(keep)}" method="POST">
             ${say(voice, lang, prompt)}
           </Gather>
           <Redirect method="POST">/api/voice/twilio/ivr?step=menu&${esc(keep)}</Redirect>`;
        return res.status(200).setHeader('Content-Type','text/xml').send(xmlWrap(tw));
      }

      s.path = choice;

      if (choice === 'frontdesk') {
        // Swap +15551230000 for your real desk number if desired
        // return res.status(200).setHeader('Content-Type','text/xml')
        //  .send(xmlWrap(say(voice,lang,'Connecting you to the front desk.') + `<Dial>${esc('+15551230000')}</Dial>`));
        return res.status(200).setHeader('Content-Type','text/xml')
          .send(xmlWrap(say(voice,lang,'Please hold while we notify the front desk.') + '<Pause length="1"/><Hangup/>'));
      }

      // Ask name
      const ask = 'Great. Please say your full name after the tone.';
      const tw =
        `<Gather input="speech" language="${esc(lang)}" timeout="6" speechTimeout="auto"
                 action="/api/voice/twilio/ivr?step=name&${esc(keep)}" method="POST">
           ${say(voice, lang, ask)}
         </Gather>
         <Redirect method="POST">/api/voice/twilio/ivr?step=name&${esc(keep)}</Redirect>`;
      return res.status(200).setHeader('Content-Type','text/xml').send(xmlWrap(tw));
    }

    // ----- NAME -----
    if (step === 'name') {
      const spoken = (req.body?.SpeechResult || '').toString().trim();
      if (spoken) s.name = spoken;

      if (!s.name) {
        const reprompt = 'Sorry, I did not catch that. Please say your full name.';
        const tw =
          `<Gather input="speech" language="${esc(lang)}" timeout="6" speechTimeout="auto"
                   action="/api/voice/twilio/ivr?step=name&${esc(keep)}" method="POST">
             ${say(voice, lang, reprompt)}
           </Gather>
           <Redirect method="POST">/api/voice/twilio/ivr?step=name&${esc(keep)}</Redirect>`;
        return res.status(200).setHeader('Content-Type','text/xml').send(xmlWrap(tw));
      }

      const askDob = 'Thanks. Please enter your date of birth using the keypad, in eight digits. For example, May twenty second nineteen ninety is 05221990.';
      const tw =
        `<Gather input="dtmf" numDigits="8" timeout="7"
                 action="/api/voice/twilio/ivr?step=dob&${esc(keep)}" method="POST">
           ${say(voice, lang, askDob)}
         </Gather>
         <Redirect method="POST">/api/voice/twilio/ivr?step=dob&${esc(keep)}</Redirect>`;
      return res.status(200).setHeader('Content-Type','text/xml').send(xmlWrap(tw));
    }

    // ----- DOB -----
    if (step === 'dob') {
      const entered = (req.body?.Digits || '').toString().trim();
      if (/^\d{8}$/.test(entered)) s.dob = entered;

      if (!s.dob) {
        const reprompt = 'Apologies, that did not look like eight digits. Please try again.';
        const tw =
          `<Gather input="dtmf" numDigits="8" timeout="7"
                   action="/api/voice/twilio/ivr?step=dob&${esc(keep)}" method="POST">
             ${say(voice, lang, reprompt)}
           </Gather>
           <Redirect method="POST">/api/voice/twilio/ivr?step=dob&${esc(keep)}</Redirect>`;
        return res.status(200).setHeader('Content-Type','text/xml').send(xmlWrap(tw));
      }

      const askWhen = 'Please briefly say your preferred date and time. For example: next Tuesday afternoon, or October twelfth at ten A M.';
      const tw =
        `<Gather input="speech" language="${esc(lang)}" timeout="6" speechTimeout="auto"
                 action="/api/voice/twilio/ivr?step=when&${esc(keep)}" method="POST">
           ${say(voice, lang, askWhen)}
         </Gather>
         <Redirect method="POST">/api/voice/twilio/ivr?step=when&${esc(keep)}</Redirect>`;
      return res.status(200).setHeader('Content-Type','text/xml').send(xmlWrap(tw));
    }

    // ----- WHEN -----
    if (step === 'when') {
      const spoken = (req.body?.SpeechResult || '').toString().trim();
      if (spoken) s.when = spoken;

      if (!s.when) {
        const reprompt = 'Sorry, I did not catch that. Please say a preferred date and time.';
        const tw =
          `<Gather input="speech" language="${esc(lang)}" timeout="6" speechTimeout="auto"
                   action="/api/voice/twilio/ivr?step=when&${esc(keep)}" method="POST">
             ${say(voice, lang, reprompt)}
           </Gather>
           <Redirect method="POST">/api/voice/twilio/ivr?step=when&${esc(keep)}</Redirect>`;
        return res.status(200).setHeader('Content-Type','text/xml').send(xmlWrap(tw));
      }

      const summary = `Thank you. I have your ${s.path} request for ${s.name}, date of birth ${s.dob}, preferred time "${s.when}". Our team will confirm shortly.`;
      SESSIONS.delete(callSid);

      return res.status(200).setHeader('Content-Type','text/xml')
        .send(xmlWrap(say(voice, lang, summary) + '<Pause length="1"/><Hangup/>'));
    }

    // Fallback
    return res.status(200).setHeader('Content-Type','text/xml')
      .send(xmlWrap(say(voice, lang, 'Returning to the main menu.') +
                    `<Redirect method="POST">/api/voice/twilio/ivr?step=menu&${esc(keep)}</Redirect>`));

  } catch {
    return res.status(200).setHeader('Content-Type','text/xml')
      .send(xmlWrap(`<Say voice="alice">Sorry, an error occurred.</Say><Hangup/>`));
  }
}
