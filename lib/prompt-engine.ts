/* =========================================================
   Prompt Engine v2 — Presets + Config Builder + Safe Merge
   =========================================================

   What’s new:
   - buildPromptFromConfig(config): compose a complete, production prompt.
   - parseFreeFormConfig(text): accept "industry=..., tasks=..., tone=..." etc.
   - presets: scalable registry (add thousands by data, not code).
   - generateFromPreset/presetOrMerge: easy entry points.
   - Backwards compatible: looksLikeFullPrompt, normalizeFullPrompt,
     applyInstructions still work.

   Shape of a config you can pass or express in free text:
     {
       industry: 'dentist' | 'real_estate' | ...,
       tone: 'friendly' | 'formal' | 'playful' | 'authoritative' | ...,
       channels: ['voice','chat'],          // affects brevity & turn-taking
       language: 'English' | 'Spanish' | 'Dutch' | 'Arabic' | ...
       tasks: ['lead_qualification','booking','faq','triage', ...],
       safety: { sensitive: true, escalation: true },
       extraction: { name: 'Lead', schema: [{key:'full_name', type:'string', required:true}, ...] },
       disclaimers: ['not_legal_advice', 'not_medical_advice'],
       brand: { name: 'Acme Dental', tagline: 'Gentle care, great smiles.' },
       constraints: { maxWords: 180, askBeforeBooking: true }
     }

   You can pack that as:
     industry=dentist; tone=friendly; tasks=lead_qualification,booking; channels=voice,chat; language=English
     brand.name=Acme Dental; brand.tagline=Gentle care, great smiles.
     extraction.name=Lead; extraction.schema=full_name:string!,email:string!,phone:string?,notes:string
========================================================= */

export const PROMPT_SKELETON = [
  '[Identity]',
  '',
  '[Style]',
  '',
  '[Response Guidelines]',
  '',
  '[Task & Goals]',
  '',
  '[Error Handling / Fallback]',
].join('\n');

export const DEFAULT_PROMPT = `[Identity]
You are a versatile AI assistant capable of adapting to a wide range of tasks and user needs. Your role is to efficiently assist users by providing accurate information, helpful guidance, and relevant suggestions.

[Style]
- Use a clear and formal tone to ensure understanding.
- Be friendly and approachable without being overly casual.
- Customize the language to suit the context and user preferences when possible.

[Response Guidelines]
- Strive for brevity and clarity in all responses.
- Limit technical jargon unless necessary for comprehension.
- Use straightforward language and avoid ambiguous terms.

[Task & Goals]
1. Welcome the user to the system and inquire about their needs.
2. Adaptively interpret the user's instructions or questions.
3. Provide accurate answers and solutions based on available information or tools.
4. Guide the user through complex processes step-by-step if needed.
5. Ask for confirmation if you're unsure about user intent or details. < wait for user response >

[Error Handling / Fallback]
- If user input is unclear, ask clarifying questions to gain better understanding.
- In the event of a misunderstanding, apologize and provide alternative solutions or suggestions.
- If the system experiences an error, notify the user calmly and offer to retry or provide additional assistance as needed.`;

/* ───────── Utilities ───────── */

function ensureBlocks(base: string): string {
  const hasAll =
    base.includes('[Identity]') &&
    base.includes('[Style]') &&
    base.includes('[Response Guidelines]') &&
    base.includes('[Task & Goals]') &&
    base.includes('[Error Handling / Fallback]');

  if (hasAll) return base;
  return PROMPT_SKELETON;
}

/* ───────── Lightweight language detection ───────── */

type Lang = 'english' | 'dutch' | 'other';

function detectLanguage(s: string): Lang {
  const t = s.toLowerCase();
  if (/\b(jij|je|jullie|bent|ben|een|echt|dom|alsjeblieft|hoi|hallo|bedankt|toon|vriendelijk|korte|antwoorden)\b/.test(t)) {
    return 'dutch';
  }
  if (/[a-z]/i.test(s) && /\b(the|and|to|of|a|you|your|please|make|use|tone|style)\b/i.test(s)) {
    return 'english';
  }
  return 'other';
}

// Tiny phrase-level Dutch → English (stub)
function translateDutchToEnglish(s: string): string {
  return s
    .replace(/\bjij\b/gi, 'you')
    .replace(/\bje\b/gi, 'you')
    .replace(/\bjullie\b/gi, 'you')
    .replace(/\bbent\b/gi, 'are')
    .replace(/\bben\b/gi, 'am')
    .replace(/\been\b/gi, 'a')
    .replace(/\becht\b/gi, 'really')
    .replace(/\bdom\b/gi, 'dumb')
    .replace(/\btoon\b/gi, 'tone')
    .replace(/\bvriendelijk(er)?\b/gi, 'friendly')
    .replace(/\bkorte\b/gi, 'short')
    .replace(/\bantwoorden\b/gi, 'answers')
    .replace(/\bals de gebruiker\b/gi, 'if the user')
    .replace(/\bals iemand\b/gi, 'if someone')
    .replace(/\bmaak\b/gi, 'make')
    .replace(/\bgebruik\b/gi, 'use')
    .replace(/\bbedankt\b/gi, 'thanks');
}

export function normalizeBuilderLine(line: string): string {
  const lang = detectLanguage(line);
  if (lang === 'dutch') return translateDutchToEnglish(line);
  return line;
}

/* ───────── Legacy bullets & routing (back-compat) ───────── */

function toBullet(s: string): string {
  const trimmed = s.trim().replace(/^[-•\u2022]\s*/, '');
  return `- ${/[.!?]$/.test(trimmed) ? trimmed : trimmed + '.'}`;
}

function sanitizeInsultsToFallback(line: string): string | null {
  const t = line.toLowerCase();
  const looksLikeInsultExample =
    /\byou are (really )?dumb\b/.test(t) ||
    /\bidiot|stupid|dumb|trash|useless|hate\b/.test(t) ||
    /\byou suck\b/.test(t);
  if (!looksLikeInsultExample) return null;

  return toBullet(
    'If a user expresses frustration or uses insults, respond calmly, remain professional, and redirect the conversation toward their goal.'
  );
}

type Bucket =
  | '[Identity]'
  | '[Style]'
  | '[Response Guidelines]'
  | '[Task & Goals]'
  | '[Error Handling / Fallback]';

function routeBucketOf(line: string): Bucket {
  const s = line.toLowerCase();

  if (/\b(identity|persona|role|act as|behave as)\b/.test(s)) return '[Identity]';
  if (/\b(tone|style|friendly|formal|approachable|concise|polite|empathetic|confidence)\b/.test(s)) return '[Style]';
  if (/\b(guideline|format|answer|response|clarity|steps|list|jargon|brevity|structure|citation)\b/.test(s))
    return '[Response Guidelines]';
  if (/\b(task|goal|collect|ask|confirm|escalate|handoff|flow|process|onboarding|qualify|booking|schedule|pricing)\b/.test(s))
    return '[Task & Goals]';
  if (/\b(error|fallback|fail|misunderstanding|retry|sorry|apologize|escalate|abuse|insult|frustration)\b/.test(s))
    return '[Error Handling / Fallback]';

  return '[Response Guidelines]';
}

function rewriteToProfessional(line: string): string {
  const fallback = sanitizeInsultsToFallback(line);
  if (fallback) return fallback;

  let s = line.trim();
  s = s.replace(/^make the tone/i, 'Use a tone that is');
  s = s.replace(/^use tone/i, 'Use a tone that is');
  s = s.replace(/\bshort answers\b/i, 'brief answers');

  return toBullet(s);
}

const BLOCKS: Bucket[] = [
  '[Identity]',
  '[Style]',
  '[Response Guidelines]',
  '[Task & Goals]',
  '[Error Handling / Fallback]',
];

type BlocksMap = Record<Bucket, string[]>;

function splitIntoBlocks(base: string): BlocksMap {
  const map: BlocksMap = {
    '[Identity]': [],
    '[Style]': [],
    '[Response Guidelines]': [],
    '[Task & Goals]': [],
    '[Error Handling / Fallback]': [],
  };

  let current: Bucket | '' = '';
  ensureBlocks(base)
    .split('\n')
    .forEach((raw) => {
      const line = raw ?? '';
      const t = line.trim() as Bucket;
      if (BLOCKS.includes(t)) {
        current = t;
        return;
      }
      if (current) map[current].push(line);
    });

  return map;
}

function joinBlocks(map: BlocksMap): string {
  return BLOCKS.map((b) => `${b}\n${(map[b] || []).join('\n')}`.trim()).join('\n\n');
}

/* ───────── Diff (for UI summaries) ───────── */

export type DiffRow = { t: 'same' | 'add' | 'rem'; text: string };
export function computeDiff(base: string, next: string): DiffRow[] {
  const a = base.split('\n');
  const b = next.split('\n');
  const setA = new Set(a);
  const setB = new Set(b);
  const rows: DiffRow[] = [];
  const max = Math.max(a.length, b.length);

  for (let i = 0; i < max; i++) {
    const la = a[i];
    const lb = b[i];
    if (la === lb && la !== undefined) {
      rows.push({ t: 'same', text: la });
      continue;
    }
    if (lb !== undefined && !setA.has(lb)) rows.push({ t: 'add', text: lb });
    if (la !== undefined && !setB.has(la)) rows.push({ t: 'rem', text: la });
  }

  for (let j = a.length; j < b.length; j++) {
    const lb = b[j];
    if (lb !== undefined && !setA.has(lb)) rows.push({ t: 'add', text: lb });
  }
  return rows;
}

/* ───────── NEW: Full-prompt normalization & detection ───────── */

export function looksLikeFullPrompt(raw: string): boolean {
  const t = raw || '';
  return (
    /\[Identity\]/.test(t) &&
    /\[Style\]/.test(t) &&
    /\[Response Guidelines\]/.test(t) &&
    /\[Task & Goals\]/.test(t) &&
    /\[Error Handling \/ Fallback\]/.test(t)
  );
}

export function normalizeFullPrompt(raw: string): string {
  const safe = ensureBlocks(String(raw ?? ''));
  const lines = safe
    .split('\n')
    .map((l) => l.replace(/\s+$/g, '')) // rtrim
    .filter((l, i, arr) => {
      if (l.trim() !== '') return true;
      const prev = arr[i - 1];
      return prev && prev.trim() !== '';
    })
    .filter((l) => !/^\-\s*$/.test(l))
    .filter((l) => l.trim().toLowerCase() !== '- assistant.')
    .filter((l) => l.trim().toLowerCase() !== 'assistant.')
    .filter((l) => l.trim() !== '-');

  return lines.join('\n').trim();
}

/* =========================================================
   v2: Preset Library + Config-Driven Builder
========================================================= */

export type ExtractionField = { key: string; type: 'string'|'number'|'boolean'|'date'; required?: boolean; enum?: string[] };
export type PromptConfig = {
  industry?: string;
  tone?: 'friendly'|'formal'|'playful'|'authoritative'|'supportive'|'neutral';
  channels?: Array<'voice'|'chat'|'email'>;
  language?: string;
  tasks?: string[];
  safety?: { sensitive?: boolean; escalation?: boolean };
  extraction?: { name: string; schema: ExtractionField[] };
  disclaimers?: string[];
  brand?: { name?: string; tagline?: string };
  constraints?: { maxWords?: number; askBeforeBooking?: boolean };
};

/** Minimal seed presets; scale by adding to this map or loading JSON at runtime. */
const INDUSTRY_PRESETS: Record<string, Partial<PromptConfig>> = {
  dentist: {
    tasks: ['lead_qualification','booking','faq','insurance_check'],
    tone: 'friendly',
    channels: ['voice','chat'],
    safety: { sensitive: true, escalation: true },
    extraction: {
      name: 'Lead',
      schema: [
        { key: 'full_name', type: 'string', required: true },
        { key: 'phone', type: 'string', required: true },
        { key: 'email', type: 'string' },
        { key: 'reason', type: 'string', required: true },
        { key: 'preferred_time', type: 'string' },
      ]
    }
  },
  real_estate: {
    tasks: ['lead_qualification','property_match','tour_booking','faq'],
    tone: 'friendly',
    channels: ['voice','chat'],
    extraction: {
      name: 'Lead',
      schema: [
        { key: 'full_name', type: 'string', required: true },
        { key: 'phone', type: 'string' },
        { key: 'email', type: 'string' },
        { key: 'location', type: 'string', required: true },
        { key: 'budget', type: 'string' },
        { key: 'beds', type: 'number' },
      ]
    }
  },
  restaurant: {
    tasks: ['booking','menu_faq','hours','special_requests'],
    tone: 'friendly',
    channels: ['voice','chat'],
    extraction: {
      name: 'Reservation',
      schema: [
        { key: 'full_name', type: 'string', required: true },
        { key: 'party_size', type: 'number', required: true },
        { key: 'date', type: 'string', required: true },
        { key: 'time', type: 'string', required: true },
        { key: 'phone', type: 'string' },
        { key: 'notes', type: 'string' },
      ]
    }
  },
  it_helpdesk: {
    tasks: ['triage','troubleshoot','ticket_create','status'],
    tone: 'supportive',
    channels: ['voice','chat'],
    extraction: {
      name: 'Ticket',
      schema: [
        { key: 'name', type: 'string', required: true },
        { key: 'email', type: 'string', required: true },
        { key: 'severity', type: 'string' },
        { key: 'device', type: 'string' },
        { key: 'issue', type: 'string', required: true },
      ]
    }
  },
  legal_intake: {
    tasks: ['lead_qualification','intake','faq','handoff'],
    tone: 'formal',
    channels: ['voice','chat'],
    safety: { sensitive: true, escalation: true },
    disclaimers: ['not_legal_advice'],
    extraction: {
      name: 'Intake',
      schema: [
        { key: 'full_name', type: 'string', required: true },
        { key: 'phone', type: 'string', required: true },
        { key: 'email', type: 'string' },
        { key: 'case_type', type: 'string', required: true },
        { key: 'summary', type: 'string', required: true },
      ]
    }
  }
  // Add more or load externally.
};

function pick<T>(v: T | undefined, fb: T): T { return v === undefined ? fb : v; }

function bullets(items: string[], dash = '-'): string[] {
  return items.map((i) => `${dash} ${i}`); // no period — some bullets embed placeholders
}

/** Compose a complete prompt from config. */
export function buildPromptFromConfig(cfg: PromptConfig): string {
  const industry = (cfg.industry || 'general').toLowerCase();
  const tone = cfg.tone || 'friendly';
  const lang = cfg.language || 'English';
  const channels = cfg.channels && cfg.channels.length ? cfg.channels : ['voice','chat'];
  const tasks = cfg.tasks && cfg.tasks.length ? cfg.tasks : ['faq', 'lead_qualification'];

  const voiceAware = channels.includes('voice');
  const maxWords = cfg.constraints?.maxWords ?? (voiceAware ? 120 : 220);
  const askBeforeBooking = pick(cfg.constraints?.askBeforeBooking, true);

  const d = (cfg.disclaimers || []).map((k) => {
    if (k === 'not_legal_advice') return 'Clarify you provide general information, not legal advice.';
    if (k === 'not_medical_advice') return 'Clarify you provide general information, not medical advice.';
    return k.replace(/_/g,' ');
  });

  const extraction = cfg.extraction
    ? [
        `If applicable, structure collected data as "${cfg.extraction.name}" with keys:`,
        ...cfg.extraction.schema.map(f => `  - ${f.key}: ${f.type}${f.required ? ' (required)' : ''}${f.enum?.length ? ` (one of: ${f.enum.join(', ')})` : ''}`)
      ].join('\n')
    : '';

  const brandLine = [
    cfg.brand?.name ? `Brand Name: ${cfg.brand.name}.` : '',
    cfg.brand?.tagline ? `Tagline: ${cfg.brand.tagline}.` : ''
  ].filter(Boolean).join(' ');

  const identity = [
    `You are a domain-adaptive AI assistant for ${industry} use-cases.`,
    brandLine,
    `Operate primarily in ${lang}. If the user speaks another language, mirror it.`,
  ].filter(Boolean).join(' ');

  const style = bullets([
    `Use a ${tone} tone; sound natural and human, not robotic.`,
    voiceAware ? 'Favor short, speakable sentences; avoid long lists in one turn.' : 'Use concise paragraphs and clear lists.',
    'Confirm critical details back to the user in your own words.',
    'Avoid over-promising; be transparent about limitations.'
  ]);

  const responseGuidelines = bullets([
    `Keep each message under ~${maxWords} words unless teaching or troubleshooting.`,
    'When uncertain, ask one targeted clarifying question.',
    channels.includes('email') ? 'When drafting emails, include subject and a concise, skimmable body.' : '',
    extraction ? 'When you have all required fields, surface the structured payload in a final line as JSON.' : '',
  ].filter(Boolean));

  const taskBullets = [
    ...tasks.map(t => {
      if (t === 'booking') {
        return askBeforeBooking
          ? 'If the user wants to book, confirm date/time window, location, contact, and constraints; then propose the best available slot.'
          : 'If the user wants to book, propose the best available slot immediately.'
      }
      if (t === 'lead_qualification') return 'Qualify leads (budget, timeline, intent) politely, one question at a time.';
      if (t === 'faq') return 'Answer FAQs accurately; if policy/source unclear, say so and propose a next step.';
      if (t === 'triage') return 'Triage issues: identify category, severity, and required info before proposing steps.';
      if (t === 'ticket_create') return 'Create a ticket when needed and summarize the issue and steps already tried.';
      if (t === 'property_match') return 'Ask location, price range, beds/baths, and must-haves; suggest top 3 matches.';
      if (t === 'menu_faq') return 'Answer menu/dietary questions; ask about allergies, then suggest suitable items.';
      if (t === 'insurance_check') return 'Collect insurance provider, member ID, DOB to verify coverage (only if user consents).';
      if (t === 'handoff') return 'Offer human handoff when the user requests or when confidence is low.';
      return `Handle task: ${t}.`;
    }),
    extraction ? 'Collect all required fields for the extraction schema.' : '',
  ].filter(Boolean);

  const errorFallback = bullets([
    cfg.safety?.sensitive ? 'If the user shares sensitive information, respond with empathy and handle data carefully.' : '',
    cfg.safety?.escalation ? 'Offer escalation to a human when issues are urgent, sensitive, or blocked.' : '',
    ...d,
    'If you make a mistake, apologize once, correct it, and continue.',
    'On tool or system errors, explain plainly and propose a next step (retry, alternative, or handoff).'
  ].filter(Boolean));

  const body = [
    '[Identity]',
    identity,
    '',
    '[Style]',
    ...style,
    '',
    '[Response Guidelines]',
    ...responseGuidelines,
    '',
    '[Task & Goals]',
    ...taskBullets.map(b => `- ${b}`),
    extraction ? `\n${extraction}` : '',
    '',
    '[Error Handling / Fallback]',
    ...errorFallback
  ].join('\n').trim();

  return normalizeFullPrompt(body);
}

/** Parse free-form config lines like:
 *   industry=dentist; tone=friendly; tasks=lead_qualification,booking; channels=voice,chat
 *   language=English
 *   brand.name=Acme Dental; brand.tagline=Gentle care
 *   extraction.name=Lead; extraction.schema=full_name:string!,email:string?,phone:string?
 */
export function parseFreeFormConfig(text: string): PromptConfig | null {
  if (!text) return null;
  const cfg: PromptConfig = {};
  const lines = text.split(/\n|;/).map(s => s.trim()).filter(Boolean);

  function set(path: string, value: any) {
    const parts = path.split('.');
    let cur: any = cfg;
    while (parts.length > 1) {
      const p = parts.shift()!;
      cur[p] = cur[p] || {};
      cur = cur[p];
    }
    cur[parts[0]] = value;
  }

  for (const line of lines) {
    const m = line.match(/^([\w\.\-]+)\s*=\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const raw = m[2].trim();

    if (key === 'industry') set('industry', raw.toLowerCase());
    else if (key === 'tone') set('tone', raw.toLowerCase());
    else if (key === 'language') set('language', raw);
    else if (key === 'channels') set('channels', raw.split(',').map(s => s.trim().toLowerCase()) as any);
    else if (key === 'tasks') set('tasks', raw.split(',').map(s => s.trim().toLowerCase()));
    else if (key === 'constraints.maxwords') set('constraints.maxWords', Number(raw));
    else if (key === 'constraints.askbeforebooking') set('constraints.askBeforeBooking', /^true|1|yes$/i.test(raw));
    else if (key === 'brand.name') set('brand.name', raw);
    else if (key === 'brand.tagline') set('brand.tagline', raw);
    else if (key === 'safety.sensitive') set('safety.sensitive', /^true|1|yes$/i.test(raw));
    else if (key === 'safety.escalation') set('safety.escalation', /^true|1|yes$/i.test(raw));
    else if (key === 'extraction.name') set('extraction.name', raw);
    else if (key === 'extraction.schema') {
      // example: full_name:string!,email:string?,phone:string?,budget:number
      const fields: ExtractionField[] = raw.split(',').map(tok => {
        const [k, tRaw] = tok.split(':').map(s => s.trim());
        const required = /!$/.test(tRaw);
        const type = (tRaw.replace(/[!?]$/,'') as any) || 'string';
        return { key: k, type, required };
      });
      set('extraction.schema', fields);
    }
  }

  return cfg;
}

/** Build from a preset industry, merged with overrides. */
export function buildFromPreset(industry: string, overrides?: Partial<PromptConfig>): string {
  const base = INDUSTRY_PRESETS[industry?.toLowerCase()] || {};
  return buildPromptFromConfig({ ...base, industry, ...(overrides || {}) });
}

/* =========================================================
   Back-compat generator/merge API
========================================================= */

export type GenerateOptions = {
  agentLanguage?: string;
};

export type GenerateResult = {
  nextPrompt: string;
  diff: DiffRow[];
  added: number;
  removed: number;
  bucketsAdded: Partial<Record<Bucket, number>>;
};

export function generateFromFreeText(
  basePrompt: string,
  freeText: string,
  _opts?: GenerateOptions
): GenerateResult {
  const base = ensureBlocks(basePrompt || DEFAULT_PROMPT || PROMPT_SKELETON);
  const blocks = splitIntoBlocks(base);

  const lines = freeText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const bucketsAdded: Partial<Record<Bucket, number>> = {};

  for (const raw of lines) {
    const normalized = normalizeBuilderLine(raw);
    const bucket = routeBucketOf(normalized);
    const policy = rewriteToProfessional(normalized);
    blocks[bucket].push(policy);
    bucketsAdded[bucket] = (bucketsAdded[bucket] || 0) + 1;
  }

  const nextPrompt = joinBlocks(blocks);
  const diff = computeDiff(base, nextPrompt);
  const added = diff.filter((d) => d.t === 'add').length;
  const removed = diff.filter((d) => d.t === 'rem').length;

  return { nextPrompt, diff, added, removed, bucketsAdded };
}

export function applyInstructions(
  basePrompt: string,
  instructions: string,
  opts?: GenerateOptions
): { merged: string; summary: string; diff: DiffRow[] } {
  // v2 smart path: detect config/preset directives first
  const text = (instructions || '').trim();

  // 1) Explicit preset: "preset: dentist" or "industry: dentist"
  const presetMatch = text.match(/^(preset|industry)\s*:\s*([a-z0-9_\-]+)/i);
  if (presetMatch) {
    const industry = presetMatch[2].toLowerCase();
    const merged = buildFromPreset(industry, {});
    const diff = computeDiff(basePrompt || DEFAULT_PROMPT, merged);
    return { merged, summary: `Preset applied: ${industry}`, diff };
  }

  // 2) Free-form config lines detected by "key=value"
  if (/[\w.]+\s*=\s*.+/.test(text)) {
    const cfg = parseFreeFormConfig(text);
    if (cfg) {
      // Merge with preset if industry present
      const merged = cfg.industry ? buildFromPreset(cfg.industry, cfg) : buildPromptFromConfig(cfg);
      const diff = computeDiff(basePrompt || DEFAULT_PROMPT, merged);
      return { merged, summary: 'Config built prompt', diff };
    }
  }

  // 3) Fallback: legacy line-merge
  const { nextPrompt, diff, added, removed, bucketsAdded } = generateFromFreeText(
    basePrompt,
    instructions,
    opts
  );
  const parts: string[] = [];
  if (added || removed) parts.push(`+${added} / -${removed} lines`);
  const bucketBits = Object.entries(bucketsAdded)
    .map(([k, v]) => `${k} +${v}`)
    .join(', ');
  if (bucketBits) parts.push(bucketBits);

  const summary = parts.join(' · ') || 'No changes';
  return { merged: nextPrompt, summary, diff };
}
