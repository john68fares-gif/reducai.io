// pages/api/openai/models.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Curated model list for dropdowns.
 * - Pulls only models the key actually has access to (via /v1/models).
 * - Filters to a rich allow-list that matches what's shown in screenshots:
 *   GPT-5 family, 4.1 family, 4o family (incl. realtime/audio), o-series, o3*, open-weight, etc.
 * - Adds clean labels and tiny badges.
 */

type ModelOut = { value: string; label: string };

// Order matters for sorting (most “frontier / general-purpose” first)
const DISPLAY_ALLOW_ORDERED: Array<RegExp> = [
  // Frontier / general-purpose
  /\bgpt-5($|[-_.])/i,
  /\bgpt-5-mini($|[-_.])/i,
  /\bgpt-5-nano($|[-_.])/i,

  /\bgpt-4\.1($|[-_.])/i,
  /\bgpt-4\.1-mini($|[-_.])/i,
  /\bgpt-4\.1-nano($|[-_.])/i,

  // 4o family (text+vision+audio capable)
  /\bgpt-4o($|[-_.])/i,
  /\bgpt-4o-mini($|[-_.])/i,
  /\bgpt-4o-realtime($|[-_.])/i,          // includes preview / mini
  /\bgpt-4o(-mini)?-audio($|[-_.])/i,

  // o-series + research models
  /\bo4($|[-_.])/i,
  /\bo4-mini($|[-_.])/i,
  /\bo4-mini-deep-research($|[-_.])/i,
  /\bo3($|[-_.])/i,
  /\bo3-pro($|[-_.])/i,
  /\bo3-deep-research($|[-_.])/i,

  // Realtime & Audio generic
  /\bgpt-realtime($|[-_.])/i,
  /\bgpt-audio($|[-_.])/i,

  // Open-weight (if exposed via your key)
  /\bgpt-oss-120b($|[-_.])/i,
  /\bgpt-oss-20b($|[-_.])/i,
];

// Things we never want in the dropdown
const EXCLUDE = [
  /embed/i,
  /\bwhisper\b/i,
  /\b(edits?|instruct)\b/i,
  /\bvision\b/i,
  /\bomni-\w+/i,
  /\bsearch[-_.]/i,
  /\bmoderation\b/i,
  /\bcodex\b/i,
  /\bdall[eE]/i,
  /\bft:/i,
  /\bdeprecated\b/i,                 // you can remove this if you actually want to show deprecated
  /\bchatgpt[-_.]/i,                 // ChatGPT-only models (not for API use)
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const keyFromHeader = String(req.headers['x-openai-key'] || '');
    const { key: keyFromBody } = (req.method === 'POST' ? req.body : {}) as { key?: string };
    const key = keyFromHeader || keyFromBody;

    if (!key) return res.status(400).json({ error: 'Missing OpenAI key' });

    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: j?.error?.message || 'OpenAI error' });
    }

    const j = await r.json();
    const items: Array<{ id: string }> = Array.isArray(j?.data) ? j.data : [];

    // Filter to our curated set
    const allowed = items
      .map((m) => String(m.id || ''))
      .filter((id) => {
        if (!id) return false;
        if (EXCLUDE.some((rx) => rx.test(id))) return false;
        return DISPLAY_ALLOW_ORDERED.some((rx) => rx.test(id));
      });

    // Sort according to the order of DISPLAY_ALLOW_ORDERED
    allowed.sort((a, b) => rank(a) - rank(b));

    // Make them pretty and dedupe
    const seen = new Set<string>();
    const models: ModelOut[] = allowed
      .map((id) => ({ value: id, label: toLabel(id) }))
      .filter((m) => (seen.has(m.value) ? false : (seen.add(m.value), true)));

    if (!models.length) {
      // Fallback list (shown if your key doesn't have access yet)
      res.status(200).json({
        models: [
          { value: 'gpt-5', label: 'GPT 5' },
          { value: 'gpt-5-mini', label: 'GPT 5 Mini' },
          { value: 'gpt-4.1', label: 'GPT 4.1' },
          { value: 'gpt-4o', label: 'GPT 4o' },
          { value: 'gpt-4o-realtime-preview', label: 'GPT 4o Realtime Preview' },
          { value: 'o4', label: 'o4' },
          { value: 'o3', label: 'o3' },
          { value: 'gpt-realtime', label: 'GPT Realtime' },
          { value: 'gpt-audio', label: 'GPT Audio' },
        ],
      });
      return;
    }

    res.status(200).json({ models });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to list models' });
  }
}

function rank(id: string): number {
  const i = DISPLAY_ALLOW_ORDERED.findIndex((rx) => rx.test(id));
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

function toLabel(id: string): string {
  const raw = id.trim();

  // Quick badge detection
  const badge =
    /\brealtime\b/i.test(raw) ? 'Realtime' :
    /\baudio\b/i.test(raw) ? 'Audio' :
    /\boss\b/i.test(raw) ? 'Open-weight' :
    /\bdeprecated\b/i.test(raw) ? 'Deprecated' :
    '';

  // Human label
  let label = raw
    .replace(/-/g, ' ')
    .replace(/\bmini\b/gi, 'Mini')
    .replace(/\bnano\b/gi, 'Nano')
    .replace(/\brealtime\b/gi, 'Realtime')
    .replace(/\bpreview\b/gi, 'Preview')
    .replace(/\baudio\b/gi, 'Audio')
    .replace(/\boss\b/gi, 'OSS')
    .replace(/\bgpt\b/gi, 'GPT')
    .replace(/\bo4\b/gi, 'o4')
    .replace(/\b4o\b/gi, '4o')
    .replace(/\b4\.1\b/gi, '4.1')
    .replace(/\b5\b/gi, '5')
    .replace(/\s+/g, ' ')
    .trim();

  // Append badge subtly
  if (badge && !/\b(Realtime|Audio|Open-weight|Deprecated)\b/.test(label)) {
    label = `${label} ${badge}`;
  }
  return label;
}
