// pages/api/connectors/sheets.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

function required(name: string, v?: string) {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getOAuth2() {
  const clientId = required('GOOGLE_CLIENT_ID', process.env.GOOGLE_CLIENT_ID);
  const clientSecret = required('GOOGLE_CLIENT_SECRET', process.env.GOOGLE_CLIENT_SECRET);
  const redirectUri = required('GOOGLE_REDIRECT_URI', process.env.GOOGLE_REDIRECT_URI);

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ──────────────────────────────────────────────────────────────────────────────
// This route currently handles ONLY the auth redirect step that’s failing.
// (list_spreadsheets, list_tabs, etc. can be added after auth is fixed.)
// ──────────────────────────────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const action = (req.query.action as string) || '';

    // STEP 1: begin OAuth in a popup → redirect the popup to Google
    if (req.method === 'GET' && action === 'auth_begin') {
      const oauth2 = getOAuth2();

      // Scopes needed to read Drive metadata (to list spreadsheets) + basic profile
      const scopes = [
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'openid',
        'email',
        'profile',
      ];

      const url = oauth2.generateAuthUrl({
        // MUST be "code" for server-side exchange
        response_type: 'code',
        access_type: 'offline',              // get refresh_token
        prompt: 'consent',                    // always ask (ensures refresh_token on repeat)
        include_granted_scopes: true,
        scope: scopes,
        // redirect_uri is taken from the OAuth2 client instance (env must MATCH
        // exactly what you added in Google Cloud Console)
      });

      // Important: do an HTTP redirect (the popup will navigate to Google)
      res.redirect(302, url);
      return;
    }

    // If you hit this route without the known action:
    res.status(400).json({ error: 'Unknown action. Use GET ?action=auth_begin' });
  } catch (err: any) {
    console.error('sheets handler error:', err);
    res.status(500).json({ error: err?.message || 'Server error' });
  }
}
