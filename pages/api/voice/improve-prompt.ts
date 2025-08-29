// pages/api/voice/improve-prompt.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Ok<T>  = { ok: true; data: T };
type Err    = { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok<{ prompt: string }> | Err>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { raw = '', company = 'your company', language = 'en-US' } = req.body || {};

    // Very simple improvement logic (replace with real LLM later)
    const improved = `
You are a friendly and professional AI voice agent for ${company}.
Always answer clearly, keep replies short, and confirm next steps.
Primary language: ${language}.

Context from builder:
${raw || '(no extra context provided)'}
`.trim();

    res.status(200).json({ ok: true, data: { prompt: improved } });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
