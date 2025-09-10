// /app/api/voicechat/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { model, system, user } = body || {};
    const key = req.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ error: 'missing key' }, { status: 401 });

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        temperature: 0.5,
        messages: [
          { role: 'system', content: String(system || '') },
          { role: 'user', content: String(user || '') },
        ],
      }),
    });

    if (!upstream.ok) {
      const txt = await upstream.text();
      return NextResponse.json({ error: txt || 'upstream error' }, { status: 502 });
    }

    const j = await upstream.json();
    const text = j?.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'chat error' }, { status: 500 });
  }
}
