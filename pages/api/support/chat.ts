// pages/api/support/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };
type Body = {
  model?: string;
  system?: string;              // optional system prompt from client
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST with JSON body.' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: 'Server missing OPENAI_API_KEY.' });
    }

    const b = (req.body || {}) as Body;

    const model = (b.model || 'gpt-4o-mini').trim();
    const temperature = Number.isFinite(b.temperature) ? (b.temperature as number) : 0.3;
    const maxTokens = Number.isFinite(b.maxTokens) ? (b.maxTokens as number) : 400;

    // Build messages array for OpenAI; prepend system if provided
    const messages: Msg[] = [];
    if (b.system) messages.push({ role: 'system', content: String(b.system) });
    for (const m of b.messages || []) {
      if (m && (m.role === 'user' || m.role === 'assistant')) {
        messages.push({ role: m.role, content: String(m.content || '') });
      }
    }

    if (!messages.length) {
      return res.status(400).json({ ok: false, error: 'No messages provided.' });
    }

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!r.ok) {
      const errTxt = await safeText(r);
      return res.status(r.status).json({ ok: false, error: errTxt || 'OpenAI error' });
    }

    const data = (await r.json()) as any;
    const reply = data?.choices?.[0]?.message?.content?.trim() || '(no response)';
    return res.status(200).json({
      ok: true,
      reply,
      modelUsed: data?.model,
      usage: data?.usage,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}

async function safeText(r: Response) {
  try { return await r.text(); } catch { return `${r.status} ${r.statusText}`; }
}
