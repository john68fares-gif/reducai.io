import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

type ReqBody = {
  message: string;      // user input
  agentPrompt?: string; // prompt saved from agent
  model?: string;       // chosen model
  temperature?: number; // chosen temperature
  apiKey?: string;      // optional override
};

type Resp =
  | { ok: true; reply: string }
  | { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const {
      message,
      agentPrompt = "You are a helpful assistant.",
      model = "gpt-4o-mini",
      temperature = 0.7,
      apiKey = process.env.OPENAI_API_KEY, // fallback to server env
    } = req.body as ReqBody;

    if (!message) {
      res.status(400).json({ ok: false, error: "Missing message." });
      return;
    }
    if (!apiKey) {
      res.status(400).json({ ok: false, error: "No API key provided." });
      return;
    }

    // Init OpenAI client
    const openai = new OpenAI({ apiKey });

    // Build messages
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: agentPrompt },
      { role: "user", content: message },
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      "(no response from model)";

    res.status(200).json({ ok: true, reply });
  } catch (e: any) {
    console.error("Chat API error:", e);
    res.status(500).json({ ok: false, error: e?.message || "Internal error" });
  }
}
