// pages/api/voice/improve-prompt.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Minimal "Improve for Voice" endpoint.
 * - No external API needed.
 * - Takes: { raw: string, company?: string, language?: string }
 * - Returns: { ok: true, data: { prompt: string } }
 *
 * This just reshapes the prompt you already wrote in Builder into a
 * voice-friendly system prompt (clear persona, goals, guardrails).
 */

type Body = {
  raw?: string;
  company?: string;
  language?: string; // BCP-47 like "en-US"
};

type Resp =
  | { ok: true; data: { prompt: string } }
  | { ok: false; error: string };

export default function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { raw = '', company = 'the company', language = 'en-US' } = (req.body || {}) as Body;

    const trimmed = (raw || '').toString().trim();
    if (!trimmed) {
      res.status(400).json({ ok: false, error: 'Missing "raw" prompt text.' });
      return;
    }

    // Heuristic: split out any “Step 1/Step 3” or “Company/Industry/Language” blocks if present.
    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // A tiny cleaner to remove superfluous headings we often see pasted from Builder.
    const cleaned = lines
      .filter((l) => !/^step\s*\d+/i.test(l))
      .filter((l) => !/^(company|industry|language)\s*:/i.test(l))
      .join('\n');

    // Build a voice-oriented system prompt.
    const voicePrompt = buildVoicePrompt({
      language,
      company,
      core: cleaned || trimmed,
    });

    res.status(200).json({ ok: true, data: { prompt: voicePrompt } });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'Internal error' });
  }
}

function buildVoicePrompt({
  language,
  company,
  core,
}: {
  language: string;
  company: string;
  core: string;
}) {
  // Guidance & defaults tuned for phone voice agents (Twilio/Vapi/etc).
  return `You are a real-time voice assistant for ${company}.
Speak ${language}. Keep responses concise (1–2 sentences).
Sound natural, friendly, and decisive. Avoid filler words. Never mention being an AI.

### Goals
- Help the caller quickly with accurate, helpful answers.
- Follow the company guidelines and policies below.
- Ask one question at a time. Confirm important details briefly.
- If you don't know something, say so and offer an alternative.

### Style
- Conversational, warm, confident.
- Use plain language; avoid jargon.
- Keep sentences short for TTS clarity.
- Pause briefly (",") between clauses when reading numbers or URLs.

### Guardrails
- Never share secrets, tokens, or internal notes.
- Do not invent policies, prices, or availability.
- If asked to perform actions you can’t do, explain limits and provide the best available next step.
- If the user asks to speak with a human, collect their name, phone, and reason, then confirm.

### Core Domain Instructions
${core.trim()}

### Behaviors for Phone Calls
- If caller is silent, politely prompt once, then ask if they want to continue.
- When collecting numbers or emails, read back to confirm.
- If call quality is poor, summarize and offer a follow-up.

### Closing
- Summarize concisely and confirm the next step.
- Thank the caller and end gracefully.`;
}
