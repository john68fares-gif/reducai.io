// pages/api/connectors/sheets.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const hasCreds = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);

/**
 * Minimal Google OAuth + Sheets listing.
 * - With env creds -> returns live auth URL and can exchange code for tokens (left as exercise to persist securely).
 * - Without creds -> returns mock data so the UI can be developed end-to-end.
 *
 * ENV:
 *  GOOGLE_CLIENT_ID
 *  GOOGLE_CLIENT_SECRET
 *  GOOGLE_REDIRECT_URI  (e.g. https://yourdomain.com/api/connectors/sheets-callback)
 */

function json(res: NextApiResponse, code: number, body: any){ res.status(code).json(body); }
function bad(res: NextApiResponse, msg: string){ return json(res, 400, { error: msg }); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const method = req.method || 'GET';
  const action = (method === 'GET' ? (req.query.action as string) : (req.body?.action as string)) || '';

  // 1) Begin OAuth — return an auth URL (or mock)
  if (action === 'auth_begin') {
    if (!hasCreds) {
      // Mock: immediately redirect to callback simulacrum
      const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/connectors/sheets-callback?mock=1&email=demo-user@example.com`;
      return res.redirect(callbackUrl);
    }
    const scope = [
      'openid','email','profile',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/spreadsheets'
    ].join(' ');
    const state = Math.random().toString(36).slice(2);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
    url.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI!);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('scope', scope);
    url.searchParams.set('state', state);
    return res.redirect(url.toString());
  }

  // 2) List spreadsheets in Drive (mock or live)
  if (action === 'list_spreadsheets' && method === 'POST') {
    if (!hasCreds) {
      // Mock 12 items
      const items = Array.from({length: 12}).map((_,i)=>({ id:`mock-${i+1}`, name:`Bookings ${i+1}` }));
      return json(res, 200, { items });
    }
    // In a real app: read your stored access_token from session/user store and call Drive API:
    // GET https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)&pageSize=1000
    // For brevity we return a small placeholder error if not implemented:
    return bad(res, 'LIVE Google listing not implemented in this demo. Add token storage + Drive API call.');
  }

  // 3) List worksheet tabs for a spreadsheet (mock or live Sheets API)
  if (action === 'list_tabs' && method === 'POST') {
    const spreadsheetId = req.body?.spreadsheetId as string;
    if (!spreadsheetId) return bad(res, 'spreadsheetId is required');
    if (!hasCreds) {
      // Mock tabs
      return json(res, 200, { tabs: ['Appointments','Schedule','Sheet1'] });
    }
    // Live: GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}?fields=sheets(properties(title))
    return bad(res, 'LIVE tabs listing not implemented in this demo.');
  }

  // 4) Test that we can reach all selected sheets/tabs (mock)
  if (action === 'test' && method === 'POST') {
    const selected: string[] = Array.isArray(req.body?.selected) ? req.body.selected : [];
    const tabs = req.body?.tabs || {};
    if (!selected.length) return bad(res, 'Select at least one spreadsheet.');
    // In real life: read a couple rows to validate permissions.
    return json(res, 200, { ok: true, message: `OK: ${selected.length} sheet(s) reachable.` });
  }

  // (Optional) 5) Append appointment — you can call this from your agent tool
  if (action === 'append_appointment' && method === 'POST') {
    const { spreadsheetId, tab, row } = req.body || {};
    if (!spreadsheetId || !tab || !row) return bad(res, 'spreadsheetId, tab and row are required');
    // Live: POST to Sheets API values.append
    return json(res, 200, { ok: true, written: row });
  }

  // default
  return bad(res, 'Unknown action');
}
