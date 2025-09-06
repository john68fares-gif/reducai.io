// app/api/assistants/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { base64ToBuf, decryptAesGcmConcat } from '@/lib/crypto';

export const runtime = 'nodejs';       // <- important (don’t run on edge)
export const dynamic = 'force-dynamic'; // optional: avoids caching

export async function POST(req: NextRequest) {
  try {
    const { apiKeyId, model, name, instructions } = await req.json();
    if (!apiKeyId || !model || !instructions) {
      return NextResponse.json({ error: 'Missing apiKeyId, model, or instructions' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    // 1) Get encrypted key row
    const { data: keyRow, error: keyErr } = await supabase
      .from('user_api_keys')
      .select('ciphertext')
      .eq('user_id', user.id)
      .eq('id', apiKeyId)
      .maybeSingle();
    if (keyErr) throw keyErr;
    if (!keyRow?.ciphertext) return NextResponse.json({ error: 'API key not found' }, { status: 404 });

    // 2) Get user’s AES key
    const { data: secretRow, error: secretErr } = await supabase
      .from('user_secrets')
      .select('enc_key')
      .eq('user_id', user.id)
      .maybeSingle();
    if (secretErr) throw secretErr;
    if (!secretRow?.enc_key) return NextResponse.json({ error: 'No user secret present' }, { status: 400 });

    // 3) Decrypt the OpenAI key
    const rawKeyBuf = base64ToBuf(secretRow.enc_key);
    const apiKey = await decryptAesGcmConcat(rawKeyBuf, keyRow.ciphertext);

    // 4) Create Assistant in the user’s OpenAI account
    const openai = new OpenAI({ apiKey: String(apiKey) });
    const assistant = await openai.beta.assistants.create({
      name: name || 'Assistant',
      model,
      instructions,
    });

    return NextResponse.json({ assistantId: assistant.id });
  } catch (e: any) {
    console.error('assistants/create error:', e);
    return NextResponse.json({ error: e?.message || 'Internal Error' }, { status: 500 });
  }
}
