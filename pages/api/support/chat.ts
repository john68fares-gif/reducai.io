// pages/api/support/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };
type Body = {
  model?: string;
  system?: string;             // optional system prompt from client
  messages: Msg[];             // chat history (user/assistant turns)
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

    const messages: Msg[] = [];
    if (b.system) messages.push({ role: 'system', content: b.system });
    for (const m of b.messages || []) {
      if (m.role === 'user' || m.role === 'assistant') {
        messages.push({ role: m.role, content: String(m.content || '') });
      }
    }
    if (!messages.length) {
      return res.status(400).json({ ok: false, error: 'No messages provided.' });
    }

    const openai = new OpenAI({ apiKey });

    const r = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const reply =
      r.choices?.[0]?.message?.content?.trim() ||
      '(no response)';

    return res.status(200).json({
      ok: true,
      reply,
      modelUsed: r.model,
      usage: r.usage,
    });
  } catch (e: any) {
    const msg = e?.response?.data?.error?.message || e?.message || 'OpenAI error';
    return res.status(500).json({ ok: false, error: msg });
  }
}
