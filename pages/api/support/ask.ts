import type { NextApiRequest, NextApiResponse } from "next";
import { loadIndex, cosine } from "../../../lib/supportIndex";
import { rateLimit } from "../../../lib/rateLimit";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const CHAT_MODEL = "gpt-4o-mini";
const EMBED_MODEL = "text-embedding-3-large";

const SYSTEM_POLICY = `
You are "Riley — Support" for reducai.io. Be short, tidy, and action-oriented.

SAFETY (must follow):
- Do NOT reveal source code, .env values, API keys, credentials, or full file contents.
- You may cite file paths and explain at a high level what they do.
- Provide steps, pointers, and pseudo-code only—never paste code from the repo.
- If asked for code or secrets: refuse and offer a safe explanation instead.
- Prefer bullet points (3–6 bullets), 1–2 short sentences each.
`;

function redactAnswer(text: string) {
  return (text || "")
    .replace(/```[\s\S]*?```/g, "[redacted — cannot share repo code]")
    .replace(/^\s*(import|require)\s[^\n]+/gm, "[redacted]")
    .replace(/sk-[A-Za-z0-9]{10,}/g, "[redacted-key]")
    .replace(/(api[_-]?key|secret|token|password)\s*[:=]\s*["'`][^"'`\n]+["'`]/gi, "$1: [redacted]");
}

async function embed(q: string) {
  const r = await fetch(OPENAI_EMBED_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: q })
  });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.data[0].embedding as number[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "Server not configured (missing OPENAI_API_KEY)" });

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if (!rateLimit(ip, 40)) return res.status(429).json({ error: "Rate limit" });

  const question = String(req.body?.question || "").trim();
  if (!question) return res.status(400).json({ error: "Missing question" });

  try {
    const idx = loadIndex();
    const qVec = await embed(question);

    const scored = idx.vectors
      .map((e: any) => ({ e, score: cosine(qVec, e.vec) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const context = scored.map(({ e }: any, i: number) => {
      const where = e.meta?.path ? `${e.meta.path} ${e.meta?.range?.join("-")}` : e.key;
      return `[${i + 1}] ${where} — ${e.text}`;
    }).join("\n");

    const messages = [
      { role: "system", content: SYSTEM_POLICY },
      {
        role: "user",
        content:
`User question: ${question}

Context (summaries & sketches only — not full code):
${context}

Answer safely. Cite file paths. No repo code in the output.`
      }
    ];

    const rr = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: CHAT_MODEL, temperature: 0.2, messages })
    });

    if (!rr.ok) return res.status(500).json({ error: await rr.text() });

    const jj = await rr.json();
    const raw = jj.choices?.[0]?.message?.content || "Sorry — I couldn't find an answer.";
    const safe = redactAnswer(raw);

    return res.json({
      reply: safe,
      citations: scored.map((s: any) => s.e.meta?.path || s.e.key).slice(0, 5),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
