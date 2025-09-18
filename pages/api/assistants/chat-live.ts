// /pages/api/assistants/chat-live.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Role = 'system' | 'user' | 'assistant';
type ChatMessage = { role: Role; content: string };

type RequestBody = {
  agentId?: string | null;
  versionId?: string | null;
  system: string;
  model: string;
  temperature?: number;
  messages: ChatMessage[]; // should NOT include your system; we prepend it
  attachments?: Array<{ id: string; name: string; mime: string; url?: string; size?: number }>;
};

type Success = { ok: true; message: string; raw?: any };
type Failure = { ok: false; error: string };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Optional: limit which models are allowed (simple server-side gate)
const ALLOWED_MODELS = new Set([
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1-mini',
  // add your routed aliases here if you use a router in front of OpenAI
]);

// Small helpers
function bad(res: NextApiResponse<Failure>, code: number, error: string) {
  return res.status(code).json({ ok: false, error });
}

function sanitizeMessages(input: any): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  const out: ChatMessage[] = [];
  for (const m of input) {
    const role = m?.role as Role;
    const content = typeof m?.content === 'string' ? m.content : '';
    if (!content) continue;
    if (role !== 'system' && role !== 'user' && role !== 'assistant') continue;
    // avoid carrying massive payloads / accidental code blocks
    const trimmed =
      content.length > 8000 ? content.slice(0, 8000) + '\n…[truncated]' : content;
    out.push({ role, content: trimmed });
  }
  return out.slice(-40); // cap context length
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Success | Failure>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return bad(res, 405, 'Method not allowed');
  }

  // Basic env guard
  if (!OPENAI_API_KEY) {
    return bad(res, 500, 'Server misconfigured: missing OPENAI_API_KEY');
  }

  let body: RequestBody;
  try {
    body = req.body as RequestBody;
  } catch {
    return bad(res, 400, 'Invalid JSON body');
  }

  const model = (body.model || '').trim();
  const temperature = Number.isFinite(body.temperature as number)
    ? Math.max(0, Math.min(1, Number(body.temperature)))
    : 0.5;
  const system = (body.system || '').toString();

  if (!system) return bad(res, 400, 'Missing system prompt');
  if (!model) return bad(res, 400, 'Missing model');
  if (ALLOWED_MODELS.size && !ALLOWED_MODELS.has(model)) {
    return bad(res, 400, `Model "${model}" not allowed`);
  }

  const userMessages = sanitizeMessages(body.messages);
  if (userMessages.length === 0) {
    return bad(res, 400, 'At least one user message is required');
  }

  // Build final messages (prepend your system)
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...userMessages,
  ];

  // (Optional) You can introspect agentId/versionId here for analytics/logging
  // const { agentId, versionId } = body;
  // const attachments = body.attachments || []; // If you support vision / file tools, wire it here.

  // Call OpenAI (non-streaming)
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        messages,
        // You can add max_tokens, response_format, tools, etc. here if needed
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return bad(
        res,
        502,
        `Upstream error (${r.status}): ${errText || 'no details'}`
      );
    }

    const data = await r.json();
    const message =
      data?.choices?.[0]?.message?.content?.toString() ??
      data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments?.toString() ??
      '';

    if (!message) {
      return bad(res, 502, 'Model returned empty message');
    }

    return res.status(200).json({ ok: true, message, raw: data });
  } catch (e: any) {
    return bad(res, 500, e?.message || 'Failed to contact model');
  }
}
