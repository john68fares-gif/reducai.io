// pages/api/voice/twilio/ivr.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const xml = (inner: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
const esc = (s = '') => s.replace(/[<>&]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'} as any)[m]);

type Session = {
  path?: 'new'|'reschedule'|'cancel'|'frontdesk';
  name?: string;
  dob?: string;            // MMDDYYYY digits
  when?: string;           // free text, we'll confirm
};
const SESSIONS = new Map<string, Session>(); // CallSid -> Session

function say(voice:string, lang:string, ssml:string) {
  return `<Say voice="${esc(voice)}" language="${esc(lang)}">${ssml}</Say>`;
}

function ssml(text:string, style:string, rate:number, pitch:number, delayMs=0) {
  const domain = style === 'newscaster' ? 'news'
               : (style === 'conversational' ? 'conversational'
               : (style === 'professional' ? '' : (style || '')));
  const open = domain ? `<amazon:domain name="${domain}">` : '';
  const close = domain ? `</amazon:domain>` : '';
  const breakTag = delayMs ? `<break time="${delayMs}ms"/>` : '';
  const pitchStr = (pitch >= 0 ? `+${pitch}` : `${pitch}`) + 'st';
  return `${breakTag}<prosody rate="${rate}%" pitch="${pitchStr}">${esc(text)}</prosody>${close}`;
}

function nextUrl(step:string, q:Record<string,string>) {
  const qs = new URLSearchParams(q).toString();
  return `/api/voice/twilio/ivr?step=${encodeURIComponent(step)}&${qs}`;
}

export default function ivr(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow','POST');
      return res.status(405).send('Method Not Allowed');
    }

    // voice config
    const q = req.query || {};
    const lang  = (q.lang  || 'en-US').toString();
    const voice = (q.voice || 'Polly.Joanna').toString();
    const style = (q.style || '').toString();
    const rate  = Math.max(60, Math.min(140, Number(q.rate ?? 100)));
    const pitch = Math.max(-6, Math.min(6, Number(q.pitch ?? 0)));
    const bargeIn = q.bargeIn === '1' || q.bargeIn === 'true';

    const step = (q.step || 'menu').toString();
    const callSid = (req.body?.CallSid || '').toString();
    const digits = (req.body?.Digits || '').toString();
    const speech = (req.body?.SpeechResult || '').toLowerCase();

    if (!callSid) {
      return res.status(200).setHeader('Content-Type','text/xml')
        .send(xml(say('alice','en-US','We could not identify this call. Goodbye.') + '<Hangup/>'));
    }

    const sess = SESSIONS.get(callSid) || {};
    SESSIONS.set(callSid, sess);

    const common = { lang, voice, style, rate, pitch, bargeIn: bargeIn ? '1':'0' } as any;

    // -------- MENU --------
    if (step === 'menu') {
      let choice: Session['path'] | undefined;
      if (digits === '1' || /new|book|schedule/.test(speech)) choice = 'new';
      else if (digits === '2' || /re.?schedule/.test(speech)) choice = 'reschedule';
      else if (digits === '3' || /cancel/.test(speech)) choice = 'cancel';
      else if (digits === '0' || /front.*desk|operator|representative/.test(speech)) choice = 'frontdesk';

      if (!choice) {
        const prompt = ssml(
          'I did not get that. For a new appointment press 1, to reschedule press 2, to cancel press 3, to reach the front desk press 0.',
          style, rate, pitch
        );
        const tw = `<Gather input="speech dtmf" language="${esc(lang)}" timeout="6" speechTimeout="auto" bargeIn="${bargeIn ? 'true':'false'}"
                    action="${esc(nextUrl('menu', common))}" method="POST">
                      ${say(voice, lang, prompt)}
                   </Gather>
                   <Redirect method="POST">${esc(nextUrl('menu', common))}</Redirect>`;
        return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
      }

      sess.path = choice;

      if (choice === 'frontdesk') {
        const msg = ssml('Please hold while we connect you to the front desk.', style, rate, pitch);
        // You can <Dial> a real phone here:
        // return xml(say(voice,lang,msg) + `<Dial callerId="${esc(req.body?.To||'')}">${esc('+15551230000')}</Dial>`);
        return res.status(200).setHeader('Content-Type','text/xml')
          .send(xml(say(voice,lang,msg) + '<Pause length="1"/><Hangup/>'));
      }

      // ask name
      const askName = ssml('Great. Please say your full name after the tone.', style, rate, pitch);
      const tw = `<Gather input="speech" language="${esc(lang)}" timeout="6" speechTimeout="auto" bargeIn="false"
                  action="${esc(nextUrl('name', common))}" method="POST">
                    ${say(voice, lang, askName)}
                 </Gather>
                 <Redirect method="POST">${esc(nextUrl('name', common))}</Redirect>`;
      return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
    }

    // -------- NAME --------
    if (step === 'name') {
      const spoken = (req.body?.SpeechResult || '').toString().trim();
      if (spoken) sess.name = spoken;

      if (!sess.name) {
        const reprompt = ssml('Sorry, I did not catch that. Please say your full name.', style, rate, pitch);
        const tw = `<Gather input="speech" language="${esc(lang)}" timeout="6" speechTimeout="auto"
                    action="${esc(nextUrl('name', common))}" method="POST">
                      ${say(voice, lang, reprompt)}
                   </Gather>
                   <Redirect method="POST">${esc(nextUrl('name', common))}</Redirect>`;
        return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
      }

      const askDob = ssml('Thanks. Please enter your date of birth using the keypad, in eight digits. For example, May twenty second nineteen ninety is 05221990.', style, rate, pitch);
      const tw = `<Gather input="dtmf" numDigits="8" timeout="7" action="${esc(nextUrl('dob', common))}" method="POST">
                    ${say(voice, lang, askDob)}
                 </Gather>
                 <Redirect method="POST">${esc(nextUrl('dob', common))}</Redirect>`;
      return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
    }

    // -------- DOB --------
    if (step === 'dob') {
      const entered = (req.body?.Digits || '').toString().trim();
      if (entered && /^\d{8}$/.test(entered)) sess.dob = entered;

      if (!sess.dob) {
        const reprompt = ssml('Apologies, that did not look like eight digits. Please try again.', style, rate, pitch);
        const tw = `<Gather input="dtmf" numDigits="8" timeout="7" action="${esc(nextUrl('dob', common))}" method="POST">
                      ${say(voice, lang, reprompt)}
                   </Gather>
                   <Redirect method="POST">${esc(nextUrl('dob', common))}</Redirect>`;
        return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
      }

      const askWhen = ssml(
        'Please briefly say your preferred date and time. For example: next Tuesday afternoon, or October twelfth at ten A M.',
        style, rate, pitch
      );
      const tw = `<Gather input="speech" language="${esc(lang)}" timeout="6" speechTimeout="auto"
                  action="${esc(nextUrl('when', common))}" method="POST">
                    ${say(voice, lang, askWhen)}
                 </Gather>
                 <Redirect method="POST">${esc(nextUrl('when', common))}</Redirect>`;
      return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
    }

    // -------- WHEN --------
    if (step === 'when') {
      const spoken = (req.body?.SpeechResult || '').toString().trim();
      if (spoken) sess.when = spoken;

      if (!sess.when) {
        const reprompt = ssml('Sorry, I did not catch that. Please say a preferred date and time.', style, rate, pitch);
        const tw = `<Gather input="speech" language="${esc(lang)}" timeout="6" speechTimeout="auto"
                    action="${esc(nextUrl('when', common))}" method="POST">
                      ${say(voice, lang, reprompt)}
                   </Gather>
                   <Redirect method="POST">${esc(nextUrl('when', common))}</Redirect>`;
        return res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
      }

      const summary = ssml(
        `Thank you. I have your ${sess.path} request for ${sess.name}, date of birth ${sess.dob}, preferred time "${sess.when}". Our team will confirm shortly.`,
        style, rate, pitch, 200
      );

      // TODO: persist sess to your DB here.

      // cleanup
      SESSIONS.delete(callSid);

      return res.status(200).setHeader('Content-Type','text/xml')
        .send(xml(say(voice, lang, summary) + '<Pause length="1"/><Hangup/>'));
    }

    // fallback
    return res.status(200).setHeader('Content-Type','text/xml')
      .send(xml(say(voice, lang, ssml('Returning to the main menu.', style, rate, pitch)) +
                `<Redirect method="POST">${esc(nextUrl('menu', common))}</Redirect>`));

  } catch (e:any) {
    return res.status(200).setHeader('Content-Type','text/xml')
      .send(xml(`<Say voice="alice">Sorry, an error occurred.</Say><Hangup/>`));
  }
}
