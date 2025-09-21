// pages/api/connectors/sheets-callback.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * This page runs in the popup window. It:
 *  - Exchanges ?code for tokens (in a real build — omitted here)
 *  - Extracts the signed-in email (mock/live)
 *  - Notifies the opener with window.postMessage({type:'gsheets:authed', email})
 *  - Closes the popup
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, mock, email } = req.query as { code?: string; mock?: string; email?: string };

  // In a real app: exchange `code` with Google, fetch profile email.
  const resolvedEmail = email || 'user@example.com';

  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Google Sheets Connected</title></head>
  <body style="background:#0b0c10;color:#e6f1ef;font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="padding:24px">
      <h1 style="font-size:16px;margin:0 0 12px">Google account linked</h1>
      <p style="opacity:.8;margin:0 0 16px">You can close this window.</p>
    </div>
    <script>
      (function(){
        try {
          const payload = { type: 'gsheets:authed', email: ${JSON.stringify(resolvedEmail)} };
          if (window.opener) {
            window.opener.postMessage(payload, '*');
          } else if (window.parent) {
            window.parent.postMessage(payload, '*');
          }
        } catch(_) {}
        setTimeout(function(){ window.close(); }, 400);
      })();
    </script>
  </body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}
