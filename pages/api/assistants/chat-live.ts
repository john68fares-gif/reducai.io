// pages/api/assistants/chat-live.ts
// Live chat endpoint (SSE) for assistant instances (per-assistant, per-version).
// - POST: stream assistant response back using Server-Sent Events (SSE).
// - GET: fetch assistant config (with version if provided).
//
// SECURITY NOTES:
// - Requires OPENAI_API_KEY to call OpenAI (or replace with whatever LLM provider).
// - Uses ADMIN_EMAILS env var (comma separated) to mark admins.
// - Contains a conservative safety filter; do not remove unless you understand legal/ethical implications.

import type { NextApiRequest, NextApiResponse } from 'next';

// ---------- Types ----------
type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool' ; content: string };
type AssistantConfig = {
  id: string;
  name: string;
  ownerId?: string;
  defaultSystemPrompt?: string;
  versions?: Array<{
    id: string;
    name: string;
    systemPrompt?: string;
    rules?: string[]; // quick rules
    createdAt?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

type StartPayload = {
  assistantId: string;
  versionId?: string; // optional: select a version to drive behavior
  messages: ChatMessage[]; // full chat history from client (or at least the user messages)
  meta?: Record<string, any>; // optional metadata (device, locale, etc.)
  adminEmail?: string; // optional: to check admin privileges
  options?: {
    // admin-only toggles (e.g. relax safety). This is logged and only allowed for admin accounts.
    allowUnsafe?: boolean;
    temperature?: number;
    model?: string;
  };
};

// ---------- Env helper ----------
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);

// ---------- Simple DB placeholders (swap with Supabase/Prisma/etc.) ----------
async function getAssistantById(assistantId: string): Promise<AssistantConfig | null> {
  // TODO: Replace with your DB call
  // Example: const { data } = await supabase.from('assistants').select('*').eq('id', assistantId).single();
  // Return a mocked assistant if you want local dev:
  if (assistantId === 'demo-assistant') {
    return {
      id: 'demo-assistant',
      name: 'Demo Assistant',
      defaultSystemPrompt: '[Identity]\nYou are a helpful assistant.\n',
      versions: [
        { id: 'v1', name: 'Default v1', systemPrompt: '[Style]\nConcise.\n' },
        { id: 'v2', name: 'Friendly v2', systemPrompt: '[Style]\nVery friendly.\n' },
      ],
    };
  }
  return null;
}

async function saveConversation(assistantId: string, conversation: { messages: ChatMessage[], meta?: any, versionId?: string }) {
  // TODO: persist to DB
  // Example: await supabase.from('conversations').insert({...})
  console.log('Saving conversation (placeholder):', { assistantId, versionId: conversation.versionId, messagesCount: conversation.messages.length });
}

// ---------- Safety filter ----------
function safetyRejects(messages: ChatMessage[]): { rejected: boolean; reason?: string } {
  // A minimal heuristic filter — expand with a proper classifier if needed.
  const joined = messages.map(m => m.content).join(' ').toLowerCase();
  const bannedPatterns = [
    'kill(', 'bomb', 'harm someone', 'how to make a bomb', 'explosive', 'purchase illegal', 'hack into', 'bypass', 'credit card number', 'ssn',
    // add more patterns if desired
  ];
  for (const p of bannedPatterns) {
    if (joined.includes(p)) return { rejected: true, reason: `Request contains disallowed pattern: ${p}` };
  }
  // obviously you should integrate a proper safety model for production
  return { rejected: false };
}

// ---------- Helper: pick system prompt based on assistant + version ----------
function buildSystemPrompt(assistant: AssistantConfig, versionId?: string) {
  let system = assistant.defaultSystemPrompt || '';
  if (versionId && assistant.versions) {
    const v = assistant.versions.find(x => x.id === versionId);
    if (v?.systemPrompt) system += '\n' + v.systemPrompt;
  }
  return system;
}

// ---------- Helper: admin check ----------
function isAdmin(email?: string) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
}

// ---------- SSE helpers ----------
function sseHeaders(res: NextApiResponse) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Allow CORS for dev; lock this down in production to your domain.
  res.setHeader('Access-Control-Allow-Origin', '*');
}

function sendEvent(res: NextApiResponse, data: string, event = 'message') {
  // SSE event
  res.write(`event: ${event}\n`);
  // SSE payload must escape newlines as \n inside data lines; write a data: line per actual line
  const lines = data.split(/\n/);
  for (const l of lines) {
    res.write(`data: ${l}\n`);
  }
  res.write('\n');
}

// ---------- Main handler ----------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Get assistant config overview
    const assistantId = (req.query.assistantId as string) || '';
    if (!assistantId) return res.status(400).json({ error: 'assistantId required' });
    const assistant = await getAssistantById(assistantId);
    if (!assistant) return res.status(404).json({ error: 'assistant not found' });
    return res.status(200).json({ assistant });
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // POST => start a live streamed response
  let payload: StartPayload;
  try {
    payload = req.body as StartPayload;
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const { assistantId, versionId, messages = [], adminEmail, options = {} } = payload || {};
  if (!assistantId) return res.status(400).json({ error: 'assistantId required in body' });
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });

  // load assistant config
  const assistant = await getAssistantById(assistantId);
  if (!assistant) return res.status(404).json({ error: 'assistant not found' });

  // Admin/allowUnsafe logic: only admins can enable allowUnsafe toggle
  const requesterIsAdmin = isAdmin(adminEmail);
  if (options.allowUnsafe && !requesterIsAdmin) {
    return res.status(403).json({ error: 'allowUnsafe only available to admins' });
  }

  // Safety pre-check
  const safety = safetyRejects(messages);
  if (safety.rejected && !options.allowUnsafe) {
    // Refuse with a friendly structured message
    return res.status(422).json({
      error: 'Message rejected by safety filter',
      reason: safety.reason,
      hint: 'Modify your request to remove instructions for illegal or dangerous actions.',
    });
  }

  // Build system prompt (assistant default + version overrides)
  const systemPrompt = buildSystemPrompt(assistant, versionId);
  const finalMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  // Setup SSE
  sseHeaders(res);
  // Important: flush headers so client receives them immediately
  res.write('\n');

  // Inform client we're starting
  sendEvent(res, JSON.stringify({ status: 'starting', assistantId, versionId }), 'meta');

  // Save conversation starter (non-blocking)
  saveConversation(assistantId, { messages: finalMessages, meta: payload.meta, versionId }).catch(e => {
    console.error('Failed to save conversation:', e);
  });

  // ------------------
  // Call the LLM provider (OpenAI example). This is a streaming example using Fetch.
  // Replace with your provider / official SDK to support streaming properly.
  // ------------------
  if (!OPENAI_KEY) {
    sendEvent(res, JSON.stringify({ error: 'OPENAI_API_KEY not configured on server' }), 'error');
    sendEvent(res, '[END]', 'end');
    return res.end();
  }

  try {
    // Prepare request payload for OpenAI Chat Completions (stream).
    // NOTE: If you use the official SDK, prefer its streaming helpers.
    const model = options.model || 'gpt-4o-mini'; // change default as you like
    const temperature = typeof options.temperature === 'number' ? options.temperature : 0.2;

    // Map our ChatMessage to OpenAI format
    const openaiMessages = finalMessages.map(m => ({
      role: m.role === 'tool' ? 'user' : m.role, // adapt if needed
      content: m.content,
    }));

    // Example fetch using the OpenAI streaming endpoint (will return an event-stream)
    // This fetch code assumes the OpenAI streaming format and may need adjustment if endpoint changes.
    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: openaiMessages,
        stream: true,
      }),
    });

    if (!aiResp.ok || !aiResp.body) {
      const txt = await aiResp.text();
      sendEvent(res, JSON.stringify({ error: 'LLM provider error', details: txt }), 'error');
      sendEvent(res, '[END]', 'end');
      return res.end();
    }

    // Stream chunks from OpenAI to the client as SSE 'delta' events.
    const reader = aiResp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let assistantTextSoFar = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // OpenAI stream delivers lines like: data: {...}\n\n
      // We'll forward raw chunk as 'delta' events, but parse minimal JSON to collect final text.
      // For safety, attempt to extract "content" deltas if present.
      // Simple heuristic: forward chunk to client so frontend can render progressively.
      sendEvent(res, chunk, 'delta');

      // try to extract textual pieces from the chunk (best-effort)
      // Very lightweight parse: find "content":"..." patterns in chunk:
      try {
        // The official stream format sends many "data: {\"choices\":[{\"delta\":{\"content\":\"...\"}}]}\n\n"
        const lines = chunk.split(/\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.replace(/^data:\s*/, '');
          if (payload === '[DONE]') continue;
          const parsed = JSON.parse(payload);
          const choices = parsed.choices ?? [];
          for (const c of choices) {
            const delta = c.delta ?? {};
            if (delta?.content) {
              assistantTextSoFar += delta.content;
            }
          }
        }
      } catch (e) {
        // ignore parse errors, we're just forwarding
      }
    }

    // Finalize: send assistant final text as event and end
    sendEvent(res, JSON.stringify({ status: 'done', text: assistantTextSoFar }), 'final');

    // persist the assistant reply back to DB (append to conversation)
    saveConversation(assistantId, {
      messages: [
        ...finalMessages,
        { role: 'assistant', content: assistantTextSoFar },
      ],
      versionId,
      meta: payload.meta,
    }).catch(err => console.error('Failed saving final conversation:', err));

    sendEvent(res, '[END]', 'end');
    return res.end();
  } catch (err: any) {
    console.error('Streaming error', err);
    sendEvent(res, JSON.stringify({ error: 'internal_stream_error', details: String(err?.message || err) }), 'error');
    sendEvent(res, '[END]', 'end');
    return res.end();
  }
}
