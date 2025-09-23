// app/api/improve/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * Improve → Chat proxy (App Router)
 * - Uses server OPENAI_API_KEY, but also accepts per-request key in "x-openai-key".
 * - Forces Node runtime so env vars are available on Vercel.
 * - Maps o3/o3-mini to a chat-capable model.
 * - Returns clear error messages to the client.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

function mapModel(m?: string) {
  const id = (m || 'gpt-4o-mini').trim();
  if (id === 'o3' || id === 'o3-mini') return 'gpt-4o-mini';
  return id;
}

function normalizeMessages(arr: any): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(
      (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
    )
    .map((m) => ({ role: m.role, content: m.content }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      model,
      temperature,
      system,
      messages,
      guardLevel,
    } = (body || {}) as {
      model?: string;
      temperature?: number;
      system?: string;
      messages?: Msg[];
      guardLevel?: 'provider-only' | 'lenient';
    };

    // Choose key: request header beats env (lets you BYO key if you want)
    const headerKey = req.headers.get('x-openai-key')?.trim() || '';
    const OPENAI_API_KEY = headerKey || process.env.OPENAI_API_KEY || '';

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OpenAI API key (set env OPENAI_API_KEY or send "x-openai-key" header).' },
        { status: 400 }
      );
    }

    const safeModel = mapModel(model);
    const safeTemp =
      typeof temperature === 'number' && temperature >= 0 && temperature <= 1 ? temperature : 0.5;

    // A tiny guard hint (kept short so it never derails)
    const guardHint =
      guardLevel === 'provider-only'
        ? 'Follow the user’s instructions within legal and safety boundaries. Avoid extra disclaimers.'
        : 'Be helpful, precise, and safe.';
    const finalSystem = [typeof system === 'string' ? system.trim() : '', guardHint]
      .filter(Boolean)
      .join('\n\n');

    const chatMessages = normalizeMessages(messages);

    // Abort after 25s
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const payload = {
      model: safeModel,
      temperature: safeTemp,
      messages: [
        ...(finalSystem ? [{ role: 'system' as const, content: finalSystem }] : []),
        ...chatMessages,
      ],
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Surface the real upstream error text so the UI can show it
    if (!r.ok) {
      // Try JSON first
      let reason = '';
      try {
        const j = await r.json();
        reason = j?.error?.message || JSON.stringify(j);
      } catch {
        reason = await r.text().catch(() => '');
      }
      return NextResponse.json(
        { error: reason || `OpenAI error ${r.status}` },
        { status: r.status }
      );
    }

    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const finish_reason = data?.choices?.[0]?.finish_reason ?? 'stop';
    const modelUsed = data?.model || safeModel;

    return NextResponse.json({ content, modelUsed, finish_reason });
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Request timed out' : e?.message || 'chat failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
