// pages/api/va-chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const { system, user, model, key } = req.body || {};
    if (!key) return res.status(401).send('Missing OpenAI API key');
    if (!system || !user || !model) return res.status(400).send('Body must include { system, user, model }');

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
      }),
    });

    if (!upstream.ok) {
      const t = await upstream.text();
      return res.status(upstream.status).send(t || 'Upstream error');
    }

    const j = await upstream.json();
    const text = j?.choices?.[0]?.message?.content ?? '';
    return res.status(200).json({ text });
  } catch (e: any) {
    return res.status(500).send(e?.message || 'Server error');
  }
}
