// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

type Message = { role: "system" | "user" | "assistant"; content: string };

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

    // Use either agent’s key (if stored) or fallback to global
    const client = new OpenAI({
      apiKey: agent.apiKey || process.env.OPENAI_API_KEY,
    });

    // Construct conversation
    const convo: Message[] = [
      { role: "system", content: agent.prompt },
      ...messages,
    ];

    const resp = await client.chat.completions.create({
      model: agent.model || "gpt-4o-mini",
      temperature: agent.temperature ?? 0.5,
      messages: convo,
    });

    const reply = resp.choices[0]?.message?.content || "⚠️ No response from model.";

    return res.status(200).json({
      ok: true,
      reply,
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
