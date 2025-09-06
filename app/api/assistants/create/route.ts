// app/api/assistants/create/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';           // ensure Node runtime (not edge)
export const dynamic = 'force-dynamic';    // don’t cache this route

type Body = {
  name?: string;
  model?: string;
  prompt?: string;     // assistant instructions
  apiKeyPlain?: string; // optional user key from Step 2
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const name = body.name?.trim() || 'Untitled Assistant';
    const model = body.model?.trim() || 'gpt-4o-mini';
    const instructions = body.prompt?.trim() || 'You are a helpful assistant.';
    const apiKey = (body.apiKeyPlain || process.env.OPENAI_API_KEY || '').trim();

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'No OpenAI API key found (apiKeyPlain or OPENAI_API_KEY).' },
        { status: 400 }
      );
    }

    // Call OpenAI Assistants REST API directly (no SDK)
    const res = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // v2 header is still required for Assistants:
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        name,
        model,
        instructions,
        // add tools / metadata here if you want:
        // tools: [{ type: 'file_search' }],
        // metadata: { source: 'reducai-builder' },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error?.message || `OpenAI error ${res.status}` },
        { status: res.status }
      );
    }

    // Return the whole assistant (contains .id)
    return NextResponse.json({ ok: true, assistant: data });
  } catch (err: any) {
    console.error('assistants/create error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
