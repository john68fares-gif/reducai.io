import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

type Json = Record<string, any>;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
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

async function listByOwner(ownerId: string): Promise<Row[]> {
  const { data, error } = await sb
    .from('chatbots')
    .select('*')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function upsertRow(row: Omit<Row, 'created_at' | 'updated_at'>): Promise<Row> {
  const now = new Date().toISOString();
  const payload = { ...row, updated_at: now, created_at: row['created_at'] || now } as any;
  const { data, error } = await sb.from('chatbots').upsert(payload).select().single();
  if (error) throw error;
  return data as Row;
}

/** Optional: pull in OpenAI assistants with metadata.ownerId === ownerId and mirror to Supabase */
async function hydrateFromOpenAI(ownerId: string) {
  if (!OPENAI_API_KEY) return;
  let url: string | null = 'https://api.openai.com/v1/assistants?limit=100';
  for (let page = 0; page < 10 && url; page++) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'assistants=v2' },
      cache: 'no-store',
    });
    if (!r.ok) break;
    const j = await r.json().catch(() => null);
    const list = Array.isArray(j?.data) ? j.data : [];

    for (const a of list) {
      const metaOwner = a?.metadata?.ownerId?.toString?.() || '';
      if (metaOwner !== ownerId) continue; // only my account’s assistants

      const temperature = Number.parseFloat(a?.metadata?.temperature ?? '') || 0.5;
      await upsertRow({
        id: a.id,
        owner_id: ownerId,
        name: a.name || 'Untitled Agent',
        model: a.model || 'gpt-4o',
        temperature,
        system: String(a.instructions ?? ''),
      });
    }

    if (j?.has_more && j?.last_id) {
      url = `https://api.openai.com/v1/assistants?limit=100&after=${encodeURIComponent(j.last_id)}`;
    } else {
      url = null;
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  res.setHeader('Cache-Control', 'no-store');
  const ownerId = getOwnerId(req);

  if (req.method === 'GET') {
    try {
      await hydrateFromOpenAI(ownerId); // harmless if no OPENAI_API_KEY
      const items = await listByOwner(ownerId);
      return res.status(200).json({ ok: true, data: items.map(dbToClient) });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || 'List failed' });
    }
  }

  if (req.method === 'POST') {
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

    try {
      const newId = (id && id.trim()) || `cbot_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
      const saved = await upsertRow({
        id: newId,
        owner_id: ownerId,
        name: name || 'Untitled Agent',
        model,
        temperature: Number(temperature) || 0.5,
        system: system || '',
      });
      return res.status(200).json({ ok: true, data: dbToClient(saved) });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || 'Save failed' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

function dbToClient(r: Row) {
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
