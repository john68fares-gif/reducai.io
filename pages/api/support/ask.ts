// pages/api/ask.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_RILEY;

// --- Guardrails ---
const REFUSAL_TEXT =
  "Sorry, I can’t comply with that request.";

const shouldRefuse = (text: string) => {
  const t = text.toLowerCase();
  // Requests to reveal code, files, paths, internals, or to summarize them
  return [
    'show the code',
    'source code',
    'give me the code',
    'list files',
    'list folders',
    'folder structure',
    'project structure',
    'what files do you have',
    'what file',
    'file path',
    'filepaths',
    'paths',
    'source path',
    'summarize code',
    'summarise code',
    'read the file',
    'open the file',
    'can you see the file',
    'repo',
    'repository',
    'git tree',
    'show me what is inside of',
    'what’s inside',
    'whats inside',
    'contents of',
    'print the code',
    'dump the code',
    'show code block',
  ].some(k => t.includes(k));
};

const sanitize = (text: string) => {
  // Strip bold markers and code fences to avoid any accidental disclosure formatting
  return text
    .replace(/\*\*/g, '')
    .replace(/```[\s\S]*?```/g, '[redacted]')
    .replace(/`([^`]+)`/g, '$1'); // inline code -> plain
};

// --- Riley system prompt (non-customizable) ---
const RILEY_SYSTEM_PROMPT = `
You are Riley, a friendly, concise support assistant. Your strict rules:

1) Never reveal, summarize, or imply knowledge of any code, files, file existence, file paths, repositories, or internal sources. 
2) If the user requests anything in (1), reply only with: "Sorry, I can’t comply with that request."
3) Don’t say "I can see", "the file shows", or similar. 
4) Be brief, helpful, and on-topic for product support, setup guidance, and troubleshooting at a high level.
5) Use plain language. No markdown bold.
6) If unsure or the request is disallowed, default to the refusal line above.
`;

type Data =
  | { ok: true; message: string }
  | { ok: false; error: string };

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

    // Hard guardrail: refuse before contacting the model
    if (shouldRefuse(message)) {
      return res.status(200).json({ ok: true, message: REFUSAL_TEXT });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: 'Missing OpenAI key' });
    }

    // Call OpenAI Chat Completions (no streaming; UI shows dots while waiting)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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

    // Post-guardrail: if the model slipped, enforce refusal
    if (shouldRefuse(safe)) {
      return res.status(200).json({ ok: true, message: REFUSAL_TEXT });
    }

    // Extra safety: redact common leak words
    const finalOut = sanitize(
      safe.replace(/\b(path|paths|filepath|file path|source|sources)\b/gi, '[redacted]')
    );

    return res.status(200).json({ ok: true, message: finalOut });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
