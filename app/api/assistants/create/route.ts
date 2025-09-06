import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';  // required for crypto.subtle in Node

type JWTPayload = { sub?: string };

// Very small helpers (no extra packages):
function base64ToBuf(b64: string): ArrayBuffer {
  const bin = Buffer.from(b64, 'base64');
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
}
async function decryptAesGcmConcat(rawKey: ArrayBuffer, b64Joined: string): Promise<string> {
  const joined = new Uint8Array(base64ToBuf(b64Joined));
  const iv = joined.slice(0, 12);
  const cipher = joined.slice(12);
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(dec);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { apiKeyId, model, name, instructions } = await req.json();
    if (!apiKeyId || !model || !instructions) {
      return NextResponse.json({ error: 'Missing apiKeyId, model, or instructions' }, { status: 400 });
    }

    // Create a Supabase client that acts as this user
    const supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      {
        global: { headers: { Authorization: `Bearer ${token}` } }
      }
    );

    // Verify user and get id from JWT
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user?.id) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    // 1) get encrypted OpenAI key
    const { data: keyRow, error: keyErr } = await supabase
      .from('user_api_keys')
      .select('ciphertext')
      .eq('user_id', user.id)
      .eq('id', apiKeyId)
      .maybeSingle();
    if (keyErr) throw keyErr;
    if (!keyRow?.ciphertext) return NextResponse.json({ error: 'API key not found' }, { status: 404 });

    // 2) get user AES key
    const { data: secretRow, error: secretErr } = await supabase
      .from('user_secrets')
      .select('enc_key')
      .eq('user_id', user.id)
      .maybeSingle();
    if (secretErr) throw secretErr;
    if (!secretRow?.enc_key) return NextResponse.json({ error: 'No user secret present' }, { status: 400 });

    // 3) decrypt OpenAI key
    const rawKeyBuf = base64ToBuf(secretRow.enc_key);
    const openaiKey = await decryptAesGcmConcat(rawKeyBuf, keyRow.ciphertext);

    // 4) Create Assistant via REST (no openai SDK needed)
    const resp = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
        // required when using Assistants v2 (pick one of your supported models)
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        name: name || 'Assistant',
        model,
        instructions,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return NextResponse.json({ error: t || 'OpenAI error' }, { status: 502 });
    }

    const json = await resp.json();
    return NextResponse.json({ assistantId: json.id });
  } catch (e: any) {
    console.error('assistants/create error:', e);
    return NextResponse.json({ error: e?.message || 'Internal Error' }, { status: 500 });
  }
}
