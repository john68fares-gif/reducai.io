// app/api/improve/chat/route.ts
import { NextResponse } from "next/server";

/**
 * Improve → Chat proxy (App Router)
 * URL: /api/improve/chat
 * Method: POST
 *
 * Body (JSON):
 * {
 *   "agentId": "optional",
 *   "model": "gpt-4o-mini" | "gpt-4o" | "gpt-4.1" | "gpt-4.1-mini" | "o3" | "o3-mini",
 *   "temperature": 0.0..1.0,
 *   "system": "string",
 *   "messages": [{ role: "user"|"assistant", content: "..." }],
 *   "guardLevel": "provider-only" | "lenient"
 * }
 *
 * Notes:
 * - If OPENAI_API_KEY is missing, returns a mock echo so the UI still works.
 * - Maps reasoning models (o3/o3-mini) to a chat-capable model to avoid upstream errors.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      agentId, // not used here, accepted for parity
      model,
      temperature,
      system,
      messages,
      guardLevel,
    } = (body || {}) as {
      agentId?: string;
      model?: string;
      temperature?: number;
      system?: string;
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
      guardLevel?: "provider-only" | "lenient";
    };

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

    const safeModel = mapModel(model ?? "gpt-4o-mini");
    const safeTemp =
      typeof temperature === "number" && temperature >= 0 && temperature <= 1
        ? temperature
        : 0.5;

    // Optional tiny guard hint to align with your UI's "refinements" switch
    const guardHint =
      guardLevel === "provider-only"
        ? "Follow the user’s instructions within legal and safety boundaries. Do not add extra disclaimers beyond provider requirements."
        : "Be helpful, precise, and safe. Respect any refinements.";
    const finalSystem = [String(system || "").trim(), guardHint]
      .filter(Boolean)
      .join("\n\n");

    const chatMessages = normalize(messages);

    // No key? Return a mock so the Improve UI keeps working.
    if (!OPENAI_API_KEY) {
      const lastUser =
        [...chatMessages].reverse().find((m) => m.role === "user")?.content ??
        "Hello!";
      return NextResponse.json({
        content: `(mock) You said: ${lastUser}`,
        modelUsed: safeModel,
        finish_reason: "stop",
      });
    }

    // Call OpenAI Chat Completions
    const payload = {
      model: safeModel,
      temperature: safeTemp,
      messages: [
        ...(finalSystem
          ? [{ role: "system" as const, content: finalSystem }]
          : []),
        ...chatMessages,
      ],
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      // Try to surface upstream error text for easier debugging
      const text = await r.text().catch(() => "");
      return NextResponse.json(
        { error: text || `Upstream ${r.status}` },
        { status: r.status }
      );
    }

    const data = await r.json().catch(() => ({}));
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      "";
    const finish_reason: string = data?.choices?.[0]?.finish_reason ?? "stop";
    const modelUsed: string = data?.model || safeModel;

    return NextResponse.json({ content, modelUsed, finish_reason });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "chat failed" },
      { status: 500 }
    );
  }
}

/* ---------------- helpers ---------------- */

function normalize(
  arr: any
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .map((m) => ({ role: m.role, content: m.content }));
}

function mapModel(m: string): string {
  // Reasoning models aren't supported on /chat/completions; pick a safe chat model.
  if (m === "o3" || m === "o3-mini") return "gpt-4o-mini";
  return m;
}
