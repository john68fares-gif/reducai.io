// pages/api/support/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Ok = { ok: true; reply: string };
type Err = { ok: false; error: string };

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }, // allow screenshot data URLs
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }

  try {
    // 1) Resolve API key (env first, else header for local-only testing)
    const apiKey =
      (process.env.OPENAI_API_KEY || (req.headers['x-api-key'] as string) || '')
        .toString()
        .trim();

    if (!apiKey) {
      return res.status(401).json({
        ok: false,
        error:
          'Missing OpenAI API key. Set OPENAI_API_KEY or send it in x-api-key header.',
      });
    }

    // 2) Normalize history -> OpenAI messages (supports text + image)
    const body = (req.body || {}) as any;
    const history = Array.isArray(body.history) ? body.history : [];

    const toParts = (m: any) => {
      const parts: any[] = [];
      if (m?.text) parts.push({ type: 'text', text: String(m.text) });
      if (m?.imageDataUrl) {
        parts.push({
          type: 'image_url',
          image_url: { url: String(m.imageDataUrl) }, // data URL or https
        });
      }
      return parts.length ? parts : [{ type: 'text', text: '' }];
    };

    const messages = [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text:
              'You are Riley, the website support assistant for reduc.ai. ' +
              'Be concise (<= 80 words). Use steps/bullets for fixes. ' +
              'Ask at most one clarifying question. If an image is provided, describe what you see and tie it to the fix.',
          },
        ],
      },
      ...history.map((m: any) => ({
        role: m?.role === 'user' ? 'user' : 'assistant',
        content: toParts(m),
      })),
    ];

    // 3) Call OpenAI Chat Completions via fetch (no SDK)
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.model || 'gpt-4o-mini',
        messages,
        temperature:
          typeof body.temperature === 'number' ? body.temperature : 0.3,
        max_tokens: 400,
      }),
    });

    if (!r.ok) {
      const err = await r.text().catch(() => `${r.status} ${r.statusText}`);
      return res.status(r.status).json({ ok: false, error: `OpenAI: ${err}` });
    }

    const data: any = await r.json();
    const reply =
      (data?.choices?.[0]?.message?.content || '').toString().trim() ||
      'OK.';
    return res.status(200).json({ ok: true, reply });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || 'Server error' });
  }
}
