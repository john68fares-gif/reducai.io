// pages/api/voice/twilio/incoming.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

function twiml(xml: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`;
}
function sayBlock(voice: string, ssml: string) {
  // Twilio <Say> supports Amazon Polly names if using Twilio's Polly voices (voice="Polly.Joanna"), or "alice"
  return `<Say voice="${voice}">${ssml}</Say>`;
}

function ssmlify(opts: {
  text: string;
  delayMs?: number;
  ratePct?: number;
  semitones?: number;
  style?: ''|'conversational'|'professional'|'newscaster';
}) {
  const delay = Math.max(0, Math.min(5000, opts.delayMs || 0));
  const rate  = Math.max(60, Math.min(140, opts.ratePct || 100));
  const pitch = Math.max(-6, Math.min(6, opts.semitones || 0));
  // Twilio/Polly SSML supports <break> and <prosody rate="" pitch="">
  const pre = delay ? `<break time="${delay}ms"/>` : '';
  const prosody = `<prosody rate="${rate}%" pitch="${pitch}st">${escapeXml(opts.text)}</prosody>`;
  // "style" is not standard SSML for Twilio; we simulate by minor phrasing only (already covered by rate/pitch).
  return `<speak>${pre}${prosody}</speak>`;
}

function escapeXml(s: string) {
  return (s || '').replace(/[<>&'"]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]!));
}

async function openaiReply(prompt: string, lastUser: string) {
  if (!OPENAI_API_KEY) return `You said: ${lastUser}. (Live AI not configured yet.)`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type':'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt || 'You are a friendly receptionist.' },
        { role: 'user', content: lastUser || 'Hello' }
      ],
      temperature: 0.3,
      max_tokens: 180,
    }),
  });
  if (!res.ok) return `Thanks! One moment while I note that.`;
  const j = await res.json();
  return j?.choices?.[0]?.message?.content || 'Okay.';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Twilio hits with POST form-encoded
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  // Config from attach-number URL
  const q = req.query || {};
  const voice  = (q.voice as string)  || 'Polly.Joanna';
  const lang   = (q.lang as string)   || 'en-US';
  const greet  = (q.greet as string)  || 'Thank you for calling. How can I help today?';
  const style  = (q.style as string)  || 'professional';
  const delay  = Number(q.delay || 0);
  const rate   = Number(q.rate || 100);
  const pitch  = Number(q.pitch || 0);
  const barge  = String(q.barge || '1') === '1';

  // Basic call state
  const callSid = (req.body?.CallSid || '').toString();
  const step    = Number((req.query?.step as string) || '0');

  // Prompt (if you saved one server-side under this call — optional)
  // For now, try to use what the page saved in Settings via PUT /api/voice-agent
  // (If you implemented that route server-side, read it; else fallback.)
  const prompt = (process.env.VOICE_AGENT_PROMPT || '').toString();

  // Gather recognizes speech on Twilio side; we do a simple turn-by-turn loop
  if (step === 0) {
    const greetSSML = ssmlify({ text: greet, delayMs: delay, ratePct: rate, semitones: pitch, style: style as any });
    const action = new URL(req.url || '', `https://${req.headers.host}`).pathname + `?step=1&voice=${encodeURIComponent(voice)}&lang=${encodeURIComponent(lang)}&style=${encodeURIComponent(style)}&delay=${delay}&rate=${rate}&pitch=${pitch}&barge=${barge?'1':'0'}`;
    const xml = `
      ${sayBlock(voice, greetSSML)}
      <Gather input="speech" language="${lang}" action="${action}" method="POST" speechTimeout="auto" hints="">
        ${sayBlock(voice, ssmlify({ text: 'I\'m listening.', delayMs: 0, ratePct: rate, semitones: pitch }))}
      </Gather>
      <Pause length="1"/>
      <Redirect method="POST">${action}</Redirect>
    `.trim();
    return res.status(200).setHeader('Content-Type','text/xml').send(twiml(xml));
  }

  // step >= 1: Twilio posts back with SpeechResult
  const userSaid = (req.body?.SpeechResult || '').toString().trim();

  let reply = 'Got it.';
  try {
    reply = await openaiReply(prompt, userSaid || 'Hello');
  } catch {
    reply = 'Thanks for calling.';
  }

  const replySSML = ssmlify({ text: reply, delayMs: delay, ratePct: rate, semitones: pitch, style: style as any });

  // Continue one more turn (keep it short; you can increase steps if you like)
  const nextStep = step + 1;
  if (nextStep <= 3) {
    const action = new URL(req.url || '', `https://${req.headers.host}`).pathname + `?step=${nextStep}&voice=${encodeURIComponent(voice)}&lang=${encodeURIComponent(lang)}&style=${encodeURIComponent(style)}&delay=${delay}&rate=${rate}&pitch=${pitch}&barge=${barge?'1':'0'}`;
    const xml = `
      ${sayBlock(voice, replySSML)}
      <Gather input="speech" language="${lang}" action="${action}" method="POST" speechTimeout="auto"${barge ? ' bargeIn="true"' : ''}>
        ${sayBlock(voice, ssmlify({ text: 'Anything else?', delayMs: 250, ratePct: rate, semitones: pitch }))}
      </Gather>
      <Pause length="1"/>
      <Redirect method="POST">${action}</Redirect>
    `.trim();
    return res.status(200).setHeader('Content-Type','text/xml').send(twiml(xml));
  }

  // End the call politely
  const endSSML = ssmlify({ text: 'Thanks for calling. Have a great day!', delayMs: 200, ratePct: rate, semitones: pitch });
  return res.status(200).setHeader('Content-Type','text/xml').send(twiml(`${sayBlock(voice, endSSML)}<Hangup/>`));
}
