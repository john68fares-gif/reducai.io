// pages/api/chatbots/save.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OA = 'https://api.openai.com/v1';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!OPENAI_API_KEY) return res.status(500).json({ ok: false, error: 'Missing OPENAI_API_KEY' });

  try {
    const {
      userId,           // REQUIRED (supabase user id)
      assistantId,      // optional → update if provided
      name,
      model = 'gpt-4o-mini',
      prompt = '',
      industry,
      language,
      appearance,
    } = req.body || {};

    if (!userId) return res.status(400).json({ ok: false, error: 'Missing userId' });
    if (!name)   return res.status(400).json({ ok: false, error: 'Missing name' });

    const meta: Record<string, string> = {
      ownerUserId: String(userId),
    };
    if (industry)  meta.industry = String(industry);
    if (language)  meta.language = String(language);
    if (appearance) meta.appearance = typeof appearance === 'string' ? appearance : JSON.stringify(appearance);

    const payload = {
      name: String(name),
      model: String(model),
      instructions: String(prompt || ''),
      metadata: meta,
    };

    const url = assistantId ? `${OA}/assistants/${assistantId}` : `${OA}/assistants`;
    const method = assistantId ? 'POST' : 'POST';

    const r = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(r.status).json({ ok: false, error: text || `Upstream ${r.status}` });
    }

    const a = await r.json();
    return res.status(200).json({
      ok: true,
      chatbot: {
        id: a.id,
        name: a.name || 'Untitled Agent',
        model: a.model || model,
        createdAt: (a.created_at ? Number(a.created_at) * 1000 : Date.now()),
        temperature: safeTemp(a?.metadata?.temperature, 0.5),
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Failed to save chatbot' });
  }
}

function safeTemp(v: unknown, dflt: number) {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? (n as number) : dflt;
}
