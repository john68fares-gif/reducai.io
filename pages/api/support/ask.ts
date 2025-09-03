// pages/api/support/ask.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { loadIndex, cosine } from "../../../lib/supportIndex";
import { rateLimit } from "../../../lib/rateLimit";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const CHAT_MODEL = "gpt-4o-mini";
const EMBED_MODEL = "text-embedding-3-large";

const MAX_QUESTION_LEN = 2000;
const TOP_K = 10;

const SYSTEM_POLICY = `
You are "Riley — Support" for reducai.io. Be short, tidy, and action-oriented.
SAFETY:
- Never reveal source code, .env values, API keys, credentials, or full file contents.
- You may cite file paths and explain at a high level what they do.
- Provide steps/pointers/pseudo-instructions only—no code dumps.
- If asked for code or secrets: refuse briefly and offer safe guidance.
- Prefer bullet points (3–6 bullets), 1–2 short sentences each.
`.trim();

function redactAnswer(text: string) {
  return (text || "")
    .replace(/```[\s\S]*?```/g, "[redacted — cannot share repo code]")
    .replace(/^\s*(import|require)\s[^\n]+/gim, "[redacted]")
    .replace(/\bsk-[A-Za-z0-9_]{10,}\b/g, "[redacted-key]")
    .replace(
      /(api[_-]?key|secret|token|password|sid|auth)\s*[:=]\s*["'`][^"'`\n]+["'`]/gi,
      "$1: [redacted]"
    );
}

async function embedOnce(q: string) {
  const r = await fetch(OPENAI_EMBED_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: q }),
  });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.data[0].embedding as number[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // --- Health check
  if (req.method === "GET") {
    const qp = req.query || {};
    if ("health" in qp) {
      return res.status(200).json({
        ok: true, hasOpenAI: Boolean(OPENAI_API_KEY),
        chatModel: CHAT_MODEL, embedModel: EMBED_MODEL,
        time: new Date().toISOString(),
      });
    }
    // --- Diagnostic ping: attempts a tiny embed + tiny chat so you can see exact failures
    if ("diag" in qp) {
      const diag: any = { embed: null, chat: null };
      try {
        await embedOnce("ping");
        diag.embed = "ok";
      } catch (e: any) {
        diag.embed = `fail: ${e?.message?.slice(0, 200) || "error"}`;
      }
      try {
        const rr = await fetch(OPENAI_CHAT_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: CHAT_MODEL, temperature: 0,
            messages: [{ role: "system", content: "Say: pong" }, { role: "user", content: "ping" }],
            max_tokens: 5
          }),
        });
        if (!rr.ok) diag.chat = `fail: ${await rr.text()}`; else diag.chat = "ok";
      } catch (e: any) {
        diag.chat = `fail: ${e?.message?.slice(0, 200) || "error"}`;
      }
      return res.status(200).json({ ok: true, diag });
    }
    return res.status(405).json({ error: "Use POST" });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "Server not configured (missing OPENAI_API_KEY)" });

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if (!rateLimit(ip, 40)) return res.status(429).json({ error: "Rate limit" });

  const question = String(req.body?.question || "").trim();
  if (!question) return res.status(400).json({ error: "Missing question" });
  if (question.length > MAX_QUESTION_LEN) return res.status(400).json({ error: "Question too long" });

  try {
    // Load KB (with fallback if file missing or malformed)
    let idx: { vectors: Array<{ key: string; text: string; vec: number[]; meta?: any }> };
    try {
      idx = loadIndex();
    } catch {
      idx = {
        vectors: [
          {
            key: "docs/build/overview.md#fallback",
            text: "Builder overview: Step1 choose AI type; Step2 fill fields + model/temp/API key; Step3 edit prompt; Step4 Review → Generate Agent → Dashboard.",
            vec: [], meta: { path: "docs/build/overview.md", range: [1, 200] }
          }
        ]
      };
    }

    // Try embeddings; if it fails, fall back to zero-context (Riley still answers)
    let qVec: number[] | null = null;
    let scored: Array<{ e: any; score: number }> = [];
    try {
      qVec = await embedOnce(question);
      scored = idx.vectors
        .map((e) => ({ e, score: qVec && e.vec ? cosine(qVec, e.vec) : 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_K);
    } catch (embedErr: any) {
      // Embeddings temporarily unavailable — proceed without retrieval
      scored = [];
    }

    const context = scored.length
      ? scored.map(({ e }, i) => {
          const where = e.meta?.path ? `${e.meta.path} ${e.meta?.range?.join("-")}` : e.key;
          return `[${i + 1}] ${where} — ${e.text}`;
        }).join("\n")
      : "(knowledge base temporarily unavailable)";

    const messages = [
      { role: "system", content: SYSTEM_POLICY },
      {
        role: "user",
        content:
`User question: ${question}

Context (summaries only — never full code):
${context}

Answer safely. Cite file paths by name if relevant.`
      }
    ];

    // Call Chat — if it fails, return the error as a normal 200 reply so UI can show it
    try {
      const rr = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: CHAT_MODEL, temperature: 0.2, messages }),
      });

      if (!rr.ok) {
        const errText = await rr.text();
        return res.status(200).json({
          reply: `Riley had trouble generating a response (model error). ${errText.slice(0, 300)}`,
          citations: scored.map(s => s.e?.meta?.path || s.e?.key).filter(Boolean).slice(0, 5)
        });
      }

      const jj = await rr.json();
      const raw = jj.choices?.[0]?.message?.content || "Sorry — I couldn't find an answer.";
      const safe = redactAnswer(raw);

      return res.status(200).json({
        reply: safe,
        citations: scored.map(s => s.e?.meta?.path || s.e?.key).filter(Boolean).slice(0, 5),
      });
    } catch (chatErr: any) {
      return res.status(200).json({
        reply: `Riley is reachable but the chat model call failed. ${String(chatErr).slice(0, 300)}`,
        citations: []
      });
    }
  } catch (e: any) {
    // Last-resort error as 200 so your UI doesn't crash
    return res.status(200).json({
      reply: `Server-side error while preparing the answer: ${e?.message?.slice(0, 300) || "unknown"}`,
      citations: []
    });
  }
}

