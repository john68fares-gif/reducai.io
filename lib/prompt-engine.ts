// lib/prompt-engine.ts
// Frontend-safe prompt engine (no fs). Designed for Next.js.
// Recognizes presets, key=value configs, free-form bullets, and now
// supports a dedicated [Business Facts] section for uploads.

type ApplyOut = { merged: string; summary: string };

// ─────────────────────────────────────────────────────────────
// Sections (order matters for rendering)
// ─────────────────────────────────────────────────────────────
export const SECTION_ORDER = [
  'Identity',
  'Style',
  'Response Guidelines',
  'Task & Goals',
  'Error Handling / Fallback',
  'Business Facts', // ← new (optional)
] as const;

type SectionName = (typeof SECTION_ORDER)[number];

const EMPTY_SECTION_BLOCKS: Record<SectionName, string[]> = {
  Identity: [],
  Style: [],
  'Response Guidelines': [],
  'Task & Goals': [],
  'Error Handling / Fallback': [],
  'Business Facts': [],
};

// ─────────────────────────────────────────────────────────────
// Default prompt (kept compatible)
// ─────────────────────────────────────────────────────────────
export const DEFAULT_PROMPT = normalizeFullPrompt(`
[Identity]
- You are a helpful, professional AI assistant for this business.
- Represent the brand accurately and act with integrity.

[Style]
- Clear, concise, friendly. Prefer 2–4 short sentences per turn.
- Use plain language; avoid jargon unless the user expects it.
- Confirm understanding with a brief paraphrase when the request is complex.

[Response Guidelines]
- Ask one clarifying question when essential info is missing.
- Do not fabricate; state what you don’t know and how to find it.
- When referencing external facts, cite/link sources if available.
- Summarize next steps at the end for multi-step tasks.

[Task & Goals]
- Qualify the user’s need, answer FAQs, and guide them to the next action (booking, purchase, escalation).
- Offer to collect structured info (name, contact, timing) when booking or follow-up is needed.

[Error Handling / Fallback]
- If uncertain, ask a specific clarifying question before proceeding.
- If a tool/endpoint fails, apologize briefly and offer an alternative or a human handoff.

[Business Facts]
- (Add hours, services, pricing ranges, policies, links, phone, address here — auto-filled from uploads.)
`.trim());

// -----------------------------
// Public helpers
// -----------------------------
export function looksLikeFullPrompt(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  // Count any two known section headers (case/spacing tolerant)
  let count = 0;
  for (const s of SECTION_ORDER) {
    const key = `[${s.toLowerCase()}]`;
    if (t.includes(key)) count++;
  }
  return count >= 2;
}

export function normalizeFullPrompt(text: string): string {
  const parsed = parsePromptIntoSections(text);
  const normalized: Record<SectionName, string[]> = { ...EMPTY_SECTION_BLOCKS };
  (Object.keys(parsed) as SectionName[]).forEach((k) => {
    normalized[k] = sanitizeBullets(parsed[k]);
  });
  return renderSections(normalized);
}

export function applyInstructions(basePrompt: string, instructions: string): ApplyOut {
  // 1) Start from a normalized base
  const base = normalizeFullPrompt(basePrompt && looksLikeFullPrompt(basePrompt) ? basePrompt : DEFAULT_PROMPT);
  const baseSections = parsePromptIntoSections(base);

  // 2) If user pasted a whole prompt, just normalize & replace
  if (looksLikeFullPrompt(instructions)) {
    const merged = normalizeFullPrompt(instructions);
    return { merged, summary: 'Replaced the entire prompt (manual paste).' };
  }

  // 3) Parse instruction signal: preset:, key=value, freeform
  const raw = (instructions || '').trim();
  const cfg = extractConfig(raw);
  const freeform = cfg.freeformLines;

  // 4) Working copy
  const working = cloneSections(baseSections);

  // 5) Apply preset/industry
  const summaryParts: string[] = [];
  if (cfg.preset || cfg.industry) {
    const presetKey = (cfg.preset || cfg.industry || '').toLowerCase().trim();
    const preset = resolvePreset(presetKey);
    if (preset) {
      applyPreset(working, preset);
      summaryParts.push(`applied preset: ${preset.name}`);
    }
  }

  // 6) Style/tone/persona
  if (cfg.tone) {
    pushUnique(working['Style'], `- Tone: ${toTitle(cfg.tone)}.`);
    summaryParts.push(`tone=${cfg.tone}`);
  }
  if (cfg.persona) {
    pushUnique(working['Identity'], `- Persona: ${cfg.persona}.`);
    summaryParts.push(`persona=${cfg.persona}`);
  }

  // 7) Tasks/channels
  if (cfg.tasks?.length) {
    pushUnique(
      working['Task & Goals'],
      `- Focus tasks: ${cfg.tasks.map(t => formatKey(t)).join(', ')}.`
    );
    summaryParts.push(`tasks=${cfg.tasks.join(',')}`);
  }
  if (cfg.channels?.length) {
    pushUnique(
      working['Task & Goals'],
      `- Supported channels: ${cfg.channels.map(c => formatKey(c)).join(', ')}.`
    );
    summaryParts.push(`channels=${cfg.channels.join(',')}`);
  }

  // 8) Route freeform
  const routedSummary: string[] = [];
  const identityLines: string[] = [];
  const styleLines: string[] = [];
  const guideLines: string[] = [];
  const taskLines: string[] = [];
  const fallbackLines: string[] = [];

  for (const line0 of freeform) {
    const line = line0.trim();
    if (!line) continue;

    const lower = line.toLowerCase();

    // Industry / specialization
    if (
      /assistant\s+for\s+a?n?\s+.+/.test(lower) ||
      /industry\s*:/.test(lower) ||
      /business\s*:/.test(lower)
    ) {
      identityLines.push(`- ${capitalize(cleanTrailingPunctuation(line))}`);
      routedSummary.push(`specialization→Identity`);
      continue;
    }

    // Bullet rules
    if (line.startsWith('-')) {
      const content = line.replace(/^\-\s*/, '').trim();
      if (/(tone|friendly|formal|concise|emoji|sentence)/i.test(content)) {
        styleLines.push(`- ${content}`); routedSummary.push('style bullet');
      } else if (/(ask|clarify|avoid|do not|cite|source|hallucinat)/i.test(content)) {
        guideLines.push(`- ${content}`); routedSummary.push('guidelines bullet');
      } else if (/(book|schedule|collect|lead|faq|escalat|purchase|checkout|conversion|call)/i.test(content)) {
        taskLines.push(`- ${content}`); routedSummary.push('task bullet');
      } else if (/(error|fallback|fail|retry|handoff|apolog)/i.test(content)) {
        fallbackLines.push(`- ${content}`); routedSummary.push('fallback bullet');
      } else if (/(assistant|represent|brand|voice|persona)/i.test(content)) {
        identityLines.push(`- ${content}`); routedSummary.push('identity bullet');
      } else {
        guideLines.push(`- ${content}`); routedSummary.push('guidelines bullet (default)');
      }
      continue;
    }

    // Sentence heuristics
    if (/(tone|write|style|voice)/i.test(lower)) {
      styleLines.push(`- ${line}`); routedSummary.push('style sentence');
    } else if (/(faq|booking|schedule|collect|lead|purchase|escalat)/i.test(lower)) {
      taskLines.push(`- ${line}`); routedSummary.push('task sentence');
    } else if (/(clarify|ask|do not|avoid|cite|source|summarize|steps)/i.test(lower)) {
      guideLines.push(`- ${line}`); routedSummary.push('guidelines sentence');
    } else if (/(error|fallback|tool|endpoint|fail|handoff|apolog)/i.test(lower)) {
      fallbackLines.push(`- ${line}`); routedSummary.push('fallback sentence');
    } else {
      identityLines.push(`- ${line}`); routedSummary.push('identity sentence (default)');
    }
  }

  // Merge routed lines, de-duplicated
  identityLines.forEach(l => pushUnique(working['Identity'], l));
  styleLines.forEach(l => pushUnique(working['Style'], l));
  guideLines.forEach(l => pushUnique(working['Response Guidelines'], l));
  taskLines.forEach(l => pushUnique(working['Task & Goals'], l));
  fallbackLines.forEach(l => pushUnique(working['Error Handling / Fallback'], l));

  // 9) Finalize
  const merged = renderSections(working);
  const summary =
    summaryParts.length || routedSummary.length
      ? `Applied: ${[...summaryParts, ...routedSummary].join(' • ')}`
      : 'Updated.';

  return { merged, summary };
}

// ─────────────────────────────────────────────────────────────
// NEW: Business Facts ingestion for uploaded files
// ─────────────────────────────────────────────────────────────

export type UploadedDoc = { name?: string; text: string } | string;

/**
 * Extract clean bullets (hours, contact, services, pricing, policies, URLs, etc.)
 * from one or more uploaded docs. Client-safe; no external calls.
 */
export function extractBusinessFacts(docs: UploadedDoc | UploadedDoc[], opts?: {
  maxFacts?: number;              // default 24
  includeDocTags?: boolean;       // default true (prefix bullets with [Doc] when helpful)
}): string[] {
  const list = Array.isArray(docs) ? docs : [docs];
  const maxFacts = opts?.maxFacts ?? 24;
  const includeDocTags = opts?.includeDocTags ?? true;

  const facts: string[] = [];

  for (const d of list) {
    const name = (typeof d === 'string' ? '' : (d.name || '')).trim();
    const text = (typeof d === 'string' ? d : d.text || '').replace(/\r/g, '\n');
    if (!text) continue;

    // 1) Pull structured lines
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);

    // 2) Heuristics for common business info
    const push = (s: string) => { if (s) facts.push(s.trim()); };

    // Hours
    const hourRx = /\b(mon(day)?|tue(s(day)?)?|wed(nesday)?|thu(rs(day)?)?|fri(day)?|sat(urday)?|sun(day)?)\b[^\n]*\b(\d{1,2}(:\d{2})?\s*(am|pm)?\s*[-–]\s*\d{1,2}(:\d{2})?\s*(am|pm)?|\bclosed\b)/ig;
    const hoursFound = Array.from(text.matchAll(hourRx)).map(m => cleanSpaces(m[0]));
    if (hoursFound.length) push(`${nameTag(name, includeDocTags)}Hours: ${dedupeStrings(hoursFound).join('; ')}`);

    // Phones / email / address / url
    const phones = dedupeStrings([
      ...Array.from(text.matchAll(/\+?\d[\d\-\s().]{6,}\d/g)).map(m => cleanPhone(m[0]))
    ]).filter(Boolean);
    if (phones.length) push(`${nameTag(name, includeDocTags)}Phone: ${phones.join(', ')}`);

    const emails = dedupeStrings([
      ...Array.from(text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)).map(m => m[0].toLowerCase())
    ]);
    if (emails.length) push(`${nameTag(name, includeDocTags)}Email: ${emails.join(', ')}`);

    const urls = dedupeStrings([
      ...Array.from(text.matchAll(/\bhttps?:\/\/[^\s)]+/ig)).map(m => stripTrailingPunct(m[0]))
    ]);
    if (urls.length) push(`${nameTag(name, includeDocTags)}Links: ${urls.join(', ')}`);

    const addressLine = lines.find(l => /(suite|ste\.|fl|floor|ave|avenue|st\.|street|rd\.|road|blvd|drive|dr\.|zip|postal)/i.test(l));
    if (addressLine) push(`${nameTag(name, includeDocTags)}Address: ${addressLine}`);

    // Services (bullet-ish)
    const serviceCandidates = lines.filter(l =>
      /^[-•*]\s*/.test(l) &&
      /(service|clean|whiten|implant|menu|cut|color|repair|oil|spa|pricing|plan|package|tier|basic|premium)/i.test(l)
    ).map(l => l.replace(/^[-•*]\s*/, '').trim());
    if (serviceCandidates.length) {
      const top = topN(dedupeStrings(serviceCandidates), 8);
      push(`${nameTag(name, includeDocTags)}Services: ${top.join('; ')}`);
    }

    // Pricing
    const prices = lines.filter(l => /(\$|£|€)\s?\d/.test(l) || /\b(from|starting at)\b/i.test(l));
    if (prices.length) push(`${nameTag(name, includeDocTags)}Pricing: ${topN(dedupeStrings(prices.map(cleanSpaces)), 6).join('; ')}`);

    // Policies
    const policies = lines.filter(l => /(cancel|cancellation|reschedule|refund|deposit|no[-\s]?show|late fee|warranty|guarantee|returns?)/i.test(l));
    if (policies.length) push(`${nameTag(name, includeDocTags)}Policies: ${topN(dedupeStrings(policies.map(cleanSpaces)), 6).join('; ')}`);
  }

  // Final pass: dedupe & limit
  return topN(dedupeStrings(facts), Math.max(4, maxFacts));
}

/**
 * Merge the extracted facts into a prompt under [Business Facts].
 */
export function mergeBusinessFacts(basePrompt: string, facts: string[] | UploadedDoc | UploadedDoc[], opts?: {
  heading?: string;   // default 'Business Facts'
}): ApplyOut {
  const bullets = Array.isArray(facts) ? facts : extractBusinessFacts(facts);
  const cleanBullets = sanitizeBullets(bullets.map(b => `- ${b.replace(/^\-\s*/, '')}`));
  const sections = parsePromptIntoSections(
    basePrompt && looksLikeFullPrompt(basePrompt) ? basePrompt : DEFAULT_PROMPT
  );

  const label = normalizeSectionName(opts?.heading || 'Business Facts') as SectionName;
  ensureSection(sections, label);
  cleanBullets.forEach(b => pushUnique(sections[label], b));

  const merged = renderSections(sections);
  const summary = cleanBullets.length
    ? `Merged ${cleanBullets.length} business fact(s) into [${label}].`
    : 'No new facts merged.';

  return { merged, summary };
}

// ─────────────────────────────────────────────────────────────
// Internal utilities
// ─────────────────────────────────────────────────────────────

function parsePromptIntoSections(text: string): Record<SectionName, string[]> {
  const out: Record<SectionName, string[]> = { ...EMPTY_SECTION_BLOCKS };
  if (!text) return out;

  // Split by [Section] (case-insensitive)
  const regex = /\[([^\]]+)\]\s*([\s\S]*?)(?=\n\[[^\]]+\]|\s*$)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const section = normalizeSectionName(m[1]) as SectionName;
    const body = (m[2] || '').trim();
    if (!(SECTION_ORDER as readonly string[]).includes(section)) continue;

    // Turn paragraphs into bullets if needed
    const bullets = body
      ? sanitizeBullets(
          body
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => (s.startsWith('-') ? s : `- ${s}`))
        )
      : [];

    out[section] = bullets;
  }

  // Ensure all expected sections exist
  SECTION_ORDER.forEach((s) => { if (!out[s]) out[s] = []; });
  return out;
}

function renderSections(sections: Record<SectionName, string[]>): string {
  const parts: string[] = [];
  for (const s of SECTION_ORDER) {
    const lines = (sections[s] || []).filter(Boolean);
    parts.push(`[${s}]`);
    if (lines.length === 0) {
      parts.push('');
    } else {
      parts.push(lines.join('\n'));
      parts.push(''); // blank line between sections
    }
  }
  return parts.join('\n').trim() + '\n';
}

function normalizeSectionName(name: string): SectionName {
  const n = (name || '').trim().toLowerCase();
  const map: Record<string, SectionName> = {
    'identity': 'Identity',
    'style': 'Style',
    'response guidelines': 'Response Guidelines',
    'guidelines': 'Response Guidelines',
    'task & goals': 'Task & Goals',
    'tasks & goals': 'Task & Goals',
    'task and goals': 'Task & Goals',
    'error handling / fallback': 'Error Handling / Fallback',
    'error handling': 'Error Handling / Fallback',
    'fallback': 'Error Handling / Fallback',
    'business facts': 'Business Facts',
    'facts': 'Business Facts',
    'knowledge': 'Business Facts',
    'kb': 'Business Facts',
  };
  return map[n] || (toTitle(name.trim()) as SectionName);
}

function sanitizeBullets(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const s = raw.replace(/\s+/g, ' ').trim();
    if (!s) continue;
    const bullet = s.startsWith('-') ? s : `- ${s}`;
    const key = normalizeKey(bullet);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(bullet);
    }
  }
  return out;
}

function cloneSections(src: Record<SectionName, string[]>): Record<SectionName, string[]> {
  const out = {} as Record<SectionName, string[]>;
  SECTION_ORDER.forEach((s) => { out[s] = [...(src[s] || [])]; });
  return out;
}

function pushUnique(arr: string[], bullet: string) {
  const b = bullet.trim();
  if (!b) return;
  if (!arr.some(x => normalizeKey(x) === normalizeKey(b))) arr.push(b);
}

function ensureSection(obj: Record<SectionName, string[]>, name: SectionName) {
  if (!obj[name]) obj[name] = [];
}

function normalizeKey(s: string) {
  return s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/[.;:,]+$/g, '');
}

function toTitle(s: string) {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}
function formatKey(s: string) { return s.trim().replace(/[_\-]+/g, ' '); }
function cleanTrailingPunctuation(s: string) { return s.replace(/[.?!\s]+$/g, ''); }
function capitalize(s: string) {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
function cleanSpaces(s: string) { return s.replace(/\s+/g, ' ').trim(); }
function stripTrailingPunct(s: string) { return s.replace(/[),.;:!?]+$/g, ''); }
function nameTag(name: string, enabled: boolean) { return enabled && name ? `[${name}] ` : ''; }
function topN<T>(arr: T[], n = 8): T[] { return arr.slice(0, Math.max(0, n)); }
function dedupeStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seen.has(k)) { seen.add(k); out.push(s.trim()); }
  }
  return out;
}
function cleanPhone(s: string) {
  return s.replace(/[^\d+]/g, '').replace(/^\+?/, '+');
}

// -----------------------------
// Config extraction
// -----------------------------
type Config = {
  preset?: string;
  industry?: string;
  tone?: string;
  persona?: string;
  tasks?: string[];
  channels?: string[];
  freeformLines: string[];
};

function extractConfig(raw: string): Config {
  // Accept lines like:
  // preset: dentist
  // industry=dentist; tone=friendly; tasks=lead_qualification,booking; channels=voice,chat
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const cfg: Config = { freeformLines: [] };

  for (const line of lines) {
    // key=value; key=value; ...
    if (/[:=]/.test(line) && !line.startsWith('-')) {
      const pairs = line.split(/[;]\s*/).map(s => s.trim()).filter(Boolean);
      for (const p of pairs) {
        const [k0, v0] = p.split(/[:=]/).map(s => (s || '').trim());
        const k = (k0 || '').toLowerCase();
        const v = (v0 || '').trim();
        if (!k || !v) continue;
        if (k === 'preset') cfg.preset = v;
        else if (k === 'industry' || k === 'business') cfg.industry = v;
        else if (k === 'tone') cfg.tone = v;
        else if (k === 'persona') cfg.persona = v;
        else if (k === 'tasks') cfg.tasks = v.split(/[|,]/).map(s => s.trim()).filter(Boolean);
        else if (k === 'channels') cfg.channels = v.split(/[|,]/).map(s => s.trim()).filter(Boolean);
        else {
          // Unknown config keys are treated as freeform guidance
          cfg.freeformLines.push(`- ${k0}: ${v0}`);
        }
      }
      continue;
    }

    // "preset: X" on its own
    const m = /^preset\s*[:=]\s*(.+)$/i.exec(line);
    if (m) { cfg.preset = m[1].trim(); continue; }

    // keep as freeform
    cfg.freeformLines.push(line);
  }

  return cfg;
}

// -----------------------------
// Presets (kept minimal and editable)
// -----------------------------
type Preset = {
  name: string;
  identity?: string[];
  style?: string[];
  guidelines?: string[];
  tasks?: string[];
  fallback?: string[];
};

function resolvePreset(key: string): Preset | null {
  const k = key.trim().toLowerCase();

  // aliases you can expand later
  const alias: Record<string, string> = {
    'dentist': 'dental_clinic',
    'dental': 'dental_clinic',
    'dental clinic': 'dental_clinic',
    'dental practice': 'dental_clinic',
    'dentistry': 'dental_clinic',
    'restaurant': 'restaurant',
    'salon': 'salon',
  };
  const canon = alias[k] || k;

  switch (canon) {
    case 'dental_clinic':
      return {
        name: 'Dental Clinic',
        identity: [
          'You are a patient-first assistant for a modern dental clinic.',
          'Represent the clinic professionally, focusing on clarity, empathy, and privacy.',
        ],
        style: [
          'Warm, reassuring, concise. Avoid medical jargon unless asked.',
          'Use 2–4 short sentences per turn.',
        ],
        guidelines: [
          'Never give definitive diagnoses; provide general guidance and recommend in-person evaluation if needed.',
          'For cost/insurance, state ranges and suggest confirming exact coverage with the clinic.',
          'When referencing clinical recommendations, mention source types (ADA, peer-reviewed) if available.',
        ],
        tasks: [
          'Qualify patient needs (pain level, duration, urgency).',
          'Offer appointment options and collect: full name, phone/email, preferred time, reason for visit.',
          'Answer FAQs (cleanings, fillings, whitening, Invisalign, emergency visits).',
          'Escalate emergencies: advise calling the clinic or local emergency line as appropriate.',
        ],
        fallback: [
          'If uncertain about medical advice, suggest contacting a licensed dentist at the clinic.',
          'If scheduling API fails, offer to take contact info for a callback.',
        ],
      };
    case 'restaurant':
      return {
        name: 'Restaurant',
        identity: ['You are a courteous host for a busy restaurant.'],
        style: ['Friendly, fast, to the point.'],
        guidelines: ['Collect date/time/party size/name/phone. Mention policies when relevant.'],
        tasks: ['Table reservations', 'Menu & dietary questions', 'Wait times & directions'],
        fallback: ['Offer nearest two time slots if preferred slot is unavailable.'],
      };
    case 'salon':
      return {
        name: 'Salon',
        identity: ['You are a chic salon’s virtual coordinator.'],
        style: ['Trendy but clear. Confirm duration and stylist match.'],
        guidelines: ['Collect service, stylist preference, date/time, name, phone.'],
        tasks: ['Service selection', 'Stylist matching', 'Appointment booking'],
        fallback: ['If a stylist is unavailable, offer next two times or alternatives.'],
      };
    default:
      return null;
  }
}

function applyPreset(target: Record<SectionName, string[]>, preset: Preset) {
  if (preset.identity?.length) preset.identity.forEach(s => pushUnique(target['Identity'], `- ${s}`));
  if (preset.style?.length) preset.style.forEach(s => pushUnique(target['Style'], `- ${s}`));
  if (preset.guidelines?.length) preset.guidelines.forEach(s => pushUnique(target['Response Guidelines'], `- ${s}`));
  if (preset.tasks?.length) preset.tasks.forEach(s => pushUnique(target['Task & Goals'], `- ${s}`));
  if (preset.fallback?.length) preset.fallback.forEach(s => pushUnique(target['Error Handling / Fallback'], `- ${s}`));
}
