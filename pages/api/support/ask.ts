// pages/api/support/ask.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Load your API key from env
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_RILEY;

// --- Guardrails ---
const REFUSAL_TEXT = "Sorry, I can’t comply with that request.";

const shouldRefuse = (text: string) => {
  const t = text.toLowerCase();
  return [
    'show the code','source code','give me the code','list files','list folders',
    'folder structure','project structure','what files do you have','what file',
    'file path','filepaths','paths','source path','summarize code','summarise code',
    'read the file','open the file','can you see the file','repo','repository',
    'git tree','show me what is inside of','what’s inside','whats inside',
    'contents of','print the code','dump the code','show code block',
  ].some(k => t.includes(k));
};

const sanitize = (text: string) =>
  text
    .replace(/\*\*/g, '')
    .replace(/```[\s\S]*?```/g, '[redacted]')
    .replace(/`([^`]+)`/g, '$1');

// --- Riley system prompt with product knowledge ---
const RILEY_SYSTEM_PROMPT = `
You are Riley, the official support assistant for reducai.io.

Your rules:
1) Never reveal, summarize, or imply knowledge of code, files, or paths.
2) If asked, reply only: "Sorry, I can’t comply with that request."
3) Be brief, helpful, and on-topic for reducai.io support only.
4) Always assume the user is using reducai.io's website.
5) Never say you are a generic AI. Always act as official support.

Knowledge base (what exists in reducai.io):
- Build AI Agents (/builder): create new AI agents step by step.
- Improve Agents (/improve/:id): edit, optimize, and test AI agents.
- Demo (/demo): share or test a live demo of an agent.
- Launch (/launch): deploy the AI agent to production (get webhook URL, integrations).
- API Keys (/apikeys): manage OpenAI keys used by the platform.
- Phone Numbers (/phone-numbers): connect Twilio numbers to AI voice agents.
- Voice Agent (/voice-agent): configure call personas and scheduling assistants.

If a user asks for something outside reducai.io, politely redirect them back to reducai.io features.
If a feature doesn’t exist, answer: "That feature is not available on reducai.io right now."
`;

type Data = { ok: true; message: string } | { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { message } = req.body as { message?: string };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing message' });
    }

    // Hard guardrail
    if (shouldRefuse(message)) {
      return res.status(200).json({ ok: true, message: REFUSAL_TEXT });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: 'Missing OpenAI key' });
    }

    // Call OpenAI Chat Completions
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // 🔄 upgrade from mini to 4o for better reasoning
        temperature: 0.2,
        messages: [
          { role: 'system', content: RILEY_SYSTEM_PROMPT.trim() },
          { role: 'user', content: message },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      return res.status(500).json({ ok: false, error: err || 'OpenAI error' });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content ?? '';
    const safe = sanitize(raw);

    if (shouldRefuse(safe)) {
      return res.status(200).json({ ok: true, message: REFUSAL_TEXT });
    }

    const finalOut = sanitize(
      safe.replace(/\b(path|paths|filepath|file path|source|sources)\b/gi, '[redacted]')
    );

    return res.status(200).json({ ok: true, message: finalOut });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
