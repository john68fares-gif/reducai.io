// pages/api/chatbots/save.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

type Body = {
  assistantId: string;
  name: string;
  model: string;
  industry?: string | null;
  language?: string | null;
  prompt: string;
  appearance?: any;
  type?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const method = (req.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH'].includes(method)) {
    res.setHeader('Allow', 'POST, PUT, PATCH');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const supabase = createServerSupabaseClient({ req, res });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return res.status(401).json({ ok: false, error: 'Not authenticated' });

  const b = (req.body ?? {}) as Body;
  if (!b.assistantId) return res.status(400).json({ ok: false, error: 'assistantId is required' });
  if (!b.name)        return res.status(400).json({ ok: false, error: 'name is required' });
  if (!b.model)       return res.status(400).json({ ok: false, error: 'model is required' });
  if (!b.prompt?.trim()) return res.status(400).json({ ok: false, error: 'prompt is required' });

  const nowISO = new Date().toISOString();
  const payload = {
    id: b.assistantId,
    assistantId: b.assistantId,
    name: b.name,
    type: b.type || 'ai automation',
    industry: b.industry ?? null,
    language: b.language ?? 'English',
    model: b.model,
    prompt: b.prompt,
    appearance: b.appearance ?? null,
    createdAt: b.createdAt || nowISO,
    updatedAt: b.updatedAt || nowISO,
  };

  const { data, error } = await supabase
    .from('chatbots')
    .upsert(
      [
        {
          user_id: auth.user.id,
          assistant_id: b.assistantId,
          name: b.name,
          payload,
          // created_at uses default on first insert; updated_at is handled by trigger
        },
      ],
      { onConflict: 'user_id,assistant_id' }
    )
    .select('*')
    .single();

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true, item: data });
}
