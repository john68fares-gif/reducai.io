// pages/api/chatbots/save.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * SERVER-ONLY: uses the SERVICE ROLE key (bypasses RLS) but
 * we still require a userId from the client (taken from their
 * signed-in session on the client).
 *
 * ENV required on Vercel:
 *  - NEXT_PUBLIC_SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY  (do NOT expose publicly)
 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const {
      userId,
      assistantId,
      name,
      model,
      industry,
      language,
      prompt,
      appearance,
    } = req.body || {};

    if (!userId)       return res.status(400).json({ ok: false, error: 'Missing userId' });
    if (!assistantId)  return res.status(400).json({ ok: false, error: 'Missing assistantId' });
    if (!name)         return res.status(400).json({ ok: false, error: 'Missing name' });

    const payload = {
      model: model || 'gpt-4o-mini',
      industry: industry ?? null,
      language: language || 'English',
      prompt: typeof prompt === 'string' ? prompt : (prompt ?? ''),
      appearance: appearance ?? null,
    };

    // ---- UPDATE ONLY (no insert): require an existing row for this user+assistant ----
    const { data: existing, error: findErr } = await supabase
      .from('chatbots')
      .select('id')
      .eq('assistant_id', String(assistantId))
      .eq('user_id', userId)
      .maybeSingle();

    if (findErr) throw findErr;
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Chatbot not found for this user/assistantId' });
    }

    const { data, error } = await supabase
      .from('chatbots')
      .update({
        name: String(name),
        payload,
        // if you have an updated_at column handled by trigger, you can omit it
        // updated_at: new Date().toISOString(),
      })
      .eq('assistant_id', String(assistantId))
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return res.status(200).json({ ok: true, chatbot: data });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Failed to save chatbot' });
  }
}
