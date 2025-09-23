import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

type Json = Record<string, any>;

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

type Row = {
  id: string;
  owner_id: string;
  name: string;
  model: string;
  temperature: number;
  system: string;
  created_at?: string;
  updated_at?: string;
};

function getOwnerId(req: NextApiRequest): string {
  const h = (req.headers['x-owner-id'] || req.headers['x-user-id'] || '') as string;
  if (h && h.trim()) return h.trim();
  if (typeof req.query.ownerId === 'string' && req.query.ownerId.trim()) return req.query.ownerId.trim();
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)ra_uid=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  return 'anon';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const ownerId = getOwnerId(req);
  const {
    id,
    name,
    model = 'gpt-4o-mini',
    temperature = 0.5,
    system = '',
  } = (req.body || {}) as Partial<Row> & { system?: string };

  if (!name && !id) {
    return res.status(400).json({ ok: false, error: 'Missing "name" or existing "id".' });
  }

  // If updating an existing bot, verify ownership
  if (id) {
    const { data: ex, error: exErr } = await sb.from('chatbots').select('owner_id').eq('id', id).single();
    if (exErr && exErr.code !== 'PGRST116') {
      return res.status(500).json({ ok: false, error: exErr.message || 'Lookup failed' });
    }
    if (ex && ex.owner_id !== ownerId) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
  }

  const newId = (id && id.trim()) || `cbot_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();

  try {
    const { data, error } = await sb
      .from('chatbots')
      .upsert({
        id: newId,
        owner_id: ownerId,
        name: name || 'Untitled Agent',
        model,
        temperature: Number(temperature) || 0.5,
        system: system || '',
        updated_at: now,
        created_at: now,
      })
      .select()
      .single();

    if (error) throw error;

    const saved = data as Row;
    return res.status(200).json({
      ok: true,
      data: {
        id: saved.id,
        ownerId: saved.owner_id,
        name: saved.name,
        model: saved.model,
        temperature: saved.temperature,
        system: saved.system,
        createdAt: saved.created_at,
        updatedAt: saved.updated_at,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Save failed' });
  }
}
