// pages/api/llm.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // BYO-KEY: must be provided in header
    const userKey = (req.headers['x-openai-key'] || '').toString().trim();
    if (!userKey) return res.status(401).json({ error: 'Missing x-openai-key header' });

    const { system, messages, temperature = 0.2, model = 'gpt-4o-mini' } = req.body || {};
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
        Authorization: `Bearer ${userKey}`,
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

    res.status(200).json({ reply: String(reply) });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}
