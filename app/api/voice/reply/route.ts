import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 401 });

    const { model, systemPrompt, messages } = await req.json();

    const payload = {
      model: model || 'gpt-4o',
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages
      ],
      temperature: 0.6,
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ error: `LLM failed: ${t}` }, { status: 500 });
    }

    const j = await r.json();
    const reply = j.choices?.[0]?.message?.content || '';
    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Reply error' }, { status: 500 });
  }
}
