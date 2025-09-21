// pages/api/connectors/sheets.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const {
  GOOGLE_CLIENT_ID = '',
  GOOGLE_CLIENT_SECRET = '',
  NEXT_PUBLIC_SITE_URL = '',
  SUPABASE_URL = '',
  SUPABASE_ANON_KEY = '',
  SUPABASE_SERVICE_ROLE = '',
} = process.env;

const SCOPE = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ');

function oauthClient(redirectUri: string) {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
}

function admin() {
  return createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

/** Minimal auth helper without @supabase/auth-helpers-nextjs */
async function getUserId(req: NextApiRequest): Promise<string | null> {
  try {
    // Try Authorization: Bearer <access_token>, then cookie 'sb-access-token'
    const authHeader = req.headers.authorization;
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const cookieAccess =
      (req.cookies && (req.cookies['sb-access-token'] || (req.cookies as any)['sb:token'])) || undefined;
    const accessToken = bearer || cookieAccess;
    if (!accessToken) return null;

    // Use the Admin client’s auth API to validate token (anon key works for getUser with access token)
    const anon = createAdminClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.getUser(accessToken);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

async function getUserConn(user_id: string) {
  const supa = admin();
  const { data, error } = await supa
    .from('connections_google')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function saveTokens(user_id: string, email: string, tokens: any) {
  const supa = admin();
  const expires_at = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
  const payload: any = {
    user_id,
    email,
    provider: 'google',
    access_token: tokens.access_token || null,
    refresh_token: tokens.refresh_token || null,
    expires_at,
  };
  const { error } = await supa.from('connections_google').insert(payload);
  if (error) throw error;
}

async function upsertSheetCache(
  user_id: string,
  items: Array<{ id: string; name: string; owner_email?: string }>
) {
  if (!items?.length) return;
  const supa = admin();
  const rows = items.map(i => ({
    spreadsheet_id: i.id,
    name: i.name,
    owner_email: i.owner_email || null,
    user_id,
  }));
  const { error } = await supa.from('gs_spreadsheets').upsert(rows, { onConflict: 'spreadsheet_id' });
  if (error) throw error;
}

function withClientTokens(tokens: any) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });
  return auth;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const action = (req.method === 'GET' ? req.query.action : (req.body?.action || req.query.action)) as
    | string
    | undefined;

  if (!action) return res.status(400).json({ error: 'Missing action' });

  // Public actions that run in a popup still need a session to save tokens under the right user.
  const user_id = await getUserId(req);

  if (!user_id && action !== 'auth_begin' && action !== 'oauth_callback') {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    switch (action) {
      case 'auth_begin': {
        const redirectUri = `${NEXT_PUBLIC_SITE_URL}/api/connectors/sheets?action=oauth_callback`;
        const client = oauthClient(redirectUri);
        const url = client.generateAuthUrl({
          access_type: 'offline',
          scope: SCOPE,
          prompt: 'consent',
        });
        res.writeHead(302, { Location: url });
        res.end();
        return;
      }

      case 'oauth_callback': {
        const redirectUri = `${NEXT_PUBLIC_SITE_URL}/api/connectors/sheets?action=oauth_callback`;
        const client = oauthClient(redirectUri);
        const code = req.query.code as string | undefined;

        const uid = await getUserId(req);
        if (!uid) return res.status(401).send('No session');

        if (!code) return res.status(400).send('Missing code');

        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: client });
        const me = await oauth2.userinfo.get();
        const email = me.data.email || 'unknown';

        await saveTokens(uid, email, tokens);

        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(`<!doctype html>
<html><body style="background:#0b0c10;color:#e6f1ef;font-family:system-ui">
<script>
try{ if(window.opener){ window.opener.postMessage({ type:'gsheets:authed', email:${JSON.stringify(email)} }, '*'); } }catch(e){}
window.close();
</script>
<p>You can close this window.</p>
</body></html>`);
        return;
      }

      case 'list_spreadsheets': {
        const conn = await getUserConn(user_id!);
        if (!conn) return res.status(400).json({ error: 'Not connected' });

        const auth = withClientTokens({
          access_token: conn.access_token,
          refresh_token: conn.refresh_token,
          expiry_date: conn.expires_at ? new Date(conn.expires_at).getTime() : undefined,
        });

        const drive = google.drive({ version: 'v3', auth });
        const r = await drive.files.list({
          q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
          fields: 'files(id,name,owners(emailAddress))',
          pageSize: 1000,
        });

        const items = (r.data.files || []).map(f => ({
          id: f.id!,
          name: f.name || 'Untitled',
          owner_email: f.owners?.[0]?.emailAddress || null,
        }));

        await upsertSheetCache(user_id!, items);

        return res.status(200).json({ items });
      }

      case 'list_tabs': {
        const spreadsheetId = (req.body?.spreadsheetId || req.query.spreadsheetId) as string | undefined;
        if (!spreadsheetId) return res.status(400).json({ error: 'Missing spreadsheetId' });

        const conn = await getUserConn(user_id!);
        if (!conn) return res.status(400).json({ error: 'Not connected' });

        const auth = withClientTokens({
          access_token: conn.access_token,
          refresh_token: conn.refresh_token,
          expiry_date: conn.expires_at ? new Date(conn.expires_at).getTime() : undefined,
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const tabs = (meta.data.sheets || [])
          .map(s => s.properties?.title)
          .filter(Boolean) as string[];

        return res.status(200).json({ tabs });
      }

      case 'test': {
        const conn = await getUserConn(user_id!);
        if (!conn) return res.status(400).json({ ok: false, message: 'Not connected' });

        const selected: string[] = Array.isArray(req.body?.selected) ? req.body.selected : [];
        if (!selected.length) return res.status(200).json({ ok: true, message: 'Connected, but no sheets selected yet.' });

        const supa = admin();
        const { data: rows, error } = await supa
          .from('gs_spreadsheets')
          .select('spreadsheet_id')
          .in('spreadsheet_id', selected)
          .eq('user_id', user_id);
        if (error) throw error;

        const missing = selected.filter(id => !rows?.some(r => r.spreadsheet_id === id));
        if (missing.length) return res.status(400).json({ ok: false, message: `Missing from cache: ${missing.join(', ')}` });

        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (e: any) {
    console.error('sheets api error', e);
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
