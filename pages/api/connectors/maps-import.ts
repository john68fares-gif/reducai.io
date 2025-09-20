import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Google Maps (Place) → Facts
 * POST /api/connectors/maps-import
 * body: { query: string }
 *
 * Accepts:
 *  - a full Google Maps URL, or
 *  - plain text like "BrightSmile Dental Austin"
 *
 * Requires: process.env.GOOGLE_MAPS_API_KEY
 *
 * Returns { ok: true, facts: string[], placeId: string }
 * Facts are short bullets usable in your prompt’s [Business Facts] section.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }

  const { query } = (req.body || {}) as { query?: string };
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(400).json({ error: 'Server missing GOOGLE_MAPS_API_KEY' });
  if (!query || !query.trim()) return res.status(400).json({ error: 'Provide { query } (maps link or name + city)' });

  try {
    const normalized = extractQueryFromMapsUrl(query.trim());

    // 1) Find place
    const findURL = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
    findURL.searchParams.set('input', normalized);
    findURL.searchParams.set('inputtype', 'textquery');
    findURL.searchParams.set('fields', 'place_id,name,formatted_address');
    findURL.searchParams.set('key', key);

    const findRes = await fetch(findURL.toString());
    const findJson = await findRes.json();
    const placeId: string | undefined = findJson?.candidates?.[0]?.place_id;
    if (!placeId) return res.status(404).json({ error: 'Place not found' });

    // 2) Details
    const detailsURL = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detailsURL.searchParams.set('place_id', placeId);
    detailsURL.searchParams.set(
      'fields',
      [
        'name',
        'formatted_phone_number',
        'formatted_address',
        'website',
        'opening_hours',
        'types',
        'geometry/location',
        'rating',
        'user_ratings_total',
      ].join(',')
    );
    detailsURL.searchParams.set('key', key);

    const detailsRes = await fetch(detailsURL.toString());
    const detailsJson = await detailsRes.json();
    const p = detailsJson?.result;
    if (!p) return res.status(404).json({ error: 'No details for place' });

    const facts: string[] = [];
    push(facts, 'Official Name', p.name);
    push(facts, 'Address', p.formatted_address);
    push(facts, 'Phone', p.formatted_phone_number);
    push(facts, 'Website', p.website);

    if (p?.opening_hours?.weekday_text?.length) {
      facts.push(`Hours: ${p.opening_hours.weekday_text.join('; ')}`);
    }
    if (typeof p.rating === 'number') {
      facts.push(`Google Rating: ${p.rating} (${p.user_ratings_total || 0} reviews)`);
    }
    if (Array.isArray(p.types) && p.types.length) {
      facts.push(`Categories: ${p.types.join(', ')}`);
    }
    if (p?.geometry?.location?.lat && p?.geometry?.location?.lng) {
      facts.push(`Geo: ${p.geometry.location.lat},${p.geometry.location.lng}`);
    }

    // de-dupe & trim
    const deduped = dedupe(facts).map((s) => s.replace(/\s+/g, ' ').trim());

    return res.status(200).json({ ok: true, facts: deduped, placeId });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Maps lookup failed' });
  }
}

/* ---------------- helpers ---------------- */

function extractQueryFromMapsUrl(q: string) {
  try {
    const u = new URL(q);
    if (!/google\.[^/]+\/maps/i.test(u.hostname + u.pathname)) return q;
    // Prefer the "q" param, else fall back to the whole URL text (Google handles it)
    const qp = u.searchParams.get('q');
    if (qp) return qp;
    return decodeURIComponent(q.href);
  } catch {
    return q;
  }
}

function push(arr: string[], label: string, val?: string | null) {
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
