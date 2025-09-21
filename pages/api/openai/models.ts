// pages/api/openai/models.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const DISPLAY_ALLOW = [
  // keep this curated & ordered the way you want them to appear
  'gpt-5', 'gpt-5-mini',
  'gpt-4.1', 'gpt-4.1-mini',
  'gpt-4o', 'gpt-4o-mini',
  'o4', 'o4-mini',
  'gpt-4o-realtime-preview', 'gpt-4o-realtime-preview-mini'
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { key } = (req.method === 'POST' ? req.body : {}) as { key?: string };
    if (!key) return res.status(400).json({ error: 'Missing OpenAI key' });

    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: j?.error?.message || 'OpenAI error' });
    }
    const j = await r.json();
    const items: Array<{ id: string }> = Array.isArray(j?.data) ? j.data : [];

    // filter & prettify
    const filtered = items
      .map(m => String(m.id))
      .filter(id =>
        DISPLAY_ALLOW.some(ok => id.toLowerCase().includes(ok.toLowerCase()))
      )
      // remove obvious embeddings/audio/edits/etc
      .filter(id => !/embed|whisper|audio-|tts-|dall|omni\-|vision|ft:/.test(id))
      .sort((a, b) => DISPLAY_ALLOW.findIndex(x => a.includes(x)) - DISPLAY_ALLOW.findIndex(x => b.includes(x)))
      .map(id => ({ value: id, label: labelFor(id) }));

    // de-dupe by value
    const seen = new Set<string>();
    const unique = filtered.filter(m => (seen.has(m.value) ? false : (seen.add(m.value), true)));

    res.status(200).json({ models: unique });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to list models' });
  }
}

function labelFor(id: string) {
  // a tiny normalizer so the dropdown looks clean
  return id
    .replace(/-/g, ' ')
    .replace(/\bmini\b/i, 'Mini')
    .replace(/\brealtime\b/i, 'Realtime')
    .replace(/\bpreview\b/i, 'Preview')
    .replace(/\bgpt\b/i, 'GPT')
    .replace(/\bo4\b/i, 'o4')
    .replace(/\b4o\b/i, '4o')
    .replace(/\b4\.1\b/i, '4.1')
    .replace(/\b5\b/i, '5')
    .replace(/\s+/g, ' ')
    .trim();
}
