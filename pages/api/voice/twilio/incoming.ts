// pages/api/voice/twilio/incoming.ts
// Professional, configurable IVR-style flow using Twilio <Gather input="speech">.
// No third-party SDKs. No env vars. Stateless using query params carried across steps.

import type { NextApiRequest, NextApiResponse } from 'next';

type Ctx = {
  intent?: string;
  date?: string;
  time?: string;
  name?: string;
};

function escapeXml(s: string) {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' } as any)[c]
  );
}

function baseUrl(req: NextApiRequest) {
  const proto =
    (req.headers['x-forwarded-proto'] as string) ||
    (req.headers['x-forwarded-protocol'] as string) ||
    'https';
  const host =
    (req.headers['x-forwarded-host'] as string) ||
    (req.headers['host'] as string) ||
    '';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function sendTwiML(res: NextApiResponse, innerXml: string) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${innerXml}</Response>`;
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.status(200).send(xml);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Build a natural-sounding <Say> with SSML prosody + optional initial break (delayMs). */
function speak(text: string, cfg: VoiceCfg) {
  const firstBreak = cfg.delayMs > 0 ? `<break time="${cfg.delayMs}ms"/>` : '';
  const domainOpen =
    cfg.style === 'conversational'
      ? '<amazon:domain name="conversational">'
      : cfg.style === 'newscaster'
      ? '<amazon:domain name="news">'
      : '';
  const domainClose = domainOpen ? domainOpen.replace('<', '</') : '';

  return `
    <Say voice="${escapeXml(cfg.voice)}" language="${escapeXml(cfg.language)}" ${
      cfg.bargeIn ? 'bargeIn="true"' : ''
    }>
      ${domainOpen}
      <prosody rate="${cfg.ratePct}%" pitch="${cfg.pitchSemitones}st">
        ${firstBreak}${escapeXml(text)}
      </prosody>
      ${domainClose}
    </Say>
  `;
}

/** Gather wrapper with speech recognition + helpful defaults. */
function gather(url: string, prompt: string, cfg: VoiceCfg, hints?: string[]) {
  const hintsAttr = hints && hints.length ? ` hints="${escapeXml(hints.join(','))}"` : '';
  return `
    <Gather input="speech" language="${escapeXml(cfg.language)}" action="${escapeXml(
      url
    )}" method="POST" speechTimeout="auto" enhanced="true"${hintsAttr}>
      ${speak(prompt, cfg)}
    </Gather>
    ${speak("I didn't get that.", cfg)}
    <Redirect method="POST">${escapeXml(url)}</Redirect>
  `;
}

/** Pull a string param from query/body. */
function q(req: NextApiRequest, key: string) {
  const b: any = req.body || {};
  const v = (req.query as any)[key] ?? b[key];
  return typeof v === 'string' ? v : '';
}

/** Pull the last recognized speech. */
function speech(req: NextApiRequest) {
  const b: any = req.body || {};
  return (b.SpeechResult || '').toString().trim();
}

/** Carry context & config across requests in the URL. */
function nextUrl(req: NextApiRequest, step: string, ctx: Ctx, cfg: VoiceCfg) {
  const url = new URL(baseUrl(req) + '/api/voice/twilio/incoming');
  url.searchParams.set('step', step);

  // context
  if (ctx.intent) url.searchParams.set('intent', ctx.intent);
  if (ctx.date) url.searchParams.set('date', ctx.date);
  if (ctx.time) url.searchParams.set('time', ctx.time);
  if (ctx.name) url.searchParams.set('name', ctx.name);

  // config (echo the same across steps)
  url.searchParams.set('voice', cfg.voice);
  url.searchParams.set('lang', cfg.language);
  url.searchParams.set('style', cfg.style);
  url.searchParams.set('greet', cfg.greeting);
  url.searchParams.set('delayMs', String(cfg.delayMs));
  url.searchParams.set('rate', String(cfg.ratePct));
  url.searchParams.set('pitch', String(cfg.pitchSemitones));
  url.searchParams.set('bargeIn', cfg.bargeIn ? '1' : '0');

  return url.toString();
}

type VoiceCfg = {
  voice: string;               // e.g., "Polly.Joanna" or "alice"
  language: string;            // e.g., "en-US"
  style: 'conversational' | 'professional' | 'newscaster' | ''; // SSML domain tweaks
  greeting: string;            // first sentence
  delayMs: number;             // break before each spoken line
  ratePct: number;             // 60..140 (%)
  pitchSemitones: number;      // -6..+6 semitones
  bargeIn: boolean;            // allow caller to interrupt
};

function readCfg(req: NextApiRequest): VoiceCfg {
  const voice = q(req, 'voice') || 'Polly.Joanna';
  const language = q(req, 'lang') || 'en-US';
  const styleIn = (q(req, 'style') || '').toLowerCase();
  const style: VoiceCfg['style'] =
    styleIn === 'conversational' ? 'conversational' : styleIn === 'newscaster' ? 'newscaster' : styleIn === 'professional' ? 'professional' : '';
  const greeting = q(req, 'greet') || 'Thank you for calling. How can I help today?';
  const delayMs = clamp(parseInt(q(req, 'delayMs') || '0', 10) || 0, 0, 5000);
  const ratePct = clamp(parseInt(q(req, 'rate') || '100', 10) || 100, 60, 140);
  const pitchSemitones = clamp(parseInt(q(req, 'pitch') || '0', 10) || 0, -6, 6);
  const bargeIn = q(req, 'bargeIn') === '1';

  return { voice, language, style, greeting, delayMs, ratePct, pitchSemitones, bargeIn };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // State machine step
  const step = q(req, 'step') || 'intro';
  const cfg = readCfg(req);

  // Build conversational context (stateless)
  const ctx: Ctx = {
    intent: q(req, 'intent'),
    date: q(req, 'date'),
    time: q(req, 'time'),
    name: q(req, 'name'),
  };

  try {
    if (step === 'intro') {
      const url = nextUrl(req, 'intent', ctx, cfg);
      return sendTwiML(res, gather(url, cfg.greeting, cfg, ['schedule','reschedule','cancel']));
    }

    if (step === 'intent') {
      const said = speech(req) || ctx.intent || '';
      ctx.intent = said || 'schedule an appointment';
      const url = nextUrl(req, 'date', ctx, cfg);
      return sendTwiML(res, gather(url, `Got it — ${ctx.intent}. What date would you like?`, cfg));
    }

    if (step === 'date') {
      const said = speech(req) || ctx.date || '';
      ctx.date = said || 'next available';
      const url = nextUrl(req, 'time', ctx, cfg);
      return sendTwiML(res, gather(url, `Okay, ${ctx.date}. What time of day works best?`, cfg));
    }

    if (step === 'time') {
      const said = speech(req) || ctx.time || '';
      ctx.time = said || 'any time';
      const url = nextUrl(req, 'name', ctx, cfg);
      return sendTwiML(res, gather(url, `Great. May I have your full name?`, cfg));
    }

    if (step === 'name') {
      const said = speech(req) || ctx.name || '';
      ctx.name = said || 'Unknown';
      const url = nextUrl(req, 'confirm', ctx, cfg);
      const summary = `You want to ${ctx.intent}, on ${ctx.date}, around ${ctx.time}. Name: ${ctx.name}. Should I submit this request? Say yes or no.`;
      return sendTwiML(res, gather(url, summary, cfg, ['yes','no','confirm','cancel']));
    }

    if (step === 'confirm') {
      const said = (speech(req) || '').toLowerCase();
      const yes = /^(y|yes|yeah|yep|sure|confirm|ok|okay)/.test(said);
      if (yes) {
        return sendTwiML(
          res,
          speak(
            `Thanks ${ctx.name}. Your request has been submitted for ${ctx.date} around ${ctx.time}. You will receive a follow up shortly. Goodbye.`,
            cfg
          ) + '<Hangup/>'
        );
      } else {
        const url = nextUrl(req, 'intro', {}, cfg);
        return sendTwiML(
          res,
          speak('No problem. Let’s start over.', cfg) + `<Redirect method="POST">${escapeXml(url)}</Redirect>`
        );
      }
    }

    // Fallback: restart
    const url = nextUrl(req, 'intro', {}, cfg);
    return sendTwiML(res, speak('Let’s try again.', cfg) + `<Redirect method="POST">${escapeXml(url)}</Redirect>`);
  } catch {
    return sendTwiML(res, speak('Sorry, something went wrong. Please call again.', cfg) + '<Hangup/>');
  }
}
