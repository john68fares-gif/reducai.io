import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { voiceId, text } = await req.json();
    if (!process.env.ELEVENLABS_API_KEY) {
      return new NextResponse('Missing ELEVENLABS_API_KEY', { status: 500 });
    }
    const id = voiceId || 'Rachel';
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true }
      })
    });

    if (!r.ok) {
      const msg = await r.text();
      return new NextResponse(`TTS error: ${msg}`, { status: r.status });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' }
    });
  } catch (e: any) {
    return new NextResponse(`TTS exception: ${e?.message || e}`, { status: 500 });
  }
}
