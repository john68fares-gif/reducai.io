import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

function parseSheetIdFromUrl(url: string) {
  const m = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

function auth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('Missing Google service account env vars.');
  const jwt = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return jwt;
}

async function readHeaders(sheets: any, sheetId: string, sheetName: string) {
  const range = `${sheetName}!A1:H1`;
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  return (r.data.values?.[0] || []).map((s: string) => String(s).trim());
}

function makePromptChunk(meta: { sheetName: string; sheetId: string }) {
  return `
[Notes]
Google Sheets connected for appointments.
- Spreadsheet ID: ${meta.sheetId}
- Sheet (tab): ${meta.sheetName}

Booking tool rules:
- Before adding a new appointment, read the sheet and ensure the time window does not overlap any existing row where Status != "Cancelled".
- Use schema:
  Date (YYYY-MM-DD) | Start Time (HH:MM, 24h) | End Time (HH:MM) | Client Name | Phone | Email | Notes | Status
- On success, append a new row with Status="Booked".
- If conflict, ask for another time.`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // two modes: (1) connect/import, (2) booking sub-route delegated below
  const { url, agentId, sheetName } = req.body || {};
  const sheetId = parseSheetIdFromUrl(String(url || ''));
  if (!sheetId) return res.status(400).json({ error: 'Invalid Google Sheet URL.' });

  try {
    const authClient = auth();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // pick a sheet name: provided or first sheet
    let tabName = sheetName?.trim();
    if (!tabName) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      tabName = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
    }

    // sanity: ensure headers exist (we just read row 1)
    const headers = await readHeaders(sheets, sheetId, tabName);
    if (headers.length < 4) {
      return res.status(400).json({ error: 'Sheet missing headers row. Please create row 1 as documented.' });
    }

    const promptChunk = makePromptChunk({ sheetName: tabName, sheetId });
    return res.status(200).json({ ok: true, sheetId, sheetName: tabName, promptChunk });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || 'Sheets connect failed' });
  }
}
