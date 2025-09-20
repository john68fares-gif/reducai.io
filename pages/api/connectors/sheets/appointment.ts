import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

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

function toMinutes(hhmm: string) {
  const [h, m] = String(hhmm).split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const A1 = toMinutes(aStart), A2 = toMinutes(aEnd);
  const B1 = toMinutes(bStart), B2 = toMinutes(bEnd);
  return Math.max(A1, B1) < Math.min(A2, B2);
}

/**
 * POST body:
 * {
 *   sheetId: string,
 *   sheetName?: string,      // defaults to first tab
 *   date: "YYYY-MM-DD",
 *   startTime: "HH:MM",      // 24h
 *   endTime: "HH:MM",
 *   clientName: string,
 *   phone?: string,
 *   email?: string,
 *   notes?: string
 * }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    sheetId, sheetName, date, startTime, endTime,
    clientName, phone = '', email = '', notes = ''
  } = req.body || {};

  if (!sheetId || !date || !startTime || !endTime || !clientName) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const authClient = auth();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // find tab name if not provided
    let tab = sheetName;
    if (!tab) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      tab = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
    }

    // read existing rows (skip header)
    const range = `${tab}!A2:H`;
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
    const rows: string[][] = (r.data.values || []) as any[];

    // conflict check on same date (Status != "Cancelled")
    const conflicts = rows.filter((row) => {
      const [rowDate, rowStart, rowEnd, , , , , status] = row.map((x) => String(x || '').trim());
      if (rowDate !== date) return false;
      if ((status || '').toLowerCase() === 'cancelled') return false;
      return overlap(startTime, endTime, rowStart, rowEnd);
    });

    if (conflicts.length > 0) {
      return res.status(409).json({ ok: false, conflict: true, message: 'Time slot already taken.' });
    }

    // append new booking row
    const newRow = [date, startTime, endTime, clientName, phone, email, notes, 'Booked'];
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${tab}!A:H`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [newRow] }
    });

    return res.status(200).json({ ok: true, row: newRow });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || 'Booking failed' });
  }
}
