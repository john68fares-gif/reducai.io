// app/api/tts/elevenlabs/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';         // ensure Buffer is available
export const dynamic = 'force-dynamic';  // no caching

export async function POST(req: Request) {
  try {
    const { text, voiceId, apiKey } = (await req.json()) as {
      text: string;
      voiceId: string;
      apiKey?: string;
    };

    const key = apiKey || process.env.ELEVENLABS_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'Missing ElevenLabs API key' }, { status: 400 });
    }
    if (!text || !voiceId) {
      return NextResponse.json({ error: 'Missing text or voiceId' }, { status: 400 });
    }

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.85,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    });

    if (!r.ok) {
      const msg = await r.text();
      return NextResponse.json({ error: `ElevenLabs error: ${msg}` }, { status: r.status });
    }

    const arrayBuf = await r.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Server error' },
      { status: 500 },
    );
  }
}
