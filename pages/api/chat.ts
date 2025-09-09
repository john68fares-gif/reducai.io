// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from "next";

type Body = {
  agent: {
    name: string;
    prompt: string;
    model: string;
    temperature: number;
  };
  messages: { role: "user" | "assistant"; content: string }[];
};

type Resp =
  | { ok: true; reply: string }
  | { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST." });
  }

  try {
    const { agent, messages } = req.body as Body;

    if (!agent || !agent.prompt || !messages) {
      return res.status(400).json({ ok: false, error: "Missing agent or messages." });
    }

    const systemMessage = {
      role: "system",
      content: agent.prompt,
    };

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: agent.model || "gpt-4o-mini",
        temperature: agent.temperature ?? 0.5,
        messages: [systemMessage, ...messages],
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res
        .status(500)
        .json({ ok: false, error: data.error?.message || "OpenAI request failed" });
    }

    const reply = data.choices?.[0]?.message?.content || "(no reply)";
    res.status(200).json({ ok: true, reply });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message || "Server error" });
  }
}
