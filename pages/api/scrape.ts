import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const url = (req.method === 'POST' ? req.body?.url : req.query?.url) as string | undefined;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing url' });
    }

    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const text = await r.text();
    return res.status(200).json({ ok: true, text });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Failed to fetch URL' });
  }
}
