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

  // ⛔️ Removed: any extra app-side blocking/restriction logic.
  // We pass the request straight to the model.

  const chatMessages = [
    { role: "system", content: system || "You are a helpful assistant." },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Keep your original model mapping behavior
  const openaiModel = /^o3/.test(model) ? "gpt-4.1" : model;

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openaiModel,
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
    modelUsed: data?.model || openaiModel,
    finish_reason: choice?.finish_reason,
  });
}
