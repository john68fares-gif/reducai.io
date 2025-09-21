import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SQL you should run once in Supabase (SQL Editor):
 *
 * -- stores per-user Google OAuth tokens
 * create table if not exists google_oauth_tokens (
 *   user_id uuid not null,
 *   email text,
 *   access_token text not null,
 *   refresh_token text,
 *   expiry_ts timestamptz,
 *   scope text,
 *   token_type text,
 *   raw jsonb,
 *   primary key (user_id)
 * );
 *
 * -- stores the assistant's sheet config (multiple sheets, tabs, mapping)
 * create table if not exists voice_sheets_configs (
 *   user_id uuid primary key,
 *   link text,
 *   spreadsheets jsonb not null default '[]'::jsonb, -- [{ id, tabIds, mapping }]
 *   updated_at timestamptz not null default now()
 * );
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
// this should match your deployed domain + this API route
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  'http://localhost:3000/api/connectors/sheets?fn=oauth-callback';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// scopes: spreadsheets read/write + list files to enumerate spreadsheets
const OAUTH_SCOPE = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ');

type Json = Record<string, any>;

// naive user extraction (replace with your auth)
async function getUser(req: NextApiRequest) {
  // try header from your app, then cookie, fall back to demo
  const explicit = req.headers['x-user-id'];
  const email = (req.headers['x-user-email'] as string) || undefined;
  if (explicit && typeof explicit === 'string') {
    return { id: explicit, email };
  }

  // if you use Supabase Auth, you can parse the JWT here (omitted for brevity)
  // as a safe fallback, use a deterministic demo id in dev
  return { id: '00000000-0000-0000-0000-000000000001', email: email || 'demo-user@example.com' };
}

function json(res: NextApiResponse, status: number, body: Json) {
  res.status(status).json(body);
}

function bad(res: NextApiResponse, e: unknown, fallback = 'Request failed') {
  const msg = e instanceof Error ? e.message : String(e ?? fallback);
  return json(res, 400, { error: msg });
}

async function getToken(userId: string) {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as
    | {
        user_id: string;
        email: string | null;
        access_token: string;
        refresh_token: string | null;
        expiry_ts: string | null; // ISO
        scope?: string | null;
        token_type?: string | null;
      }
    | null;
}

async function saveToken(
  userId: string,
  token: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
    email?: string;
  }
) {
  const expiry_ts =
    token.expires_in ? new Date(Date.now() + (token.expires_in - 30) * 1000).toISOString() : null;

  const { error } = await supabase.from('google_oauth_tokens').upsert(
    {
      user_id: userId,
      email: token.email || null,
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      expiry_ts,
      scope: token.scope || null,
      token_type: token.token_type || null,
      raw: token as any,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

async function refreshIfNeeded(userId: string) {
  const tok = await getToken(userId);
  if (!tok) return null;
  const isExpired =
    tok.expiry_ts && new Date(tok.expiry_ts).getTime() < Date.now() + 20_000; // 20s skew

  if (!isExpired) return tok;

  if (!tok.refresh_token) return tok; // cannot refresh

  // refresh token
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: tok.refresh_token,
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!r.ok) {
    // keep old token; caller may see 401 later
    return tok;
  }
  const j = (await r.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
  };
  await saveToken(userId, { ...j, refresh_token: tok.refresh_token || undefined, email: tok.email || undefined });
  return await getToken(userId);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Google API helpers
 * ──────────────────────────────────────────────────────────────────────────── */

async function gFetch(accessToken: string, url: string, init?: RequestInit) {
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Google API error: ${r.status} ${t}`);
  }
  return r.json();
}

// List spreadsheets from Drive
async function listSpreadsheets(accessToken: string, limit = 50) {
  const q = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    pageSize: String(Math.min(Math.max(limit, 1), 50)),
    fields: 'files(id,name)',
    orderBy: 'modifiedTime desc',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
  });
  const j = await gFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?${q.toString()}`
  );
  return (j.files as Array<{ id: string; name: string }>) || [];
}

// List tabs (sheets) inside a spreadsheet
async function listTabs(accessToken: string, spreadsheetId: string) {
  const j = await gFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=sheets.properties`
  );
  const tabs =
    (j.sheets as Array<{ properties: { sheetId: number; title: string } }>)?.map((s) => ({
      id: String(s.properties.sheetId),
      name: s.properties.title,
    })) || [];
  return tabs;
}

// Append a row into a specific sheet tab by A1 range
async function appendRow(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  values: any[]
) {
  const range = encodeURIComponent(`${tabName}!A:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
  return gFetch(accessToken, url, {
    method: 'POST',
    body: JSON.stringify({ majorDimension: 'ROWS', values: [values] }),
  });
}

// Read values in specific columns to check conflicts (very light)
async function readTwoCols(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  dateCol: string,
  timeCol: string
) {
  const range = encodeURIComponent(`${tabName}!${dateCol}:${timeCol}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  const j = await gFetch(accessToken, url);
  return (j.values as string[][]) || [];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Handler
 * ──────────────────────────────────────────────────────────────────────────── */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fn } = req.query;
  const user = await getUser(req);

  try {
    switch (fn) {
      case 'session': {
        const tok = await getToken(user.id);
        return json(res, 200, {
          connected: !!tok,
          email: tok?.email || user.email || null,
        });
      }

      case 'oauth-url': {
        if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
        const state = encodeURIComponent(JSON.stringify({ uid: user.id }));
        const params = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: GOOGLE_REDIRECT_URI,
          response_type: 'code',
          access_type: 'offline',
          prompt: 'consent', // ensures refresh_token first time
          scope: OAUTH_SCOPE,
          state,
          include_granted_scopes: 'true',
        });
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
        return json(res, 200, { authUrl });
      }

      case 'oauth-callback': {
        // exchange code -> token, then store
        const { code, state } = req.query;
        if (!code || typeof code !== 'string') return json(res, 400, { error: 'Missing code' });

        // decode state for user id (optional)
        let uid = user.id;
        try {
          if (state && typeof state === 'string') {
            const parsed = JSON.parse(state);
            if (parsed?.uid) uid = parsed.uid;
          }
        } catch {}

        const body = new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
        });

        const r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });

        if (!r.ok) {
          const t = await r.text();
          return json(res, 400, { error: `token exchange failed: ${t}` });
        }

        const token = (await r.json()) as {
          access_token: string;
          expires_in: number;
          refresh_token?: string;
          scope?: string;
          token_type?: string;
          id_token?: string;
        };

        // (optional) get userinfo email
        let email: string | undefined;
        try {
          const u = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${token.access_token}` },
          });
          if (u.ok) {
            const uj = await u.json();
            email = uj.email;
          }
        } catch {}
        await saveToken(uid, { ...token, email });

        // simple UX: redirect back to the Voice Agent page
        res.writeHead(302, { Location: '/voice-agent?connected=google-sheets' });
        return res.end();
      }

      case 'list': {
        const limit = Number(req.query.limit || '50');
        const tok = await refreshIfNeeded(user.id);
        if (!tok) return json(res, 200, { spreadsheets: [] }); // not connected yet
        const files = await listSpreadsheets(tok.access_token, limit);
        return json(res, 200, { spreadsheets: files });
      }

      case 'tabs': {
        const spreadsheetId = String(req.query.spreadsheetId || '');
        if (!spreadsheetId) return json(res, 400, { error: 'spreadsheetId required' });
        const tok = await refreshIfNeeded(user.id);
        if (!tok) return json(res, 401, { error: 'Not connected' });
        const tabs = await listTabs(tok.access_token, spreadsheetId);
        return json(res, 200, { tabs });
      }

      case 'save': {
        if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
        const body = req.body || {};
        const payload = {
          link: body.link || null,
          spreadsheets: Array.isArray(body.spreadsheets) ? body.spreadsheets : [],
        };
        const { error } = await supabase
          .from('voice_sheets_configs')
          .upsert(
            { user_id: user.id, link: payload.link, spreadsheets: payload.spreadsheets, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
        if (error) throw error;
        return json(res, 200, { ok: true });
      }

      case 'test-append': {
        if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
        const { sheetId, mapping, sample } = req.body || {};
        if (!sheetId || !mapping) return json(res, 400, { error: 'sheetId and mapping are required' });

        const tok = await refreshIfNeeded(user.id);
        if (!tok) return json(res, 401, { error: 'Not connected' });

        // find a tab name from the mapping context: we need the first selected tab
        // UI does not send tab name here, so try to load first tab
        const tabs = await listTabs(tok.access_token, sheetId);
        const tabName = tabs[0]?.name;
        if (!tabName) return json(res, 400, { error: 'No tabs to write' });

        // conflict check (very light): if (date,time) pair already exists
        const dateCol = (mapping.dateCol || 'C').toUpperCase();
        const timeCol = (mapping.timeCol || 'D').toUpperCase();

        // read the two columns and check if the pair exists
        try {
          const rows = await readTwoCols(tok.access_token, sheetId, tabName, dateCol, timeCol);
          const d = (sample?.date || '').toString().trim();
          const t = (sample?.time || '').toString().trim();
          const conflict = rows.some((r) => (r[0] || '').toString().trim() === d && (r[1] || '').toString().trim() === t);
          if (conflict) {
            return json(res, 409, { error: 'Time slot already taken' });
          }
        } catch {
          // ignore read error; continue to append
        }

        const nameVal = sample?.name || 'Test Client';
        const phoneVal = sample?.phone || '';
        const dateVal = sample?.date || '';
        const timeVal = sample?.time || '';
        const notesVal = sample?.notes || '';

        // build row by A..Z aligned with mapping columns
        // simplest approach: create an array of 26 empty cells and place values by letter index
        const row = new Array(26).fill('');
        const put = (letter: string, value: any) => {
          const idx = letterToIndex(letter);
          if (idx >= 0) row[idx] = value;
        };
        put(mapping.nameCol || 'A', nameVal);
        put(mapping.phoneCol || 'B', phoneVal);
        put(mapping.dateCol || 'C', dateVal);
        put(mapping.timeCol || 'D', timeVal);
        if (mapping.notesCol) put(mapping.notesCol, notesVal);

        await appendRow(tok.access_token, sheetId, tabName, row);
        return json(res, 200, { ok: true });
      }

      default:
        return json(res, 404, { error: 'Unknown fn' });
    }
  } catch (e) {
    return bad(res, e);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * utils
 * ──────────────────────────────────────────────────────────────────────────── */

function letterToIndex(letter: string) {
  // accepts 'A'..'Z' (single letter). For AA, AB... you can expand later.
  const c = (letter || 'A').trim().toUpperCase();
  if (!/^[A-Z]$/.test(c)) return -1;
  return c.charCodeAt(0) - 65;
}
