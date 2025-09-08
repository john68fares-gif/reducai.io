// pages/api/llm.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { system, messages, temperature = 0.2, model = 'gpt-4o-mini' } = req.body || {};
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

    const body = {
      model,
      temperature,
      messages: [
        ...(system ? [{ role: 'system', content: String(system) }] : []),
        ...(Array.isArray(messages) ? messages : []),
      ],
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const err = await r.text().catch(() => '');
      return res.status(r.status).json({ error: `OpenAI error ${r.status}: ${err}` });
    }

    const j = await r.json();
    const reply =
      j?.choices?.[0]?.message?.content ??
      j?.choices?.[0]?.delta?.content ??
      '';

    return res.status(200).json({ reply: String(reply) });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}
