// pages/api/connectors/sheets.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const {
  GOOGLE_CLIENT_ID = '',
  GOOGLE_CLIENT_SECRET = '',
  NEXT_PUBLIC_SITE_URL = '',
  SUPABASE_URL = '',
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

async function getUserId(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createServerSupabaseClient({ req, res });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
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
  const expires_at =
    tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

  const payload: any = {
    user_id,
    email,
    provider: 'google',
    access_token: tokens.access_token || null,
    refresh_token: tokens.refresh_token || null,
    expires_at: expires_at,
  };

  // Insert a new row; keep history (simpler & safe)
  const { error } = await supa.from('connections_google').insert(payload);
  if (error) throw error;
}

async function upsertSheetCache(user_id: string, items: Array<{ id: string; name: string; owner_email?: string }>) {
  if (!items?.length) return;
  const supa = admin();
  const rows = items.map(i => ({
    spreadsheet_id: i.id,
    name: i.name,
    owner_email: i.owner_email || null,
    user_id,
  }));
  // Upsert by primary key spreadsheet_id
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
  // Auto-refresh if needed
  auth.on('tokens', (tk) => {
    // you could persist refreshed tokens here if desired
  });
  return auth;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const action = (req.method === 'GET' ? req.query.action : (req.body?.action || req.query.action)) as string | undefined;

  if (!action) {
    res.status(400).json({ error: 'Missing action' });
    return;
  }

  const user_id = await getUserId(req, res);
  if (!user_id && action !== 'auth_begin' && action !== 'oauth_callback') {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    switch (action) {
      case 'auth_begin': {
        // Start Google OAuth in popup
        const redirectUri = `${NEXT_PUBLIC_SITE_URL}/api/connectors/sheets?action=oauth_callback`;
        const client = oauthClient(redirectUri);
        const url = client.generateAuthUrl({
          access_type: 'offline',
          scope: SCOPE,
          prompt: 'consent', // forces refresh_token on repeat
        });
        // Redirect the popup to Google
        res.writeHead(302, { Location: url });
        res.end();
        return;
      }

      case 'oauth_callback': {
        // Exchange code for tokens, save, then postMessage back to opener
        const redirectUri = `${NEXT_PUBLIC_SITE_URL}/api/connectors/sheets?action=oauth_callback`;
        const client = oauthClient(redirectUri);
        const code = req.query.code as string | undefined;

        // We still need the user who initiated this flow
        const uid = await getUserId(req, res);
        if (!uid) {
          res.status(401).send('No session');
          return;
        }

        if (!code) {
          res.status(400).send('Missing code');
          return;
        }

        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);

        // Fetch email
        const oauth2 = google.oauth2({ version: 'v2', auth: client });
        const me = await oauth2.userinfo.get();
        const email = me.data.email || 'unknown';

        await saveTokens(uid, email, tokens);

        // Close the popup + inform the opener
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(`
<!doctype html>
<html>
  <body style="background:#0b0c10;color:#e6f1ef;font-family:system-ui">
    <script>
      try {
        if (window.opener) {
          window.opener.postMessage({ type: 'gsheets:authed', email: ${JSON.stringify(email)} }, '*');
        }
      } catch (e) {}
      window.close();
    </script>
    <p>You can close this window.</p>
  </body>
</html>`);
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
        // List spreadsheets from Drive
        const r = await drive.files.list({
          q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
          fields: 'files(id,name,owners(emailAddress))',
          pageSize: 1000,
        });

        const items = (r.data.files || []).map((f) => ({
          id: f.id!,
          name: f.name || 'Untitled',
          owner_email: f.owners?.[0]?.emailAddress || null,
        }));

        // cache
        await upsertSheetCache(user_id!, items);

        res.status(200).json({ items });
        return;
      }

      case 'list_tabs': {
        const spreadsheetId = req.body?.spreadsheetId || req.query.spreadsheetId;
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

        res.status(200).json({ tabs });
        return;
      }

      case 'test': {
        // Just sanity-check the selection exists in our cache (and the user is connected).
        const conn = await getUserConn(user_id!);
        if (!conn) return res.status(400).json({ ok: false, message: 'Not connected' });

        const selected: string[] = Array.isArray(req.body?.selected) ? req.body.selected : [];
        if (!selected.length) {
          return res.status(200).json({ ok: true, message: 'Connected, but no sheets selected yet.' });
        }

        const supa = admin();
        const { data: rows, error } = await supa
          .from('gs_spreadsheets')
          .select('spreadsheet_id')
          .in('spreadsheet_id', selected)
          .eq('user_id', user_id);
        if (error) throw error;

        const missing = selected.filter(id => !rows?.some(r => r.spreadsheet_id === id));
        if (missing.length) {
          return res.status(400).json({ ok: false, message: `Missing from cache: ${missing.join(', ')}` });
        }

        res.status(200).json({ ok: true });
        return;
      }

      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
        return;
    }
  } catch (e: any) {
    console.error('sheets api error', e);
    res.status(500).json({ error: e?.message || 'Server error' });
  }
}
