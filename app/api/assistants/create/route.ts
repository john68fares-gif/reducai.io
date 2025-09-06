// app/api/assistants/create/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env, assertServerEnv } from '@/lib/env';

export const runtime = 'nodejs'; // ensure server runtime

type CreatePayload = {
  name: string;
  model: string;
  prompt: string;
  // Either send the user's plain key OR omit to use server OPENAI_API_KEY (if set)
  apiKeyPlain?: string;
};

export async function POST(req: Request) {
  try {
    assertServerEnv();

    const body = (await req.json()) as CreatePayload;

    if (!body?.name || !body?.model || !body?.prompt) {
      return NextResponse.json({ ok: false, error: 'Missing name, model or prompt' }, { status: 400 });
    }

    // Use user key if provided, else server default (optional)
    const openaiKey = body.apiKeyPlain || env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ ok: false, error: 'No OpenAI API key provided' }, { status: 400 });
    }

    // Here you could hit OpenAI to "create something" if you want.
    // For now we just validate the key shape lightly to avoid 404 loops.
    if (!openaiKey.startsWith('sk-')) {
      return NextResponse.json({ ok: false, error: 'Invalid OpenAI API key format' }, { status: 400 });
    }

    // Save build to Supabase if you prefer, or return the payload to the client.
    // We'll just echo success; your UI already stores in localStorage.
    // If you want Supabase persistence, uncomment and create a `builds` table:
    //
    // const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    // await supabase.from('builds').insert({
    //   name: body.name,
    //   model: body.model,
    //   prompt: body.prompt,
    //   created_at: new Date().toISOString(),
    // });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
