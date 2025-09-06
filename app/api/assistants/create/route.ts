// app/api/assistants/create/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, model, prompt, apiKeyPlain } = body;

    // Pick API key: user’s own (from Step 2) or fallback to server env
    const apiKey = apiKeyPlain || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'No OpenAI API key found' }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });

    // 🔥 Create the assistant in OpenAI account
    const assistant = await client.beta.assistants.create({
      name: name || 'Untitled Assistant',
      model: model || 'gpt-4o-mini',
      instructions: prompt || 'You are a helpful assistant.',
    });

    return NextResponse.json({ ok: true, assistant });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message || 'Failed to create assistant' }, { status: 500 });
  }
}
