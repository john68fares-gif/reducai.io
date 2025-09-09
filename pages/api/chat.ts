// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from "next";

type Role = "system" | "user" | "assistant";
type Message = { role: Role; content: string };

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { agent, messages } = req.body as {
      agent: {
        name: string;
        prompt: string;
        model: string;
        temperature: number;
        apiKey?: string; // optional per-agent API key
      };
      messages: Message[];
    };

    if (!agent || !agent.prompt || !agent.model) {
      return res.status(400).json({ error: "Missing agent config" });
    }

    const key = agent.apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      return res.status(500).json({ error: "Missing OpenAI API key" });
    }

    // Build conversation
    const convo: Message[] = [{ role: "system", content: agent.prompt }, ...(messages || [])];

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: agent.model || "gpt-4o-mini",
        temperature: agent.temperature ?? 0.5,
        messages: convo,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      const msg =
        (data && (data.error?.message || data.message)) ||
        `OpenAI error (status ${r.status})`;
      return res.status(r.status).json({ error: msg });
    }

    const reply =
      data?.choices?.[0]?.message?.content || "⚠️ No response from model.";

    return res.status(200).json({ ok: true, reply });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
