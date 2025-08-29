// pages/api/voice/twilio/incoming.ts
// Minimal voice agent that works *now* and speaks using the prompt you saved
// in /api/voice-agent (or a default). No extra setup in Twilio besides
// pointing your number’s Voice webhook to this URL.
//
// ✅ Works without any env vars (it will “rule-based” reply).
// ✅ If you *do* set OPENAI_API_KEY, it will use it for smarter replies.
//    (Users can still bring their own Twilio creds; this endpoint only needs the call.)
// ✅ Single endpoint handles: greeting, speech gather, reply loop.
//
// How it uses your prompt:
// - We try to read a prompt that you saved via PUT /api/voice-agent
//   (kept in memory on the server). If not found, we use a friendly default.
// - The greeting line + reply style uses that prompt.
//
// NOTE: This is a pragmatic MVP that avoids websockets/media streams so it
// runs fine on Vercel’s serverless runtime. You can upgrade later.

import type { NextApiRequest, NextApiResponse } from 'next';

// -------------------- little helpers --------------------
const xml = (s: string) => `<?xml version="1.0" encoding="UTF-8"?>${s}`;
const say = (t: string, voice = 'Polly.Joanna') =>
  `<Say voice="${escapeXml(voice)}">${escapeXml(t)}</Say>`;
const pause = (ms = 300) => `<Pause length="${Math.max(1, Math.round(ms / 1000))}"/>`;
function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// store for settings put by /api/voice-agent (if you used the file I sent earlier)
type StoredSettings = {
  systemPrompt?: string;
  ttsVoice?: string;
  language?: string;
};
declare global {
  // eslint-disable-next-line no-var
  var __VOICE_AGENT_SETTINGS__: StoredSettings | undefined;
}

// pull current prompt/voice from memory (or defaults)
function getSettings(): Required<StoredSettings> {
  const s = (globalThis as any).__VOICE_AGENT_SETTINGS__ || {};
  return {
    systemPrompt:
      s.systemPrompt?.trim() ||
      `You are Reduc AI, a friendly sales & support agent. Be concise, helpful, and upbeat. Ask clarifying questions.`,
    ttsVoice: s.ttsVoice || 'Polly.Joanna',
    language: s.language || 'en-US',
  };
}

// Try OpenAI (if key present); otherwise fall back to a simple rule-based reply
async function generateReply(userText: string, prompt: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    // dumb but useful fallback that still “uses” the prompt style a bit
    const firstLine = prompt.split('\n').find(Boolean) || 'a helpful AI agent';
    return `Thanks! As ${firstLine}, I got: "${userText}". How else can I help?`;
  }

  try {
    // Small, fast prompt -> short reply so it feels snappy on a phone call.
    const messages = [
      { role: 'system', content: `${prompt}\nYou are on a phone call. Keep answers under 40 words.` },
      { role: 'user', content: userText || 'The caller said nothing clearly.' },
    ];
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // small+cheap. Change if you prefer.
        messages,
        temperature: 0.6,
        max_tokens: 120,
      }),
    });
    const j: any = await r.json();
    const txt =
      j?.choices?.[0]?.message?.content?.toString()?.trim() ||
      'Sorry, I did not catch that. Could you repeat?';
    return txt;
  } catch {
    return 'I had trouble generating a response just now. Could you say that again?';
  }
}

// -------------------- main handler --------------------
export default async function incoming(req: NextApiRequest, res: NextApiResponse) {
  // Twilio will POST us on call start and after each <Gather> (with SpeechResult)
  const method = req.method || 'POST';
  if (method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Use POST');
  }

  const { systemPrompt, ttsVoice } = getSettings();

  // Twilio sends fields either as application/x-www-form-urlencoded or multipart
  const params = (req.body || {}) as Record<string, string>;
  const turn = Number((req.query.turn as string) || params.turn || '0') || 0;
  const agentId = (req.query.agentId as string) || '';
  const speech = (params.SpeechResult || params.transcription || '').toString().trim();
  const caller = (params.From || '').toString();

  // First contact: greet and ask an opening question, then Gather speech
  if (!speech && turn === 0) {
    const greeting = makeGreeting(systemPrompt, caller);
    const gatherAction = withQuery(req, { agentId, turn: '1' });

    const resp = xml(
      `<Response>
        ${say(greeting, ttsVoice)}
        ${pause(300)}
        <Gather input="speech" language="en-US" speechTimeout="auto" action="${escapeXml(gatherAction)}" method="POST">
          ${say('How can I help today?', ttsVoice)}
        </Gather>
        <!-- If no speech received, prompt again -->
        ${say('I did not catch that. One more try.', ttsVoice)}
        <Redirect method="POST">${escapeXml(gatherAction)}</Redirect>
      </Response>`
    );
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(resp);
  }

  // We have user speech -> produce a reply, then loop back to gather more.
  const replyText = await generateReply(speech, systemPrompt);
  const nextAction = withQuery(req, { agentId, turn: String(turn + 1) });

  const resp = xml(
    `<Response>
      ${say(replyText, ttsVoice)}
      ${pause(200)}
      <Gather input="speech" language="en-US" speechTimeout="auto" action="${escapeXml(nextAction)}" method="POST">
        ${say('You can continue.', ttsVoice)}
      </Gather>
      <Redirect method="POST">${escapeXml(nextAction)}</Redirect>
    </Response>`
  );

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(resp);
}

// -------------------- tiny utilities --------------------
function withQuery(req: NextApiRequest, extra: Record<string, string>) {
  const proto =
    (req.headers['x-forwarded-proto'] as string) ||
    (req.headers['x-forwarded-protocol'] as string) ||
    'https';
  const host =
    (req.headers['x-forwarded-host'] as string) ||
    (req.headers['host'] as string) ||
    '';
  const base = `${proto}://${host}`.replace(/\/+$/, '');
  const url = new URL('/api/voice/twilio/incoming', base);
  Object.entries(extra).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });
  return url.toString();
}

function makeGreeting(prompt: string, caller: string) {
  const company =
    // try to pull a line like "Company: Acme" or the first non-empty line
    prompt.match(/Company\s*:\s*(.+)/i)?.[1]?.trim() ||
    prompt.split('\n').find(Boolean) ||
    'our company';

  const who = caller?.startsWith('+') ? `caller at ${caller}` : 'there';
  return `Hi ${who}! You’ve reached ${company}. I’m your AI assistant.`;
}
