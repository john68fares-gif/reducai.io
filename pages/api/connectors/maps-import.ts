import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * OpenStreetMap (Nominatim) → Facts
 * POST /api/connectors/maps-import
 * body: { query: string }
 *
 * No API key required. Works on Vercel or any Node host.
 * Respect Nominatim usage policy (set a descriptive User-Agent; avoid spamming).
 *
 * Returns: { ok: true, facts: string[], placeId: string, lat:number, lng:number }
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }

  const { query } = (req.body || {}) as { query?: string };
  if (!query || !query.trim()) return res.status(400).json({ error: 'Provide { query } (business name + city or a maps link)' });

  try {
    const q = normalizeQuery(query.trim());

    // 1) Search Nominatim
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '1');
    url.searchParams.set('limit', '1');

    const headers: Record<string, string> = {
      // Add a descriptive UA for politeness & policy compliance.
      'User-Agent': `YourApp/1.0 (${process.env.VERCEL_URL || 'no-host'}; contact: support@yourapp.invalid)`,
      'Accept': 'application/json'
    };

    const r = await fetch(url.toString(), { headers, cache: 'no-store' });
    if (!r.ok) return res.status(400).json({ error: `Search failed (${r.status})` });
    const list = await r.json();

    const hit = Array.isArray(list) && list[0];
    if (!hit) return res.status(404).json({ error: 'Place not found' });

    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    const placeId = String(hit.place_id);
    const name = extractName(hit);
    const address = formatAddress(hit?.address);
    const website = hit?.extratags?.website || hit?.extratags?.contact_website || '';
    const phone =
      hit?.extratags?.phone ||
      hit?.extratags?.contact_phone ||
      hit?.extratags?.contact_mobile ||
      '';
    const opening = hit?.extratags?.opening_hours || '';
    const categories = [
      hit?.class,
      hit?.type,
      hit?.category,
      ...(hit?.extratags?.cuisine ? [hit.extratags.cuisine] : []),
    ]
      .filter(Boolean)
      .map(String);

    // 2) Build prompt-friendly facts
    const facts: string[] = [];
    push(facts, 'Official Name', name);
    push(facts, 'Address', address);
    push(facts, 'Phone', normalizePhone(phone));
    push(facts, 'Website', website);
    if (opening) facts.push(`Hours (OSM): ${opening}`);
    if (categories.length) facts.push(`Categories: ${dedupe(categories).join(', ')}`);
    facts.push(`Geo: ${lat},${lng}`);

    // 3) Clean/dedupe
    const cleaned = dedupe(facts).map(s => s.replace(/\s+/g, ' ').trim());

    return res.status(200).json({ ok: true, facts: cleaned, placeId, lat, lng });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Lookup failed' });
  }
}

/* ---------------- helpers ---------------- */

function normalizeQuery(input: string) {
  // If they pasted some map URL, try to salvage the text query part;
  // otherwise just pass through (Nominatim handles free text well).
  try {
    const u = new URL(input);
    const q = u.searchParams.get('q') || u.searchParams.get('query') || '';
    return q || decodeURIComponent(u.pathname.replace(/\/+/g, ' ').trim());
  } catch {
    return input;
  }
}

function extractName(hit: any): string {
  // Prefer a display_name first part; else namedetails if present.
  const dn: string = hit?.display_name || '';
  const firstComma = dn.indexOf(',');
  const head = firstComma > 0 ? dn.slice(0, firstComma) : dn;
  const namedetails = hit?.namedetails?.name || '';
  return (namedetails || head || '').trim();
}

function formatAddress(addr: any) {
  if (!addr) return '';
  const parts = [
    addr.house_number && addr.road ? `${addr.house_number} ${addr.road}` : (addr.road || ''),
    addr.neighbourhood || addr.suburb || '',
    addr.city || addr.town || addr.village || addr.county || '',
    addr.state || '',
    addr.postcode || '',
    addr.country || '',
  ]
    .map((s: string) => (s || '').trim())
    .filter(Boolean);
  return dedupe(parts).join(', ');
}

function normalizePhone(p?: string) {
  if (!p) return '';
  return p.replace(/[^\d+]/g, '').replace(/^\+?/, '+');
}

function push(arr: string[], label: string, val?: string) {
  const v = (val || '').toString().trim();
  if (v) arr.push(`${label}: ${v}`);
}

function dedupe(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!k) continue;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s.trim());
    }
  }
  return out;
}
