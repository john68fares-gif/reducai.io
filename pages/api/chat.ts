// pages/api/improve/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Simple chat proxy for Improve.
 * - If OPENAI_API_KEY is missing, returns a mock reply so the UI still works.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { model, temperature, system, messages } = (req.body || {}) as {
      model?: string; temperature?: number; system?: string;
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    const key = process.env.OPENAI_API_KEY;
    const safeModel = mapModel(model || 'gpt-4o-mini');
    const safeTemp = typeof temperature === 'number' ? Math.max(0, Math.min(1, temperature)) : 0.5;

    const chatMsgs = Array.isArray(messages) ? messages.filter(m => m && (m.role==='user' || m.role==='assistant') && typeof m.content==='string') : [];

    if (!key) {
      const last = [...chatMsgs].reverse().find(m=>m.role==='user')?.content || 'Hello';
      return res.status(200).json({ content: `(mock) You said: ${last}`, modelUsed: safeModel, finish_reason: 'stop' });
    }

    const payload = {
      model: safeModel,
      temperature: safeTemp,
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...chatMsgs
      ]
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return res.status(r.status).json({ error: await r.text().catch(()=>`Upstream ${r.status}`) });
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const finish_reason = data?.choices?.[0]?.finish_reason ?? 'stop';
    const modelUsed = data?.model || safeModel;
    return res.status(200).json({ content, modelUsed, finish_reason });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'chat failed' });
  }
}
function mapModel(m: string): string { return (m==='o3' || m==='o3-mini') ? 'gpt-4o-mini' : m; }
