// app/api/assistants/create/route.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * Creates an assistant (Assistants v2) using fetch (no SDK).
 * Body: { name: string, model: string, prompt: string, apiKeyPlain?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || 'Untitled Assistant');
    const model = String(body?.model || 'gpt-4o-mini');
    const instructions = String(body?.prompt || '');
    const apiKeyPlain = String(body?.apiKeyPlain || '');

    const key = (apiKeyPlain || process.env.OPENAI_API_KEY || '').trim();
    if (!key) {
      return NextResponse.json({ ok: false, error: 'Missing API key.' }, { status: 400 });
    }

    const resp = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // 👇 Required for Assistants v2
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        name,
        model,
        instructions,
        // add tools/metadata here if you like
      }),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return NextResponse.json(
        { ok: false, error: json?.error?.message || 'Failed to create assistant' },
        { status: resp.status }
      );
    }

    return NextResponse.json({ ok: true, assistant: json });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
