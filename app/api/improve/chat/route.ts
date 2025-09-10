// app/api/improve/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // ensure Node runtime, not edge

type Msg = { role: "user" | "assistant"; content: string };

export async function GET() {
  // Quick sanity check in the browser: /api/improve/chat
  return NextResponse.json({ ok: true, route: "app", accepts: ["POST"] });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const {
    agentId,
    model,
    temperature = 0.5,
    system,
    messages = [],
    guardLevel = "lenient",
  }: {
    agentId: string;
    model: string;
    temperature?: number;
    system?: string;
    messages: Msg[];
    guardLevel?: "provider-only" | "lenient";
  } = body;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });

  // Minimal server policy: we don't add extra disclaimers if guardLevel=provider-only,
  // but we also won't produce instructions for clearly illegal harm.
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const disallowed = /\b(hack|cheat|aimbot|wallhack|exploit|malware|ransomware|keylogger|ddos|phishing)\b/i;
  if (disallowed.test(lastUser)) {
    return NextResponse.json({
      content:
        "I can’t help with that. If you have a different, lawful request, I’m happy to assist.",
      modelUsed: model,
      finish_reason: "safety",
      blocked: true,
    });
  }

  const chatMessages = [
    { role: "system", content: system || "You are a helpful assistant." },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: /^o3/.test(model) ? "gpt-4.1" : model, // map o3→gpt-4.1 here for simplicity
      temperature,
      messages: chatMessages,
    }),
  });

  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    return NextResponse.json({ error: "Upstream error", detail: txt }, { status: 502 });
  }

  const data = await upstream.json();
  const choice = data?.choices?.[0];
  const content = choice?.message?.content ?? "";

  return NextResponse.json({
    content,
    modelUsed: data?.model || model,
    finish_reason: choice?.finish_reason,
  });
}
