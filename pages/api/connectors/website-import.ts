import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Website → Facts
 * POST /api/connectors/website-import
 * body: { url: string }
 *
 * Returns { ok: true, facts: string[] } where facts are short, prompt-ready bullets like:
 *   - "Official Name: BrightSmile Dental"
 *   - "Hours: Mon–Fri 9am–5pm; Sat 10am–2pm"
 *   - "Phone: +15551234567"
 *   - "Services: cleaning; whitening; implants"
 *
 * No env vars required. We keep it fast, safe, and de-duped.
 */

const MAX_HTML_BYTES = 1_800_000; // ~1.8MB guardrail

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }

  const { url } = (req.body || {}) as { url?: string };
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Provide a valid http(s) URL.' });
  }

  try {
    const html = await fetchHTML(url);
    if (!html) return res.status(400).json({ error: 'Fetch failed or non-HTML response.' });

    const facts = extractFacts(html);

    // Always return at least something deterministic
    if (!facts.length) return res.status(200).json({ ok: true, facts: ['No obvious facts extracted.'] });

    return res.status(200).json({ ok: true, facts });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to parse site' });
  }
}

/* ---------------- helpers ---------------- */

async function fetchHTML(url: string): Promise<string | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12_000);

  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
    signal: ac.signal,
  }).catch(() => null);
  clearTimeout(t);

  if (!r || !r.ok) return null;

  const ctype = r.headers.get('content-type') || '';
  if (!/text\/html|application\/xhtml\+xml/i.test(ctype)) return null;

  // read with a size cap
  const reader = r.body?.getReader();
  if (!reader) return await r.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
      if (total > MAX_HTML_BYTES) break;
    }
  }
  const buf = concat(chunks, total);
  return new TextDecoder('utf-8').decode(buf);
}

function concat(chunks: Uint8Array[], total: number) {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const dedupe = (arr: string[]) => {
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
};

function safeParseJSON<T = any>(raw: string): T | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractFacts(html: string): string[] {
  const facts: string[] = [];

  // 1) Simple metas
  const title = (html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || '').trim();
  const metaDesc =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    '';
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || '';

  if (ogTitle || title) facts.push(`Site Title: ${(ogTitle || title).trim()}`);
  if (metaDesc) facts.push(`Tagline: ${metaDesc.trim()}`);

  // 2) JSON-LD (Organization/LocalBusiness) for name/address/hours/phone/site
  const ldBlocks = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  ).map((m) => m[1]);

  const ldFacts = fromJsonLd(ldBlocks);
  facts.push(...ldFacts);

  // 3) Plain-text heuristics fallback
  const text = stripTags(html);

  // Hours lines like "Mon-Fri 9am–5pm", "Sat 10:00–14:00", "Sun closed"
  const hours = dedupe(
    Array.from(
      text.matchAll(
        /\b(mon|tue|wed|thu|fri|sat|sun)[^\n]{0,40}?(\d{1,2}(:\d{2})?\s*(am|pm)?\s*[-–]\s*\d{1,2}(:\d{2})?\s*(am|pm)?|closed)/gi
      )
    ).map((m) => normalizeSpaces(m[0]))
  );
  if (hours.length) facts.push(`Hours: ${hours.join('; ')}`);

  // Phones / Emails
  const phones = dedupe(
    Array.from(text.matchAll(/\+?\d[\d\-\s().]{6,}\d/g)).map((m) =>
      '+' + m[0].replace(/[^\d]/g, '').replace(/^(\+)?/, '')
    )
  );
  const emails = dedupe(Array.from(text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)).map((m) => m[0].toLowerCase()));
  if (phones.length) facts.push(`Phone: ${phones.slice(0, 3).join(', ')}`);
  if (emails.length) facts.push(`Email: ${emails.slice(0, 3).join(', ')}`);

  // Service-ish phrases (broad, safe)
  const serviceBullets = dedupe(
    Array.from(
      text.matchAll(
        /\b(cleaning|whitening|implant|invisalign|root canal|x-?ray|checkup|filling|crown|bridge|extraction|emergency visit|menu|espresso|haircut|color|oil change|tune[-\s]?up|massage|facial)\b[^.;]{0,120}/gi
      )
    ).map((m) => capitalizeFirst(normalizeSpaces(m[0])))
  );
  if (serviceBullets.length) facts.push(`Services: ${serviceBullets.slice(0, 12).join('; ')}`);

  // Policies
  const policies = dedupe(
    Array.from(text.matchAll(/\b(cancellation|no[-\s]?show|deposit|refund|warranty|guarantee)[^.;]{0,160}/gi)).map((m) =>
      capitalizeFirst(normalizeSpaces(m[0]))
    )
  );
  if (policies.length) facts.push(`Policies: ${policies.slice(0, 10).join('; ')}`);

  // A few on-page links (helps the assistant reference sources)
  const urls = dedupe(Array.from(html.matchAll(/\bhttps?:\/\/[^\s)"']+/gi)).map((m) => m[0]));
  if (urls.length) facts.push(`Links: ${urls.slice(0, 8).join(', ')}`);

  // Final pass: dedupe again & trim
  return dedupe(facts).map((s) => s.replace(/\s+/g, ' ').trim());
}

function fromJsonLd(blocks: string[]): string[] {
  const out: string[] = [];
  const push = (label: string, value?: string | null) => {
    const v = (value || '').toString().trim();
    if (v) out.push(`${label}: ${v}`);
  };

  for (const raw of blocks) {
    const jd = safeParseJSON<any>(raw);
    if (!jd) continue;
    const nodes: any[] = Array.isArray(jd) ? jd : jd['@graph'] ? [].concat(jd['@graph']) : [jd];

    for (const node of nodes) {
      const type = (Array.isArray(node['@type']) ? node['@type'][0] : node['@type']) || '';
      if (!type) continue;

      // Name / URL
      push('Official Name', node.name || node.legalName);
      push('Website', node.url);

      // Address
      const addr = node.address || {};
      const address =
        addr.streetAddress || addr.addressLocality || addr.addressRegion || addr.postalCode || addr.addressCountry
          ? [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode, addr.addressCountry]
              .filter(Boolean)
              .join(', ')
          : '';
      push('Address', address);

      // Phone
      push('Phone', node.telephone || node.phone);

      // Opening hours
      const oh =
        node.openingHoursSpecification ||
        node.openingHours ||
        (node.hoursAvailable && Array.isArray(node.hoursAvailable) ? node.hoursAvailable : null);

      const hoursLines: string[] = [];
      if (Array.isArray(oh)) {
        for (const spec of oh) {
          const days = [spec.dayOfWeek]
            .flat()
            .filter(Boolean)
            .map((d: string) => (d || '').split('/').pop())
            .join(',');
        const opens = spec.opens || spec.opensAt || spec.opens || '';
          const closes = spec.closes || spec.closesAt || spec.closes || '';
          if (days && (opens || closes)) {
            hoursLines.push(`${days} ${formatTime(opens)}–${formatTime(closes)}`);
          }
        }
      } else if (typeof oh === 'string') {
        hoursLines.push(oh);
      }
      if (hoursLines.length) out.push(`Hours: ${dedupe(hoursLines).join('; ')}`);
    }
  }
  return dedupe(out);
}

function formatTime(t?: string) {
  if (!t) return '';
  // 24h "13:30" → "1:30pm"
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(t.replace(/\s/g, ''));
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const min = m[2] || '00';
  const ampm = h >= 12 ? 'pm' : 'am';
  if (h === 0) h = 12;
  if (h > 12) h -= 12;
  return `${h}:${min}${ampm}`;
}

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, ' ').replace(/\s*[-–]\s*/g, '–').trim();
}
function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
