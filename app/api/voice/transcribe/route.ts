import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 401 });

    const form = await req.formData();
    const audio = form.get('audio') as File | null;
    if (!audio) return NextResponse.json({ error: 'No audio' }, { status: 400 });

    const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: (() => {
        const fd = new FormData();
        fd.append('file', audio, 'audio.webm');
        fd.append('model', 'whisper-1'); // or 'gpt-4o-transcribe' if enabled
        return fd;
      })()
    });

    if (!openaiRes.ok) {
      const t = await openaiRes.text();
      return NextResponse.json({ error: `Whisper failed: ${t}` }, { status: 500 });
    }
    const json = await openaiRes.json();
    return NextResponse.json({ text: json.text || '' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Transcribe error' }, { status: 500 });
  }
}
