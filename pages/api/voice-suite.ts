// pages/api/voice-suite.ts
// ONE FILE that implements:
// - GET/PUT   ?op=settings          (used by your VoiceAgentSection to save/load UI state)
// - POST      ?op=createAgent       (create/replace agent; requires user's OpenAI key)
// - POST      ?op=attachNumber      (attach imported E.164 to agent)
// - POST      ?op=incoming          (Twilio Voice webhook - initial TwiML)
// - POST      ?op=handle            (Twilio Gather -> LLM -> TwiML turn loop)
//
// Minimal front-end tweaks:
//   1) Call /api/voice-suite?op=settings   (GET/PUT) instead of /api/voice-agent
//   2) Call /api/voice-suite?op=createAgent (POST) instead of /api/voice/agents
//      Body must include { openaiApiKey: "sk-..." } OR send header "x-openai-key"
//   3) Call /api/voice-suite?op=attachNumber (POST) instead of /api/telephony/attach-number
//   4) Twilio Voice Webhook URL -> POST https://<your-vercel-domain>/api/voice-suite?op=incoming
//
// If you *really* can’t change your front-end URLs, set Vercel rewrites to map the old paths
// to this single endpoint with the corresponding ?op=... (not shown here to keep this one-file).

import type { NextApiRequest, NextApiResponse } from 'next'

/* ----------------------------- CONFIG ----------------------------- */

const BASE_URL =
  'https://reducai-io-eq4t-6uk48e7ek-john68fares-3902s-projects.vercel.app'; // <-- your vercel deployment
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_VOICE = 'Polly.Joanna';
const DEFAULT_LANG = 'en-US';

/* --------------------------- IN-MEM STORE ------------------------- */

type Agent = {
  id: string;               // your builder's "bot"/agent id
  ownerId: string;          // put your auth id here if you add auth
  phoneNumberId: string;    // E.164 number like +15551234567
  prompt: string;
  model: string;            // LLM model name
  openaiApiKey: string;     // **user-provided key**
  ttsVoice: string;         // e.g. Polly.Joanna or "alice"
  language: string;         // e.g. en-US
  enabled: boolean;
  updatedAt: number;
};

const AGENTS = new Map<string, Agent>();          // id -> Agent
const PHONE_TO_AGENT = new Map<string, string>(); // +E164 -> id

function upsertAgent(a: Omit<Agent, 'updatedAt'>): Agent {
  const agent: Agent = { ...a, updatedAt: Date.now() };
  AGENTS.set(agent.id, agent);
  if (agent.phoneNumberId) PHONE_TO_AGENT.set(agent.phoneNumberId, agent.id);
  return agent;
}
function getAgentById(id: string) {
  return AGENTS.get(id) || null;
}
function getAgentByPhoneNumberId(phoneNumberId: string) {
  const id = PHONE_TO_AGENT.get(phoneNumberId);
  return id ? AGENTS.get(id) || null : null;
}

/* --------------------------- UI SETTINGS -------------------------- */
// purely for your VoiceAgentSection UI save/load (not used for calls)
let SETTINGS: any = {
  systemPrompt: '',
  ttsVoice: DEFAULT_VOICE,
  language: DEFAULT_LANG,
  fromE164: '',
  assistantId: '',
  publicKey: '',
};

/* ----------------------------- HELPERS ---------------------------- */

const isPOST = (req: NextApiRequest) => req.method === 'POST';
const isGET  = (req: NextApiRequest) => req.method === 'GET';
const isPUT  = (req: NextApiRequest) => req.method === 'PUT';

const asJSON = (res: NextApiResponse, code: number, data: any) => res.status(code).json(data);
const twiml  = (xml: string) => `<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`;
const esc    = (s: string) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function getQueryOp(req: NextApiRequest) {
  return (req.query.op as string || '').toLowerCase();
}

function getUserOpenAIKey(req: NextApiRequest, body: any) {
  // Prefer body.openaiApiKey, fallback to header x-openai-key
  const h = req.headers['x-openai-key'];
  return (body?.openaiApiKey as string) || (typeof h === 'string' ? h : (Array.isArray(h) ? h[0] : '')) || '';
}

async function runLLM(agent: Agent, userText: string): Promise<string> {
  const body = {
    model: agent.model || DEFAULT_MODEL,
    messages: [
      { role: 'system', content: agent.prompt || 'You are a helpful voice agent.' },
      { role: 'user', content: (userText || 'Greet the caller.') },
    ],
    temperature: 0.6,
    max_tokens: 200,
  };

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${agent.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content?.toString().trim();
    return text || "I'm having trouble generating a reply.";
  } catch {
    return "I'm having trouble right now. Please try again.";
  }
}

/* ----------------------------- HANDLERS --------------------------- */

async function handleSettings(req: NextApiRequest, res: NextApiResponse) {
  if (isGET(req))  return asJSON(res, 200, { ok: true, data: SETTINGS });
  if (isPUT(req))  { SETTINGS = { ...SETTINGS, ...(req.body || {}) }; return asJSON(res, 200, { ok: true, data: SETTINGS }); }
  res.setHeader('Allow', ['GET', 'PUT']); res.status(405).end('Method Not Allowed');
}

async function handleCreateAgent(req: NextApiRequest, res: NextApiResponse) {
  if (!isPOST(req)) { res.setHeader('Allow', ['POST']); return res.status(405).end('Method Not Allowed'); }

  const {
    agentId,         // builder "bot" id
    fromNumber,      // E.164 number
    voice,           // TTS voice
    language,        // ASR lang
    prompt,          // final prompt
  } = req.body || {};

  const userKey = getUserOpenAIKey(req, req.body);

  if (!agentId || !fromNumber || !prompt || !userKey) {
    return asJSON(res, 400, { ok:false, error:'agentId, fromNumber, prompt, and openaiApiKey (or x-openai-key header) are required' });
  }

  const saved = upsertAgent({
    id: agentId,
    ownerId: 'anon',
    phoneNumberId: fromNumber,
    prompt,
    model: DEFAULT_MODEL,
    openaiApiKey: userKey,
    ttsVoice: voice || DEFAULT_VOICE,
    language: language || DEFAULT_LANG,
    enabled: true,
  });

  return asJSON(res, 200, { ok: true, agentId: saved.id, phoneNumber: saved.phoneNumberId });
}

async function handleAttachNumber(req: NextApiRequest, res: NextApiResponse) {
  if (!isPOST(req)) { res.setHeader('Allow', ['POST']); return res.status(405).end('Method Not Allowed'); }
  const { agentId, phoneNumber } = req.body || {};
  if (!agentId || !phoneNumber) return asJSON(res, 400, { ok:false, error:'agentId and phoneNumber required' });

  const agent = getAgentById(agentId);
  if (!agent) return asJSON(res, 404, { ok:false, error:'Agent not found' });

  upsertAgent({ ...agent, phoneNumberId: phoneNumber, enabled: true });
  return asJSON(res, 200, { ok:true, data:{ agentId, phoneNumber } });
}

async function handleIncoming(req: NextApiRequest, res: NextApiResponse) {
  // Twilio initial webhook
  const to         = (req.body?.To as string) || (req.query?.To as string) || '';
  const calledSid  = (req.body?.CalledSid as string) || (req.query?.CalledSid as string) || '';
  const phoneId    = to || calledSid || 'default';

  const actionUrl  = `${BASE_URL}/api/voice-suite?op=handle&phoneNumberId=${encodeURIComponent(phoneId)}`;
  const xml = twiml(`
    <Say voice="${esc(DEFAULT_VOICE)}">Hey! You’re speaking with Reduc AI. How can I help you today?</Say>
    <Gather input="speech" action="${esc(actionUrl)}" method="POST" language="${esc(DEFAULT_LANG)}" speechTimeout="auto">
      <Say voice="${esc(DEFAULT_VOICE)}">I’m listening… please speak after the tone.</Say>
    </Gather>
    <Say voice="${esc(DEFAULT_VOICE)}">I didn’t catch that. Goodbye!</Say>
    <Hangup/>
  `);
  res.setHeader('Content-Type', 'text/xml'); res.status(200).send(xml);
}

async function handleTurn(req: NextApiRequest, res: NextApiResponse) {
  const phoneNumberId = (req.query.phoneNumberId as string) || (req.body?.phoneNumberId as string) || 'default';
  const userText = (req.body?.SpeechResult as string) || (req.body?.Digits as string) || '';

  const agent = getAgentByPhoneNumberId(phoneNumberId);
  if (!agent || !agent.enabled || !agent.openaiApiKey) {
    const xml = twiml(`
      <Say voice="${esc(DEFAULT_VOICE)}">This phone number is not configured yet. Please finish creating a voice agent in your dashboard.</Say>
      <Hangup/>
    `);
    res.setHeader('Content-Type', 'text/xml'); return res.status(200).send(xml);
  }

  const answer = await runLLM(agent, userText || 'Greet the caller.');
  const nextUrl = `${BASE_URL}/api/voice-suite?op=handle&phoneNumberId=${encodeURIComponent(phoneNumberId)}`;

  const xml = twiml(`
    <Say voice="${esc(agent.ttsVoice)}">${esc(answer || "Sorry, I didn't catch that.")}</Say>
    <Gather input="speech" action="${esc(nextUrl)}" method="POST" language="${esc(agent.language)}" speechTimeout="auto">
      <Say voice="${esc(agent.ttsVoice)}">Anything else?</Say>
    </Gather>
    <Say voice="${esc(agent.ttsVoice)}">Thanks for calling. Goodbye!</Say>
    <Hangup/>
  `);

  res.setHeader('Content-Type', 'text/xml'); res.status(200).send(xml);
}

/* ----------------------------- ROUTER ----------------------------- */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const op = getQueryOp(req);

    if (op === 'settings')   return handleSettings(req, res);
    if (op === 'createagent')return handleCreateAgent(req, res);
    if (op === 'attachnumber') return handleAttachNumber(req, res);
    if (op === 'incoming')   return handleIncoming(req, res);
    if (op === 'handle')     return handleTurn(req, res);

    return asJSON(res, 400, { ok:false, error:'Missing or unknown ?op= param. Try one of: settings, createAgent, attachNumber, incoming, handle' });
  } catch (e: any) {
    return asJSON(res, 500, { ok:false, error: e?.message || 'Server error' });
  }
}

/* ------------------------- QUICK FRONTEND NOTES ------------------- */
/*
In VoiceAgentSection.tsx, change the fetch URLs:

GET settings:
  fetch('/api/voice-suite?op=settings')

PUT settings:
  fetch('/api/voice-suite?op=settings',{method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(settings)})

POST create agent (include user OpenAI key):
  fetch('/api/voice-suite?op=createAgent', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      agentId: selectedBotId,
      fromNumber: settings.fromE164,
      voice: settings.ttsVoice,
      language: settings.language,
      prompt: settings.systemPrompt,
      openaiApiKey: settings.openaiKey, // <-- add an input to collect this
    })
  })

POST attach number:
  fetch('/api/voice-suite?op=attachNumber', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ agentId: selectedBotId, phoneNumber: settings.fromE164 })
  })

Twilio Console > Phone Number > Voice Webhook:
  POST https://reducai-io-eq4t-6uk48e7ek-john68fares-3902s-projects.vercel.app/api/voice-suite?op=incoming
*/
