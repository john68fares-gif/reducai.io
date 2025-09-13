import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Improve → Chat proxy
 * - No Supabase.
 * - If OPENAI_API_KEY is missing, returns a mock reply so the UI still functions.
 * - Maps o3/o3-mini to a chat-capable model so upstream won't error.
 *
 * ENV (on Vercel):
 *   - OPENAI_API_KEY   (optional; if absent, returns mock output)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      agentId,                  // not used here but accepted for parity with the client
      model,
      temperature,
      system,
      messages,
      guardLevel,               // 'provider-only' | 'lenient'
    } = (req.body || {}) as {
      agentId?: string;
      model?: string;
      temperature?: number;
      system?: string;
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      guardLevel?: 'provider-only' | 'lenient';
    };

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const safeModel = mapModel(model ?? 'gpt-4o-mini');
    const safeTemp =
      typeof temperature === 'number' && temperature >= 0 && temperature <= 1 ? temperature : 0.5;

    // Build final system prompt (include a tiny guard hint if provided)
    const guardHint =
      guardLevel === 'provider-only'
        ? 'Follow the user’s instructions within legal and safety boundaries. Do not add extra disclaimers beyond provider requirements.'
        : 'Be helpful, precise, and safe. Respect any refinements.';
    const finalSystem = [system?.trim(), guardHint].filter(Boolean).join('\n\n');

    // Normalize chat messages from UI (ignore system; we add it above)
    const chatMessages = normalizeMessages(messages);

    // If no key → return mock reply so UI works
    if (!OPENAI_API_KEY) {
      const lastUser =
        [...chatMessages].reverse().find((m) => m.role === 'user')?.content ?? 'Hello!';
      return res.status(200).json({
        content: `(mock) You said: ${lastUser}`,
        modelUsed: safeModel,
        finish_reason: 'stop',
      });
    }

    // Call OpenAI Chat Completions
    const payload = {
      model: safeModel,
      temperature: safeTemp,
      messages: [
        ...(finalSystem ? [{ role: 'system' as const, content: finalSystem }] : []),
        ...chatMessages,
      ],
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(r.status).json({ error: text || `Upstream ${r.status}` });
    }

    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const finish_reason = data?.choices?.[0]?.finish_reason ?? 'stop';
    const modelUsed = data?.model || safeModel;

    return res.status(200).json({ content, modelUsed, finish_reason });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'chat failed' });
  }
}

/* ---------------- helpers ---------------- */

function normalizeMessages(
  arr: any
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    )
    .map((m) => ({ role: m.role, content: m.content }));
}

function mapModel(m: string): string {
  // Reasoning models (o3) aren’t available on /chat/completions → pick a safe chat model.
  if (m === 'o3' || m === 'o3-mini') return 'gpt-4o-mini';
  return m;
}
