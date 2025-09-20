import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

/**
 * Google Sheets connector (read + append)
 * 
 * GET  /api/connectors/sheets?spreadsheetId=...&range=Sheet!A2:E
 * POST /api/connectors/sheets
 *   body: {
 *     spreadsheetId: string,
 *     range: string,                 // e.g., 'Bookings!A2'
 *     values?: string[],             // append raw row
 *     object?: Record<string, any>,  // optional: append with object mapped to header row
 *     headerRange?: string           // optional: defaults to 'Bookings!A1:Z1' if using object
 *   }
 *
 * Env:
 *   - GOOGLE_SA_JSON_BASE64  (required)  base64 of your service account JSON
 *   - SHEETS_BEARER          (optional)  simple shared secret for requests
 */

function getAuth() {
  const b64 = process.env.GOOGLE_SA_JSON_BASE64 || '';
  if (!b64) throw new Error('Missing env GOOGLE_SA_JSON_BASE64');
  const creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  return new google.auth.JWT(creds.client_email, undefined, creds.private_key, scopes);
}

function requireBearer(req: NextApiRequest) {
  const secret = process.env.SHEETS_BEARER;
  if (!secret) return; // no guard configured
  const hdr = (req.headers.authorization || '').trim(); // "Bearer abc"
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : '';
  if (token !== secret) throw new Error('Unauthorized');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    requireBearer(req);
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    if (req.method === 'GET') {
      const { spreadsheetId, range } = req.query as { spreadsheetId?: string; range?: string };
      if (!spreadsheetId || !range) {
        return res.status(400).json({ error: 'Provide spreadsheetId & range' });
      }
      const r = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const values = r.data.values || [];

      // Try to infer headers if they included row 1; otherwise return raw
      const looksLikeHeader = values.length && values[0]?.some?.((c: string) => /date|time|status|provider/i.test(c || ''));
      const data = looksLikeHeader ? values.slice(1) : values;
      const headers = looksLikeHeader ? values[0] : null;

      return res.status(200).json({ ok: true, values: data, headers });
    }

    if (req.method === 'POST') {
      const { spreadsheetId, range, values, object, headerRange } = (req.body || {}) as {
        spreadsheetId?: string;
        range?: string;
        values?: any[];
        object?: Record<string, any>;
        headerRange?: string;
      };

      if (!spreadsheetId || !range) {
        return res.status(400).json({ error: 'Provide spreadsheetId & range' });
      }

      // Mode 1: plain array append
      if (Array.isArray(values)) {
        const r = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [values] },
        });
        return res.status(200).json({ ok: true, updates: r.data.updates });
      }

      // Mode 2: object append (maps to header row)
      if (object && typeof object === 'object') {
        const hdrRange = headerRange || guessHeaderRange(range);
        const hdrResp = await sheets.spreadsheets.values.get({ spreadsheetId, range: hdrRange });
        const headers = (hdrResp.data.values || [])[0] || [];
        if (!headers.length) {
          return res.status(400).json({ error: `Header row empty at ${hdrRange}` });
        }

        const row = headers.map((h: string) => formatCell(object[h] ?? object[normalizeKey(h)] ?? ''));
        const r = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [row] },
        });
        return res.status(200).json({ ok: true, headers, row, updates: r.data.updates });
      }

      return res.status(400).json({ error: 'Provide either values[] or object{} to append' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const code = /unauthorized/i.test(msg) ? 401 : 500;
    return res.status(code).json({ error: msg });
  }
}

/* ---------------- helpers ---------------- */

function normalizeKey(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function guessHeaderRange(appendRange: string) {
  // e.g., 'Bookings!A2' -> 'Bookings!A1:Z1'
  const m = /^([^!]+)!(.+)$/.exec(appendRange);
  if (!m) return 'A1:Z1';
  const sheet = m[1];
  return `${sheet}!A1:Z1`;
}

function formatCell(v: any) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
