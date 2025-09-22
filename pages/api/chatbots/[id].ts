import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

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

function toClient(r: Row) {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    model: r.model,
    temperature: r.temperature,
    system: r.system,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function getById(id: string): Promise<Row | null> {
  const { data, error } = await sb.from('chatbots').select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  res.setHeader('Cache-Control', 'no-store');

  const id = (req.query.id as string) || '';
  if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });

  const ownerId = getOwnerId(req);

  let existing: Row | null = null;
  try {
    existing = await getById(id);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Lookup failed' });
  }

  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' });
  if (existing.owner_id !== ownerId) return res.status(403).json({ ok: false, error: 'Forbidden' });

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, data: toClient(existing) });
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const body = (req.body || {}) as Partial<Pick<Row, 'name' | 'model' | 'temperature' | 'system'>>;
    const patch: Partial<Row> = {};
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.model === 'string') patch.model = body.model;
    if (typeof body.temperature !== 'undefined') patch.temperature = Number(body.temperature);
    if (typeof body.system === 'string') patch.system = body.system;

    try {
      const { data, error } = await sb
        .from('chatbots')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('owner_id', ownerId)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ ok: true, data: toClient(data as Row) });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || 'Update failed' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { error } = await sb.from('chatbots').delete().eq('id', id).eq('owner_id', ownerId);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || 'Delete failed' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
