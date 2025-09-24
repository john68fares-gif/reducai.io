import type { NextApiRequest, NextApiResponse } from 'next';
import { sb, requireUserId } from './_utils';

/**
 * Body:
 * {
 *   assistantId: string,
 *   name: string,
 *   model?: string,
 *   industry?: string | null,
 *   language?: string | null,
 *   prompt?: string,
 *   appearance?: any
 * }
 * Upserts by (user_id, assistant_id) — requires your unique constraint.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const userId = await requireUserId(req, res);
  if (!userId) return;

  const {
    assistantId,
    name,
    model,
    industry = null,
    language = 'English',
    prompt = '',
    appearance = null,
  } = (req.body || {}) as Record<string, any>;

  if (!assistantId || !name) {
    return res.status(400).json({ ok: false, error: 'Missing assistantId or name' });
  }

  const now = new Date().toISOString();
  const payload = {
    model: model || 'gpt-4o-mini',
    industry,
    language,
    prompt,
    appearance,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const { data, error } = await sb
      .from('chatbots')
      .upsert(
        {
          user_id: userId,
          assistant_id: String(assistantId),
          name: String(name),
          payload,
        },
        { onConflict: 'user_id,assistant_id' }
      )
      .select('id, assistant_id, user_id, name, payload, created_at, updated_at')
      .single();

    if (error) throw error;

    res.status(200).json({
      ok: true,
      item: {
        id: data.id,
        assistant_id: data.assistant_id,
        user_id: data.user_id,
        name: data.name,
        payload: data.payload,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'Save failed' });
  }
}
