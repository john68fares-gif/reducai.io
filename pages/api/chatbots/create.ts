import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

type Out = { ok: true; data: any } | { ok: false; error: string };

function getOwnerId(req: NextApiRequest): string {
  const h = ((req.headers['x-owner-id'] || req.headers['x-user-id']) ?? '') as string;
  if (h && h.trim()) return h.trim();
  if (typeof req.query.ownerId === 'string' && req.query.ownerId.trim()) return req.query.ownerId.trim();
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)ra_uid=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  return 'anon';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Out>) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const ownerId = getOwnerId(req);
    const { name, model, instructions = '', temperature } = req.body || {};
    if (!ownerId || ownerId === 'anon' || !name || !model) {
      return res.status(400).json({ ok: false, error: 'ownerId (context), name and model are required' });
    }
    if (!OPENAI_API_KEY) return res.status(500).json({ ok: false, error: 'OPENAI_API_KEY missing' });

    const payload: any = {
      name: String(name),
      model: String(model),
      instructions: String(instructions ?? ''),
      metadata: {
        ownerId,
        ...(typeof temperature === 'number' ? { temperature: String(temperature) } : {}),
      },
    };

    const r = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(r.status).json({ ok: false, error: text || `Upstream ${r.status}` });
    }

    const a = await r.json();

    // Mirror to Supabase (persistent, cross-device)
    const temp =
      typeof temperature === 'number'
        ? Number(temperature)
        : Number.parseFloat(a?.metadata?.temperature ?? '0.5') || 0.5;

    const now = new Date().toISOString();
    const { data, error } = await sb
      .from('chatbots')
      .upsert({
        id: a.id, // keep OpenAI id
        owner_id: ownerId,
        name: a.name ?? name,
        model: a.model ?? model,
        temperature: temp,
        system: String(instructions ?? ''),
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (error) throw error;

    return res.status(200).json({
      ok: true,
      data: {
        id: data.id,
        ownerId: data.owner_id,
        name: data.name,
        model: data.model,
        temperature: data.temperature,
        system: data.system,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'create failed' });
  }
}
