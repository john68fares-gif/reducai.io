// lib/prompt-engine.ts
// Dual-layer prompt engine:
//  - frontendText: professional, longer human-readable prompt for the editor
//  - backendCode/backendString: structured "code" that actually feeds the model
//
// Fully client-safe. No fs, no external calls.

type ApplyOut = {
  frontendText: string;   // pretty version for UI
  backendCode: BackendCode; // JSON object for runtime control
  backendString: string;  // compact system string we feed to the model
  summary: string;        // short description of what changed
};

export const SECTION_ORDER = [
  'Identity',
  'Style',
  'Response Guidelines',
  'Task & Goals',
  'Error Handling / Fallback',
  'Business Facts',
] as const;
type SectionName = (typeof SECTION_ORDER)[number];

const EMPTY: Record<SectionName, string[]> = {
  Identity: [],
  Style: [],
  'Response Guidelines': [],
  'Task & Goals': [],
  'Error Handling / Fallback': [],
  'Business Facts': [],
};

// ─────────────────────────────────────────────────────────────
// Default (already longer & professional out of the box)
// ─────────────────────────────────────────────────────────────
export const DEFAULT_PROMPT = normalizeFullPrompt(`
[Identity]
- You are a helpful, professional AI assistant for this business.
- Represent the brand accurately; be proactive and dependable.
- Focus on moving the conversation toward a clear next step.

[Style]
- Warm, concise, confident. Prefer 2–4 short sentences per turn.
- Use plain language; avoid jargon unless the user expects it.
- Mirror the user’s tone lightly and keep responses structured.

[Response Guidelines]
- Ask one clarifying question when essential info is missing.
- Never fabricate facts; state what you don’t know and propose how to find out.
- When referencing policies or facts, mention the source or uploaded doc if available.
- Summarize next steps at the end for multi-step tasks.

[Task & Goals]
- Qualify the user’s need and propose the next best action (booking, purchase, escalation).
- Offer to collect structured info (name, contact, preferred time) when scheduling or following up.
- Resolve common FAQs and reduce back-and-forth by proactively offering options.

[Error Handling / Fallback]
- If a tool or API fails, apologize briefly and offer an alternative or human handoff.
- If uncertain, ask a specific clarifying question before proceeding.
- Avoid long preambles; keep momentum.

[Business Facts]
- (Auto-filled from uploads: services, hours, pricing ranges, policies, contact, links.)
`.trim());

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Main entry: compile what the user typed into a pretty frontend prompt
 * AND a hidden backend code/object for the model.
 *
 * - If the user pasted a whole prompt, we normalize and translate it.
 * - If they wrote short notes, we route + expand into a professional prompt.
 */
export function compilePrompt(params: {
  basePrompt?: string;                 // current frontend text (optional)
  userText?: string;                   // what the user typed in the generator/editor
  uploadedDocs?: UploadedDoc | UploadedDoc[]; // optional files → [Business Facts]
  enforceProfessionalLength?: boolean; // default true (pads sections a bit)
}): ApplyOut {
  const base = normalizeFullPrompt(
    params.basePrompt && looksLikeFullPrompt(params.basePrompt)
      ? params.basePrompt
      : DEFAULT_PROMPT
  );

  // 1) If user pasted a full prompt, normalize & replace.
  if (params.userText && looksLikeFullPrompt(params.userText)) {
    const pretty = normalizeFullPrompt(params.userText);
    const withFacts = params.uploadedDocs
      ? mergeBusinessFacts(pretty, params.uploadedDocs).merged
      : pretty;

    const frontendText = ensureProfessionalLength(withFacts, params.enforceProfessionalLength !== false);
    const backendCode = buildBackendCode(frontendText);
    return {
      frontendText,
      backendCode,
      backendString: renderBackendString(backendCode),
      summary: 'Replaced with pasted prompt and translated to backend code.',
    };
  }

  // 2) Otherwise, treat user text as instructions to apply on top of base.
  const applied = applyInstructions(base, params.userText || '');
  const withFacts = params.uploadedDocs
    ? mergeBusinessFacts(applied.merged, params.uploadedDocs).merged
    : applied.merged;

  const frontendText = ensureProfessionalLength(withFacts, params.enforceProfessionalLength !== false);
  const backendCode = buildBackendCode(frontendText);

  return {
    frontendText,
    backendCode,
    backendString: renderBackendString(backendCode),
    summary: applied.summary || 'Updated.',
  };
}

// Quick helpers for your UI
export function looksLikeFullPrompt(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  let count = 0;
  for (const s of SECTION_ORDER) {
    const key = `[${s.toLowerCase()}]`;
    if (t.includes(key)) count++;
  }
  return count >= 2;
}

export function normalizeFullPrompt(text: string): string {
  const parsed = parseSections(text);
  const normalized: Record<SectionName, string[]> = { ...EMPTY };
  (Object.keys(parsed) as SectionName[]).forEach((k) => {
    normalized[k] = sanitizeBullets(parsed[k]);
  });
  return renderSections(normalized);
}

// ─────────────────────────────────────────────────────────────
// Translate “frontend prompt” → backend code used by the model
// ─────────────────────────────────────────────────────────────

/** Backend schema the model actually consumes. */
export type BackendCode = {
  version: 'va-1';
  identity: string[];
  style: {
    tone?: string;
    sentencesPerTurn?: string; // e.g. "2-4"
    language?: 'auto' | string;
    structure?: string[];
  };
  guidelines: string[];
  goals: string[];
  fallback: string[];
  businessFacts: string[]; // short, deduped bullets
  // Runtime knobs you can later extend:
  runtime?: {
    languageDetection: boolean;
    fillerPauses?: { minMs?: number; maxMs?: number; useFillerWords?: boolean }; // “um/uh” realism
    phoneCallFilter?: boolean; // slightly narrower-band effect
  };
};

function buildBackendCode(frontendText: string): BackendCode {
  const s = parseSections(frontendText);

  const identity = s.Identity;
  const style = s.Style;
  const guidelines = s['Response Guidelines'];
  const goals = s['Task & Goals'];
  const fallback = s['Error Handling / Fallback'];
  const facts = trimFacts(s['Business Facts']);

  // Extract tone + sentence hints from Style for the code layer
  const tone = pickValue(style, /(tone|warm|friendly|formal|casual|confident|reassuring)/i, 'friendly');
  const sentences = pickValue(style, /(\d[\-–]\d|\d\–\d|\d\s*to\s*\d)\s*short\s*sentences/i, '2–4');
  const language = 'auto';

  return {
    version: 'va-1',
    identity,
    style: {
      tone,
      sentencesPerTurn: sentences?.replace(/\s+/g, ' '),
      language,
      structure: [
        'open_with_ack',
        'ask_clarifying_if_needed',
        'propose_next_best_action',
        'summarize_next_steps_when_multi_step',
      ],
    },
    guidelines,
    goals,
    fallback,
    businessFacts: facts,
    runtime: {
      languageDetection: true,
      fillerPauses: { minMs: 120, maxMs: 260, useFillerWords: false }, // tweak to taste
      phoneCallFilter: true, // “phone call” vibe
    },
  };
}

/** Compact, deterministic system string for the Realtime session. */
function renderBackendString(code: BackendCode): string {
  // Keep this tight; models follow JSON+policy extremely well.
  const meta = {
    v: code.version,
    runtime: code.runtime,
  };

  return [
    `SYSTEM_SPEC::${JSON.stringify(meta)}`,
    `IDENTITY::${jsonList(code.identity)}`,
    `STYLE::${JSON.stringify(code.style)}`,
    `GUIDELINES::${jsonList(code.guidelines)}`,
    `GOALS::${jsonList(code.goals)}`,
    `FALLBACK::${jsonList(code.fallback)}`,
    code.businessFacts.length ? `BUSINESS_FACTS::${jsonList(code.businessFacts)}` : '',
    // Final policy reminders the model should respect:
    'POLICY::Do not fabricate. Ask concise clarifying questions when needed. Keep momentum.',
  ]
    .filter(Boolean)
    .join('\n');
}

function jsonList(arr: string[]) { return JSON.stringify(arr); }

// ─────────────────────────────────────────────────────────────
// Business Facts ingestion (same API you had, kept & refined)
// ─────────────────────────────────────────────────────────────

export type UploadedDoc = { name?: string; text: string } | string;

export function extractBusinessFacts(
  docs: UploadedDoc | UploadedDoc[],
  opts?: { maxFacts?: number; includeDocTags?: boolean }
): string[] {
  const list = Array.isArray(docs) ? docs : [docs];
  const maxFacts = opts?.maxFacts ?? 24;
  const includeDocTags = opts?.includeDocTags ?? true;

  const facts: string[] = [];

  for (const d of list) {
    const name = (typeof d === 'string' ? '' : (d.name || '')).trim();
    const text = (typeof d === 'string' ? d : d.text || '').replace(/\r/g, '\n');
    if (!text) continue;

    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    const push = (s: string) => { if (s) facts.push(s.trim()); };

    // Hours
    const hourRx = /\b(mon(day)?|tue(s(day)?)?|wed(nesday)?|thu(rs(day)?)?|fri(day)?|sat(urday)?|sun(day)?)\b[^\n]*\b(\d{1,2}(:\d{2})?\s*(am|pm)?\s*[-–]\s*\d{1,2}(:\d{2})?\s*(am|pm)?|\bclosed\b)/ig;
    const hoursFound = Array.from(text.matchAll(hourRx)).map(m => m[0].replace(/\s+/g,' ').trim());
    if (hoursFound.length) push(`${docTag(name, includeDocTags)}Hours: ${dedupe(hoursFound).join('; ')}`);

    // Contact
    const phones = dedupe([...text.matchAll(/\+?\d[\d\-\s().]{6,}\d/g)].map(m=>cleanPhone(m[0])));
    if (phones.length) push(`${docTag(name, includeDocTags)}Phone: ${phones.join(', ')}`);

    const emails = dedupe([...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)].map(m=>m[0].toLowerCase()));
    if (emails.length) push(`${docTag(name, includeDocTags)}Email: ${emails.join(', ')}`);

    const urls = dedupe([...text.matchAll(/\bhttps?:\/\/[^\s)]+/ig)].map(m=>m[0].replace(/[),.;:!?]+$/g,'')));
    if (urls.length) push(`${docTag(name, includeDocTags)}Links: ${urls.join(', ')}`);

    const addressLine = lines.find(l => /(suite|ste\.|fl|floor|ave|avenue|st\.|street|rd\.|road|blvd|drive|dr\.|zip|postal)/i.test(l));
    if (addressLine) push(`${docTag(name, includeDocTags)}Address: ${addressLine}`);

    // Services & pricing snippets
    const serviceCandidates = lines
      .filter(l => /^[-•*]\s*/.test(l) && /(service|plan|package|tier|basic|premium|clean|whiten|implant|menu|cut|color|repair|spa)/i.test(l))
      .map(l => l.replace(/^[-•*]\s*/, '').trim());
    if (serviceCandidates.length) push(`${docTag(name, includeDocTags)}Services: ${topN(dedupe(serviceCandidates), 8).join('; ')}`);

    const priceLines = lines.filter(l => /(\$|£|€)\s?\d/.test(l) || /\b(from|starting at)\b/i.test(l));
    if (priceLines.length) push(`${docTag(name, includeDocTags)}Pricing: ${topN(dedupe(priceLines.map(s=>s.replace(/\s+/g,' ').trim())), 6).join('; ')}`);

    const policies = lines.filter(l => /(cancel|cancellation|reschedule|refund|deposit|no[-\s]?show|late fee|warranty|guarantee|returns?)/i.test(l));
    if (policies.length) push(`${docTag(name, includeDocTags)}Policies: ${topN(dedupe(policies.map(s=>s.replace(/\s+/g,' ').trim())), 6).join('; ')}`);
  }

  return topN(dedupe(facts), Math.max(4, maxFacts));
}

export function mergeBusinessFacts(basePrompt: string, facts: string[] | UploadedDoc | UploadedDoc[], opts?: { heading?: string }): { merged: string; summary: string } {
  const bullets = Array.isArray(facts) ? facts : extractBusinessFacts(facts);
  const cleanBullets = sanitizeBullets(bullets.map(b => `- ${b.replace(/^\-\s*/, '')}`));
  const sections = parseSections(
    basePrompt && looksLikeFullPrompt(basePrompt) ? basePrompt : DEFAULT_PROMPT
  );

  const label = normalizeSectionName(opts?.heading || 'Business Facts') as SectionName;
  if (!sections[label]) sections[label] = [];
  cleanBullets.forEach(b => pushUnique(sections[label], b));

  const merged = renderSections(sections);
  const summary = cleanBullets.length
    ? `Merged ${cleanBullets.length} business fact(s) into [${label}].`
    : 'No new facts merged.';
  return { merged, summary };
}

// ─────────────────────────────────────────────────────────────
// Instruction application (kept from your engine, trimmed a bit)
// ─────────────────────────────────────────────────────────────

type Config = {
  preset?: string;
  industry?: string;
  tone?: string;
  persona?: string;
  tasks?: string[];
  channels?: string[];
  freeformLines: string[];
};

export function applyInstructions(basePrompt: string, instructions: string): { merged: string; summary: string } {
  const base = normalizeFullPrompt(basePrompt && looksLikeFullPrompt(basePrompt) ? basePrompt : DEFAULT_PROMPT);
  const baseSections = parseSections(base);

  if (looksLikeFullPrompt(instructions)) {
    const merged = normalizeFullPrompt(instructions);
    return { merged, summary: 'Replaced the entire prompt (manual paste).' };
  }

  const raw = (instructions || '').trim();
  const cfg = extractConfig(raw);
  const working = cloneSections(baseSections);
  const notes: string[] = [];

  if (cfg.tone) { pushUnique(working['Style'], `- Tone: ${toTitle(cfg.tone)}.`); notes.push(`tone=${cfg.tone}`); }
  if (cfg.persona) { pushUnique(working['Identity'], `- Persona: ${cfg.persona}.`); notes.push(`persona=${cfg.persona}`); }
  if (cfg.tasks?.length) { pushUnique(working['Task & Goals'], `- Focus tasks: ${cfg.tasks.map(t => fmtKey(t)).join(', ')}.`); notes.push(`tasks=${cfg.tasks.join(',')}`); }
  if (cfg.channels?.length) { pushUnique(working['Task & Goals'], `- Supported channels: ${cfg.channels.map(c => fmtKey(c)).join(', ')}.`); notes.push(`channels=${cfg.channels.join(',')}`); }

  // Route freeform bullets/sentences
  const route = (line: string) => {
    const l = line.toLowerCase();
    if (/(tone|friendly|formal|concise|emoji|sentence)/.test(l)) pushUnique(working['Style'], `- ${line}`);
    else if (/(ask|clarify|avoid|do not|cite|source|hallucinat)/.test(l)) pushUnique(working['Response Guidelines'], `- ${line}`);
    else if (/(book|schedule|collect|lead|faq|escalat|purchase|checkout)/.test(l)) pushUnique(working['Task & Goals'], `- ${line}`);
    else if (/(error|fallback|fail|retry|handoff|apolog)/.test(l)) pushUnique(working['Error Handling / Fallback'], `- ${line}`);
    else pushUnique(working['Identity'], `- ${line}`);
  };
  cfg.freeformLines.forEach((ln) => route(ln.replace(/^\-\s*/, '').trim()));

  const merged = renderSections(working);
  const summary = notes.length ? `Applied: ${notes.join(' • ')}` : 'Updated.';
  return { merged, summary };
}

// ─────────────────────────────────────────────────────────────
// Parsing/rendering utilities
// ─────────────────────────────────────────────────────────────

function parseSections(text: string): Record<SectionName, string[]> {
  const out: Record<SectionName, string[]> = { ...EMPTY };
  if (!text) return out;

  const regex = /\[([^\]]+)\]\s*([\s\S]*?)(?=\n\[[^\]]+\]|\s*$)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const section = normalizeSectionName(m[1]) as SectionName;
    const body = (m[2] || '').trim();
    if (!(SECTION_ORDER as readonly string[]).includes(section)) continue;

    const bullets = body
      ? sanitizeBullets(
          body.split('\n').map(s => s.trim()).filter(Boolean).map(s => (s.startsWith('-') ? s : `- ${s}`))
        )
      : [];
    out[section] = bullets;
  }
  SECTION_ORDER.forEach((s) => { if (!out[s]) out[s] = []; });
  return out;
}

function renderSections(sections: Record<SectionName, string[]>): string {
  const parts: string[] = [];
  for (const s of SECTION_ORDER) {
    const lines = (sections[s] || []).filter(Boolean);
    parts.push(`[${s}]`);
    if (lines.length) parts.push(lines.join('\n'));
    parts.push('');
  }
  return parts.join('\n').trim() + '\n';
}

// Make it feel “a bit longer & professional” if user typed too little
function ensureProfessionalLength(frontend: string, enforce = true): string {
  if (!enforce) return frontend;
  const sections = parseSections(frontend);
  const minPerSection = 2; // keep it modest, not essay-length
  let changed = false;

  for (const s of SECTION_ORDER) {
    const list = sections[s];
    if (list.length < minPerSection) {
      while (list.length < minPerSection) {
        list.push(defaultFillerFor(s, list.length));
        changed = true;
      }
    }
  }
  return changed ? renderSections(sections) : frontend;
}

function defaultFillerFor(s: SectionName, i: number): string {
  const map: Record<SectionName, string[]> = {
    Identity: [
      '- Act with clarity and integrity; reflect the brand’s values.',
      '- Guide the user smoothly toward outcomes without pressure.',
    ],
    Style: [
      '- Keep paragraphs short; use line breaks for readability.',
      '- Prefer concrete options over vague statements.',
    ],
    'Response Guidelines': [
      '- If the user sounds frustrated, acknowledge feelings briefly and move to solutions.',
      '- Provide numbered steps when giving multi-step instructions.',
    ],
    'Task & Goals': [
      '- Proactively offer two or three options when scheduling or recommending.',
      '- Reduce follow-ups by asking for missing details early.',
    ],
    'Error Handling / Fallback': [
      '- Describe what you will try next when a tool fails.',
      '- Offer a human handoff when confidence is low.',
    ],
    'Business Facts': [
      '- If a policy or price is unclear, state ranges and invite confirmation via provided contacts.',
      '- Include key links or phone when relevant.',
    ],
  };
  return map[s][i % map[s].length];
}

// ─────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────

function sanitizeBullets(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const s = raw.replace(/\s+/g, ' ').trim();
    if (!s) continue;
    const bullet = s.startsWith('-') ? s : `- ${s}`;
    const key = bullet.toLowerCase().replace(/[.;:,]+$/g, '');
    if (!seen.has(key)) { seen.add(key); out.push(bullet); }
  }
  return out;
}
function cloneSections(src: Record<SectionName, string[]>): Record<SectionName, string[]> {
  const out = {} as Record<SectionName, string[]>;
  SECTION_ORDER.forEach((s) => { out[s] = [...(src[s] || [])]; });
  return out;
}
function pushUnique(arr: string[], bullet: string) {
  const b = bullet.trim(); if (!b) return;
  const key = b.toLowerCase().replace(/\s+/g,' ').replace(/[.;:,]+$/g,'');
  if (!arr.some(x => x.toLowerCase().replace(/\s+/g,' ').replace(/[.;:,]+$/g,'') === key)) arr.push(b);
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
  return map[n] || (title(name.trim()) as SectionName);
}
function extractConfig(raw: string): Config {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const cfg: Config = { freeformLines: [] };
  for (const line of lines) {
    if (/[:=]/.test(line) && !line.startsWith('-')) {
      const pairs = line.split(/[;]\s*/).map(s => s.trim()).filter(Boolean);
      for (const p of pairs) {
        const [k0, v0] = p.split(/[:=]/).map(s => (s || '').trim());
        const k = (k0 || '').toLowerCase(); const v = (v0 || '').trim(); if (!k || !v) continue;
        if (k === 'preset' || k === 'industry' || k === 'business') cfg.tone ? null : null; // reserved
        if (k === 'tone') cfg.tone = v;
        else if (k === 'persona') cfg.persona = v;
        else if (k === 'tasks') cfg.tasks = v.split(/[|,]/).map(s => s.trim()).filter(Boolean);
        else if (k === 'channels') cfg.channels = v.split(/[|,]/).map(s => s.trim()).filter(Boolean);
        else cfg.freeformLines.push(`- ${k0}: ${v0}`);
      }
      continue;
    }
    cfg.freeformLines.push(line);
  }
  return cfg;
}
function pickValue(arr: string[], rx: RegExp, fallback?: string) {
  const hit = arr.find(s => rx.test(s));
  if (hit) return hit.replace(/^\-\s*/, '');
  return fallback;
}
function title(s: string) { return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()); }
function fmtKey(s: string) { return s.trim().replace(/[_\-]+/g, ' '); }
function docTag(name: string, enabled: boolean) { return enabled && name ? `[${name}] ` : ''; }
function topN<T>(arr: T[], n = 8): T[] { return arr.slice(0, Math.max(0, n)); }
function dedupe(arr: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const s of arr) { const k = s.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seen.has(k)) { seen.add(k); out.push(s.trim()); } }
  return out;
}
function cleanPhone(s: string) { return s.replace(/[^\d+]/g, '').replace(/^\+?/, '+'); }
function trimFacts(f: string[]) {
  return f.map(x => x.replace(/^\-\s*/, '').trim()).filter(Boolean).slice(0, 32);
}
