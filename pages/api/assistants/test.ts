// pages/api/assistants/test.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Ok = { ok: true; reply: string };
type Err = { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST' });

  const key = (req.headers['x-api-key'] as string || '').trim();
  if (!/^sk-/.test(key)) return res.status(401).json({ ok: false, error: 'Missing or invalid OpenAI key' });

  try {
    const { assistantId, message } = (req.body || {}) as { assistantId?: string; message?: string };
    if (!assistantId) return res.status(400).json({ ok: false, error: 'assistantId required' });

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };

    // 1) Create thread
    const threadRes = await fetch('https://api.openai.com/v1/threads', { method: 'POST', headers, body: JSON.stringify({}) });
    const thread = await threadRes.json();
    if (!thread?.id) return res.status(502).json({ ok: false, error: 'Failed to create thread' });

    // 2) Add user message
    const msgRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ role: 'user', content: message || 'Say hello.' }),
    });
    if (!msgRes.ok) return res.status(502).json({ ok: false, error: 'Failed to add message' });

    // 3) Run
    const runRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ assistant_id: assistantId }),
    });
    const run = await runRes.json();
    if (!run?.id) return res.status(502).json({ ok: false, error: 'Failed to start run' });

    // 4) Poll for completion (simple polling; keep it short to avoid serverless timeouts)
    const started = Date.now();
    let status = run.status;
    while (status && ['queued', 'in_progress', 'cancelling'].includes(status)) {
      await new Promise(r => setTimeout(r, 900));
      const check = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`, { headers });
      const js = await check.json();
      status = js?.status;
      if (Date.now() - started > 25000) break; // ~25s cap
    }

    // 5) Read last assistant message
    const msgsRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages?limit=10`, { headers });
    const msgs = await msgsRes.json();
    const firstAssistant = (msgs?.data || []).find((m: any) => m.role === 'assistant');
    const text = firstAssistant?.content?.[0]?.text?.value || 'No assistant message.';

    return res.status(200).json({ ok: true, reply: text });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
