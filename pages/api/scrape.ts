// pages/api/scrape.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/** Per-site hard cap — keeps things snappy */
const MAX_PER_SITE = 12_000;

/** Very small entity decoder so we don't need extra deps */
function decodeEntities(input: string) {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/** Strip tags & noisy blocks. This is intentionally conservative and fast. */
function htmlToPlainText(html: string): string {
  // remove script/style/noscript/svg/math tags entirely
  const withoutCode = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<math[\s\S]*?<\/math>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<canvas[\s\S]*?<\/canvas>/gi, '');

  // replace block-level tags with line breaks to keep some structure
  const withBreaks = withoutCode
    .replace(/<\/(p|div|section|article|header|footer|li|ul|ol|h[1-6]|br|hr)>/gi, '\n')
    .replace(/<(br|hr)\s*\/?>/gi, '\n');

  // drop the rest of the tags
  const noTags = withBreaks.replace(/<[^>]+>/g, ' ');

  // decode entities and collapse whitespace
  const decoded = decodeEntities(noTags);
  const squashed = decoded.replace(/\r+/g, '\n').replace(/\t+/g, ' ');
  const collapsed = squashed
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

  // limit per-site to keep it safe
  if (collapsed.length > MAX_PER_SITE) {
    return collapsed.slice(0, MAX_PER_SITE) + '\n[…truncated]';
  }
  return collapsed;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const url = String(req.query.url || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      res.status(400).send('Invalid or missing ?url=');
      return;
    }

    const response = await fetch(url, {
      // make it harder to be blocked
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      // follow up to a couple of redirects
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();

    // If it's HTML, sanitize → text; otherwise, return as-is (but still capped)
    let out = contentType.includes('html') ? htmlToPlainText(raw) : raw;

    if (out.length > MAX_PER_SITE) {
      out = out.slice(0, MAX_PER_SITE) + '\n[…truncated]';
    }

    // Return plain text (no JSON wrapper)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(out);
  } catch (e: any) {
    res.status(500).send('Failed to fetch content.');
  }
}
