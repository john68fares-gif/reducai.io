// pages/api/voice/improve-prompt.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { raw = '', company = 'the company', language = 'en-US' } =
      (typeof req.body === 'object' && req.body) ? req.body : {};

    const improved =
`### Voice Agent System Prompt
Company: ${company}
Language: ${language}

Guidelines:
- Be concise, friendly, and natural.
- Confirm key details out loud.
- If unsure, ask a short clarifying question.
- Never read markup or headings.
- Keep answers under ~2 sentences unless asked.

Persona:
- Helpful ${company} representative.

Core:
${raw || '(no prior prompt text provided)'}
`;

    return res.status(200).json({ ok: true, data: { prompt: improved } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Unexpected error' });
  }
}
