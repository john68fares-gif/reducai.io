import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { google } from 'googleapis';

async function sheetsClient() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const session = await getServerSession(req, res, authOptions as any);
  if (!session?.user) return res.status(401).json({ ok: false, error: 'unauthenticated' });

  const { fullName, heardFrom } = req.body || {};
  const user = session.user as any;

  try {
    const sheets = await sheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    const now = new Date().toISOString();
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Signups!A:Z', // create a "Signups" sheet tab
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          now,
          user.id || '',            // from our session callback
          user.email || '',
          user.name || '',
          fullName || '',
          heardFrom || '',
          'google',                 // provider
          ip, ua
        ]],
      },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error('sheets append error', e?.message);
    return res.status(500).json({ ok: false, error: 'sheets_error' });
  }
}
