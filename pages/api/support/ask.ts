// pages/api/support/ask.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { loadIndex, cosine } from "../../../lib/supportIndex";
import { rateLimit } from "../../../lib/rateLimit";

/** ====== Config ====== */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const CHAT_MODEL = "gpt-4o-mini";
const EMBED_MODEL = "text-embedding-3-large";

// Hard caps to prevent accidental giant payloads
const MAX_QUESTION_LEN = 2000;
const TOP_K = 10;

/** ====== System policy / guardrails ====== */
const SYSTEM_POLICY = `
You are "Riley — Support" for reducai.io. Be short, tidy, and action-oriented.

SAFETY (must follow):
- Do NOT reveal source code, .env values, API keys, credentials, or full file contents.
- You may cite file paths and explain at a high level what they do.
- Provide steps, pointers, and pseudo-code only—never paste code from the repo.
- If asked for code or secrets: refuse and offer a safe explanation instead.
- Prefer bullet points (3–6 bullets), 1–2 short sentences each.
`.trim();

/** ====== Helpers ====== */
function redactAnswer(text: string) {
  return (text || "")
    // Remove fenced code blocks
    .replace(/```[\s\S]*?```/g, "[redacted — cannot share repo code]")
    // Remove obvious import lines
    .replace(/^\s*(import|require)\s[^\n]+/gim, "[redacted]")
    // Mask likely API keys
    .replace(/sk-[A-Za-z0-9]{10,}/g, "[redacted-key]")
    // Mask common secret patterns
    .replace(
      /(api[_-]?key|secret|token|password)\s*[:=]\s*["'`][^"'`\n]+["'`]/gi,
      "$1: [redacted]"
    );
}

async function embed(q: string) {
  const r = await fetch(OPENAI_EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: q }),
  });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.data[0].embedding as number[];
}

/** ====== Handler ====== */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // --- Health check (GET /api/support/ask?health=1) ---
  if (req.method === "GET") {
    if ("health" in req.query) {
      return res.status(200).json({
        ok: true,
        hasOpenAI: Boolean(OPENAI_API_KEY),
        chatModel: CHAT_MODEL,
        embedModel: EMBED_MODEL,
        time: new Date().toISOString(),
      });
    }
    return res.status(405).json({ error: "Use POST" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!OPENAI_API_KEY) {
    return res
      .status(500)
      .json({ error: "Server not configured (missing OPENAI_API_KEY)" });
  }

  // Simple per-IP limiter
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";
  if (!rateLimit(ip, 40)) {
    return res.status(429).json({ error: "Rate limit" });
  }

  // Validate input
  const question = String(req.body?.question || "").trim();
  if (!question) return res.status(400).json({ error: "Missing question" });
  if (question.length > MAX_QUESTION_LEN) {
    return res.status(400).json({ error: "Question too long" });
  }

  try {
    // Load local index (with fallback if file missing)
    let idx: { vectors: any[] };
    try {
      idx = loadIndex();
    } catch (e: any) {
      idx = {
        vectors: [
          {
            key: "build-flow",
            text:
              "Build flow: Step 1 choose AI type. Step 2 name/industry/language -> pick model & API key. Step 3 edit prompt boxes. Step 4 overview -> Generate AI -> dashboard.",
            vec: Array.from({ length: 1536 }, () => 0), // match text-embedding-3-large dim
            meta: { path: "docs/build/flow.md", range: [1, 60] },
          },
        ],
      };
    }

    // 🔧 FIX: actually compute the embedding for the question
    const qVec = await embed(question);

    // Score & pick top-K context
    const scored = idx.vectors
      .map((e: any) => ({ e, score: cosine(qVec, e.vec) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K);

    const context = scored
      .map(({ e }: any, i: number) => {
        const where = e.meta?.path
          ? `${e.meta.path} ${e.meta?.range?.join("-")}`
          : e.key;
        return `[${i + 1}] ${where} — ${e.text}`;
      })
      .join("\n");

    // Build chat prompt with strict safety and “summaries only” context
    const messages = [
      { role: "system", content: SYSTEM_POLICY },
      {
        role: "user",
        content:
`User question: ${question}

Context (summaries & sketches only — not full code):
${context}

Answer safely. Cite file paths. No repo code in the output.`,
      },
    ];

    // Call OpenAI Chat
    const rr = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0.2,
        messages,
      }),
    });

    if (!rr.ok) {
      const errText = await rr.text();
      return res.status(500).json({ error: errText });
    }

    const jj = await rr.json();
    const raw = jj.choices?.[0]?.message?.content || "Sorry — I couldn't find an answer.";
    const safe = redactAnswer(raw);

    return res.json({
      reply: safe,
      citations: scored
        .map((s: any) => s.e?.meta?.path || s.e?.key)
        .filter(Boolean)
        .slice(0, 5),
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return res.status(500).json({ error: msg });
  }
}
