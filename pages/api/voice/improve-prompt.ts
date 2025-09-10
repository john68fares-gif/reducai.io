// /app/api/generate-prompt/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SYS = `You are an expert prompt engineer.
You will receive:
- [Current] the current system prompt
- [Change Request] a short note of improvements

Return ONLY a revised, production-ready system prompt that keeps these sections and order:
[Identity]
[Style]
[Response Guidelines]
[Task & Goals]
[Error Handling / Fallback]

Rules:
- Merge improvements from the note; don't copy note text verbatim.
- Keep it concise, actionable, and consistent.
- If a first message is desired, append a final line exactly:
FirstMessage: <text>
- No extra commentary. Output just the prompt (and the FirstMessage line if relevant).`;

export async function POST(req: NextRequest) {
  try {
    const { model, currentPrompt, userNote } = await req.json();
    const key = req.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ error: 'missing key' }, { status: 401 });

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYS },
          { role: 'user', content:
`[Current]
${String(currentPrompt || '').trim()}

[Change Request]
${String(userNote || '').trim()}

Remember: return only the new prompt with the exact section headers above.
Optionally include "FirstMessage: ..." as the very last line if appropriate.` },
        ],
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      return NextResponse.json({ error: txt || 'upstream error' }, { status: 502 });
    }

    const j = await r.json();
    const raw = (j?.choices?.[0]?.message?.content || '').trim();

    let prompt = raw;
    let firstMessage: string | undefined;
    const fm = raw.match(/^\s*FirstMessage:\s*(.+)$/m);
    if (fm) {
      firstMessage = fm[1].trim();
      prompt = raw.replace(/^\s*FirstMessage:\s*.+$/m, '').trim();
    }
    return NextResponse.json({ prompt, firstMessage });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'gen error' }, { status: 500 });
  }
}
