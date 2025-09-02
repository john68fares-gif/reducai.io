// pages/api/support/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

type MsgIn = { role: 'assistant'|'user'; text: string; imageDataUrl?: string|null };
type Ok = { ok: true; reply: string };
type Err = { ok: false; error: string };

const SYSTEM = `You are Riley, the support assistant for reduc.ai. Be concise (≤80 words), use short bullets for steps, and ask for one clarifying detail if needed. If an image is included, describe the problem and give fixes.`;

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok|Err>) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'POST only' });

  try {
    const { history } = req.body as { history: MsgIn[] };

    // Build OpenAI message array with optional image parts
    const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM },
    ];

    for (const m of history || []) {
      const parts: any[] = [];
      if (m.text) parts.push({ type: 'text', text: m.text });
      if (m.imageDataUrl) {
        // pass the data URL straight through
        parts.push({ type: 'image_url', image_url: { url: m.imageDataUrl } });
      }
      chatMessages.push({ role: m.role, content: parts });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY, // server-side key
    });

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',       // good latency/cost; change in Step 2 if needed
      messages: chatMessages,
      temperature: 0.4,
      max_tokens: 500,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.toString?.() ||
      'Sorry, I could not generate a reply.';

    return res.status(200).json({ ok: true, reply });
  } catch (e: any) {
    return res.status(500).json({ ok:false, error: e?.message || 'Unexpected error' });
  }
}
