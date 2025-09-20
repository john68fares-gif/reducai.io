// lib/prompt-engine.ts
/* =====================================================================
   Prompt Engine (v2) — presets + configs + robust merging (Next-safe)
   ===================================================================== */

/* ───────── Canonical headers ───────── */
const HEADERS = [
  '[Identity]',
  '[Style]',
  '[Response Guidelines]',
  '[Task & Goals]',
  '[Error Handling / Fallback]',
] as const;

type Bucket =
  | '[Identity]'
  | '[Style]'
  | '[Response Guidelines]'
  | '[Task & Goals]'
  | '[Error Handling / Fallback]';

const ORDER: Bucket[] = [
  '[Identity]',
  '[Style]',
  '[Response Guidelines]',
  '[Task & Goals]',
  '[Error Handling / Fallback]',
];

/* ───────── Utilities ───────── */

function isJunkLine(s: string): boolean {
  const t = (s || '').trim().toLowerCase();
  if (!t) return true;
  // throwaways / artifacts
  if (t === '-' || t === '—' || t === 'assistant' || t === 'assistant.' || t === '.') return true;
  if (/^[\-\u2013\u2014\.\,\;:]+$/.test(t)) return true; // only punctuation/bullets
  // extremely short throwaways
  if (t.length <= 1) return true;
  return false;
}

function dedupe<T>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = String(x).trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

function bullets(list: string[]): string {
  const lines = list.map(s => s.trim()).filter(Boolean).filter(s => !isJunkLine(s));
  return lines.length ? `- ${lines.join('\n- ')}` : '(none)';
}

function ensureNonEmpty(list: string[], fallbacks: string[]): string[] {
  const cleaned = dedupe(list).filter(s => !isJunkLine(s));
  if (cleaned.length) return cleaned;
  return fallbacks;
}

function toLines(block: string): string[] {
  return (block || '')
    .replace(/^\s*-\s*/gm, '') // strip leading bullets
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => !isJunkLine(s));
}

/* ───────── Base default prompt (safe, compact) ───────── */
export const DEFAULT_PROMPT =
`[Identity]
- You are a versatile AI assistant for this business. Represent the brand professionally and help users achieve their goals.

[Style]
- Clear, concise, friendly. Prefer 2–4 short sentences per turn.
- Confirm understanding with a brief paraphrase when the request is complex.

[Response Guidelines]
- Ask a clarifying question when essential info is missing.
- Cite or link sources when referencing external facts (if available).
- Do not fabricate; say when you don’t know or need to check.
- Summarize next steps at the end when the user has a multi-step task.

[Task & Goals]
- Qualify the user’s need, answer relevant FAQs, and guide to scheduling, purchase, or escalation.
- Offer to collect structured info (name, contact, preferred time) when booking or follow-up is needed.

[Error Handling / Fallback]
- If uncertain, ask a specific clarifying question.
- If a tool/endpoint fails, apologize briefly and offer an alternative or human handoff.`;

/* ───────── Presets (add more anytime) ───────── */

type Preset = {
  identity: string[];
  style: string[];
  guidelines: string[];
  tasks: string[];
  fallbacks: string[];
  seed?: string; // optional extra notes block appended after sections
};

const PRESETS: Record<string, Preset> = {
  dentist: {
    identity: [
      'You are a virtual front-desk assistant for a dental clinic.',
      'You handle new and existing patients professionally and empathetically.',
    ],
    style: [
      'Warm, reassuring, matter-of-fact.',
      'Avoid overwhelming the user with medical jargon; explain in plain language.',
    ],
    guidelines: [
      'Never diagnose; provide general info and recommend an appointment for evaluation.',
      'Offer options for cleaning, whitening, fillings, crowns, implants, orthodontics, and emergency visits if relevant.',
      'Collect patient info securely: full name, phone/email, preferred date/time, reason for visit.',
    ],
    tasks: [
      'Qualify the need (pain, cleaning, follow-up).',
      'Offer appointment slots or a booking link.',
      'Explain insurance acceptance and payment options at a high level.',
    ],
    fallbacks: [
      'If the user reports severe pain/swelling/fever/trauma, advise urgent evaluation and prioritize an emergency slot.',
    ],
    seed: '',
  },
  restaurant: {
    identity: [
      'You are a reservation and menu assistant for a restaurant.',
    ],
    style: [
      'Enthusiastic, concise, helpful.',
    ],
    guidelines: [
      'Provide hours, location, dress code, and parking when asked.',
      'Offer dietary options and highlight top dishes.',
    ],
    tasks: [
      'Take reservations (date, time, party size, contact).',
      'Offer waitlist, special requests, and celebration notes.',
    ],
    fallbacks: [
      'If no availability, propose closest alternatives and waitlist.',
    ],
  },
  real_estate: {
    identity: [
      'You assist a real estate agency with buyer/seller inquiries.',
    ],
    style: ['Professional, concise, optimistic.'],
    guidelines: [
      'Never claim property features not verified; offer to check.',
      'Summarize listings with beds/baths/price/location/highlights.',
    ],
    tasks: [
      'Qualify budget, location, timelines; book tours; send disclosures on request.',
    ],
    fallbacks: [
      'If data is missing/outdated, say so and offer to confirm with an agent.',
    ],
  },
  ecommerce: {
    identity: ['You are a shopping assistant for an e-commerce store.'],
    style: ['Friendly, conversion-focused, brief.'],
    guidelines: [
      'Clarify user intents: discover, compare, troubleshoot, return.',
      'Provide clear return/shipping policies (if known) or link to policy page.',
    ],
    tasks: [
      'Recommend products, compare features/price, guide to checkout.',
    ],
    fallbacks: [
      'If inventory is unknown, offer to notify or suggest similar items.',
    ],
  },
  saas: {
    identity: ['You are a customer success assistant for a SaaS product.'],
    style: ['Supportive, pragmatic, crisp.'],
    guidelines: [
      'Use step-by-step instructions for setup/questions.',
      'Link to specific docs pages when relevant.',
    ],
    tasks: [
      'Qualify use-case, recommend plan, help with onboarding and troubleshooting.',
    ],
    fallbacks: [
      'If an issue persists, collect logs and escalate to human support.',
    ],
  },
  hotel: {
    identity: ['You are a reservation assistant for a hotel.'],
    style: ['Polite, upbeat, concise.'],
    guidelines: [
      'Provide room types, amenities, check-in/out times, and pet/parking policies.',
    ],
    tasks: [
      'Check availability by dates, guests; collect contact to finalize booking.',
    ],
    fallbacks: [
      'If fully booked, suggest nearby dates or partner properties.',
    ],
  },
  salon: {
    identity: ['You are a booking assistant for a salon/spa.'],
    style: ['Warm, welcoming, concise.'],
    guidelines: [
      'List services (cut, color, styling, nails, massage) with durations if known.',
    ],
    tasks: [
      'Offer times, match stylists, capture contact preferences.',
    ],
    fallbacks: [
      'If no slot, propose earliest availability and waitlist.',
    ],
  },
  legal: {
    identity: ['You are an intake assistant for a law firm.'],
    style: ['Respectful, clear, careful.'],
    guidelines: [
      'Do not provide legal advice; gather context and propose a consultation.',
      'Keep sensitive data confidential.',
    ],
    tasks: [
      'Qualify case type, jurisdiction, timelines; book consultation.',
    ],
    fallbacks: [
      'If it’s an emergency or outside scope, recommend appropriate resources.',
    ],
  },
  fitness: {
    identity: ['You are a membership and scheduling assistant for a gym/coach.'],
    style: ['Motivational, concise, practical.'],
    guidelines: [
      'Offer class schedules, membership tiers, and trial options.',
    ],
    tasks: [
      'Book classes/assessments, collect contact/payment when needed.',
    ],
    fallbacks: [
      'If a class is full, offer alternatives and waitlist.',
    ],
  },
  clinic: {
    identity: ['You are an intake assistant for a medical clinic.'],
    style: ['Calm, empathetic, plain language.'],
    guidelines: [
      'Never diagnose; encourage appointments for evaluation.',
      'Explain services (primary care, specialties) at a high level.',
    ],
    tasks: [
      'Qualify reason for visit, insurance basics, schedule appointment.',
    ],
    fallbacks: [
      'For urgent symptoms, advise calling emergency services or urgent care.',
    ],
  },
};

/* ───────── Key=Value Config Routing ───────── */

type Sections = {
  identity: string[];
  style: string[];
  guidelines: string[];
  tasks: string[];
  fallbacks: string[];
};

function emptySections(): Sections {
  return { identity: [], style: [], guidelines: [], tasks: [], fallbacks: [] };
}

function routeConfigLine(line: string, sections: Sections, notes: string[]) {
  const raw = line.trim();
  const lower = raw.toLowerCase();

  // explicit buckets like: "identity: act as xyz"
  if (lower.startsWith('identity:')) { sections.identity.push(raw.replace(/^identity:\s*/i, '').trim()); return; }
  if (lower.startsWith('style:'))    { sections.style.push(raw.replace(/^style:\s*/i, '').trim()); return; }
  if (lower.startsWith('guideline:') || lower.startsWith('guidelines:')) {
    sections.guidelines.push(raw.replace(/^guidelines?:\s*/i, '').trim()); return;
  }
  if (lower.startsWith('task:') || lower.startsWith('tasks:')) {
    sections.tasks.push(raw.replace(/^tasks?:\s*/i, '').trim()); return;
  }
  if (lower.startsWith('fallback:') || lower.startsWith('error:')) {
    sections.fallbacks.push(raw.replace(/^(fallback|error)[^:]*:\s*/i, '').trim()); return;
  }

  // key=value shorthands
  const m = raw.match(/^([a-z_]+)\s*=\s*(.+)$/i);
  if (m) {
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (!val) return;

    switch (key) {
      case 'industry': {
        sections.identity.push(`Industry: ${val}`);
        break;
      }
      case 'tone': {
        sections.style.push(`Tone: ${val}`);
        break;
      }
      case 'services': {
        sections.guidelines.push(`Services: ${val}`);
        break;
      }
      case 'tasks': {
        // allow comma/pipe separated
        sections.tasks.push(val.replace(/[|]/g, ', '));
        break;
      }
      case 'booking_url': {
        sections.guidelines.push(`Booking URL: ${val}`);
        break;
      }
      case 'hours': {
        sections.guidelines.push(`Hours: ${val}`);
        break;
      }
      case 'location': {
        sections.guidelines.push(`Location: ${val}`);
        break;
      }
      case 'escalation': {
        sections.fallbacks.push(`Escalation path: ${val}`);
        break;
      }
      case 'channels': {
        sections.guidelines.push(`Channels: ${val}`);
        break;
      }
      case 'languages': {
        sections.style.push(`Supported languages: ${val}`);
        break;
      }
      default: {
        notes.push(raw);
        break;
      }
    }
    return;
  }

  // safety heuristics — “never/avoid” to guidelines
  if (/\b(never|avoid|do not|don’t)\b/i.test(raw)) {
    sections.guidelines.push(raw);
    return;
  }

  // otherwise, treat as free-form note (only if not junk)
  if (!isJunkLine(raw)) notes.push(raw);
}

/* ───────── Full-prompt detection & normalization ───────── */

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

function ensureBlocks(base: string): string {
  const safe = String(base ?? '');
  const hasAll = HEADERS.every(h => safe.includes(h));
  if (hasAll) return safe;
  // produce empty skeleton (we’ll fill with fallbacks later)
  return [
    '[Identity]', '',
    '[Style]', '',
    '[Response Guidelines]', '',
    '[Task & Goals]', '',
    '[Error Handling / Fallback]', '',
  ].join('\n');
}

/**
 * Normalize a *complete* prompt:
 * - ensure headers exist (order preserved)
 * - rtrim lines
 * - collapse multiple blank lines
 * - drop junk bullets, lone dashes, “assistant.”
 */
export function normalizeFullPrompt(raw: string): string {
  const safe = ensureBlocks(String(raw ?? ''));
  const lines = safe
    .split('\n')
    .map(l => l.replace(/\s+$/g, '')) // rtrim
    .filter((l, i, arr) => {
      if (l.trim() !== '') return true;
      const prev = arr[i - 1];
      return prev && prev.trim() !== ''; // collapse multiple blanks
    })
    .filter(l => !/^\-\s*$/.test(l))
    .filter(l => l.trim().toLowerCase() !== '- assistant.')
    .filter(l => l.trim().toLowerCase() !== 'assistant.')
    .filter(l => l.trim() !== '-');

  return lines.join('\n').trim();
}

/* ───────── Block parsing & join ───────── */

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
      if (ORDER.includes(t)) {
        current = t;
        return;
      }
      if (current) map[current].push(line);
    });

  // strip possible bullet prefixes and junk
  for (const k of ORDER) {
    map[k] = toLines(map[k].join('\n'));
  }

  return map;
}

function joinBlocks(map: BlocksMap): string {
  const identityFinal = ensureNonEmpty(
    map['[Identity]'],
    ['You are a helpful virtual assistant for this business.']
  );
  const styleFinal = ensureNonEmpty(
    map['[Style]'],
    ['Clear, concise, friendly. Keep replies under 4 sentences.']
  );
  const guidelinesFinal = ensureNonEmpty(
    map['[Response Guidelines]'],
    ['Ask clarifying questions when needed.', 'Do not fabricate facts; say when you don’t know.']
  );
  const tasksFinal = ensureNonEmpty(
    map['[Task & Goals]'],
    ['Qualify, answer FAQs, and book or escalate.']
  );
  const fallbacksFinal = ensureNonEmpty(
    map['[Error Handling / Fallback]'],
    ['If uncertain, ask a clarifying question.', 'Offer a human follow-up when appropriate.']
  );

  return [
    '[Identity]',
    bullets(identityFinal),
    '',
    '[Style]',
    bullets(styleFinal),
    '',
    '[Response Guidelines]',
    bullets(guidelinesFinal),
    '',
    '[Task & Goals]',
    bullets(tasksFinal),
    '',
    '[Error Handling / Fallback]',
    bullets(fallbacksFinal),
  ].join('\n');
}

/* ───────── Diff (for summaries) ───────── */

export type DiffRow = { t: 'same' | 'add' | 'rem'; text: string };
function diffLines(a: string, b: string): DiffRow[] {
  const A = a.split('\n');
  const B = b.split('\n');
  const setA = new Set(A);
  const setB = new Set(B);
  const rows: DiffRow[] = [];
  const max = Math.max(A.length, B.length);
  for (let i = 0; i < max; i++) {
    const la = A[i];
    const lb = B[i];
    if (la === lb && la !== undefined) {
      rows.push({ t: 'same', text: la });
      continue;
    }
    if (lb !== undefined && !setA.has(lb)) rows.push({ t: 'add', text: lb });
    if (la !== undefined && !setB.has(la)) rows.push({ t: 'rem', text: la });
  }
  for (let j = A.length; j < B.length; j++) {
    const lb = B[j];
    if (lb !== undefined && !setA.has(lb)) rows.push({ t: 'add', text: lb });
  }
  return rows;
}

/* ───────── Public API ───────── */

export type GenerateOptions = { agentLanguage?: string };

export function applyInstructions(
  basePrompt: string,
  instructions: string,
  _opts?: GenerateOptions
): { merged: string; summary: string; diff: DiffRow[] } {
  const raw = String(instructions || '').trim();
  // If it’s already a full prompt, normalize and return directly
  if (looksLikeFullPrompt(raw)) {
    const merged = normalizeFullPrompt(raw);
    const diff = diffLines(basePrompt || '', merged);
    return { merged, summary: 'Replaced with full prompt', diff };
  }

  // Start from either the provided base or the default
  const base = (basePrompt && basePrompt.trim().length) ? basePrompt : DEFAULT_PROMPT;
  const baseBlocks = splitIntoBlocks(base);

  // 1) Try to detect a preset: "preset: dentist" / "preset dentist"
  const presetMatch = raw.match(/^\s*preset[:\s]+([a-z0-9_\- ]+)\s*$/i);
  // Or inside a multi-line blob like "preset=dentist"
  const inlines = raw.split(/\n|;/).map(s => s.trim()).filter(Boolean);
  const inlinePreset = inlines
    .map(s => s.match(/^\s*preset\s*[:=]\s*([a-z0-9_\- ]+)\s*$/i))
    .filter(Boolean)?.[0];

  const presetName = (presetMatch?.[1] || inlinePreset?.[1] || '').toLowerCase().replace(/\s+/g, '_');
  const usePreset = Boolean(presetName && PRESETS[presetName]);

  if (usePreset) {
    // Build from preset + any additional key=value lines
    const preset = PRESETS[presetName];

    // Prime sections with preset content
    const sections: Sections = {
      identity: [...preset.identity],
      style: [...preset.style],
      guidelines: [...preset.guidelines],
      tasks: [...preset.tasks],
      fallbacks: [...preset.fallbacks],
    };

    const notes: string[] = [];

    // Route additional config lines (excluding the preset one)
    for (const line of inlines) {
      if (/^\s*preset\s*[:=]/i.test(line)) continue;
      if (isJunkLine(line)) continue;
      routeConfigLine(line, sections, notes);
    }

    // Merge with base blocks (additive)
    const mergedBlocks: BlocksMap = {
      '[Identity]': dedupe([...toLines(bullets(sections.identity)), ...baseBlocks['[Identity]']]),
      '[Style]': dedupe([...toLines(bullets(sections.style)), ...baseBlocks['[Style]']]),
      '[Response Guidelines]': dedupe([...toLines(bullets(sections.guidelines)), ...baseBlocks['[Response Guidelines]']]),
      '[Task & Goals]': dedupe([...toLines(bullets(sections.tasks)), ...baseBlocks['[Task & Goals]']]),
      '[Error Handling / Fallback]': dedupe([...toLines(bullets(sections.fallbacks)), ...baseBlocks['[Error Handling / Fallback]']]),
    };

    const core = joinBlocks(mergedBlocks);

    // optional seed/notes
    const seed = preset.seed ? `\n\n${preset.seed}` : '';
    const notesFinal = notes.filter(n => !isJunkLine(n));
    const notesBlock = notesFinal.length ? `\n\n[Notes]\n${bullets(dedupe(notesFinal))}` : '';

    const final = (core + seed + notesBlock).trim();
    const diff = diffLines(base, final);

    const adds = diff.filter(d => d.t === 'add').length;
    const rems = diff.filter(d => d.t === 'rem').length;
    const summary = `Preset "${presetName}" applied · +${adds} / -${rems} lines`;

    return { merged: final, summary, diff };
  }

  // 2) No preset — treat as instructions/config to merge into the base prompt
  const sections = emptySections();
  const notes: string[] = [];

  for (const line of inlines) {
    if (isJunkLine(line)) continue;
    routeConfigLine(line, sections, notes);
  }

  // Route freeform, non-key=value, non-explicit bucket lines:
  // We’ll map them to Response Guidelines as a sensible default.
  // (Only those that didn’t get bucketed already via routeConfigLine)
  const already =
    sections.identity.length +
    sections.style.length +
    sections.guidelines.length +
    sections.tasks.length +
    sections.fallbacks.length;

  if (already === 0) {
    // if user only typed bullets like “be friendlier”, treat as guidelines/style combo
    for (const line of toLines(raw)) {
      if (/tone|friendly|formal|casual|empathetic|concise/i.test(line)) {
        sections.style.push(line);
      } else {
        sections.guidelines.push(line);
      }
    }
  }

  // Merge with base
  const mergedBlocks: BlocksMap = {
    '[Identity]': dedupe([...baseBlocks['[Identity]'], ...sections.identity]),
    '[Style]': dedupe([...baseBlocks['[Style]'], ...sections.style]),
    '[Response Guidelines]': dedupe([...baseBlocks['[Response Guidelines]'], ...sections.guidelines]),
    '[Task & Goals]': dedupe([...baseBlocks['[Task & Goals]'], ...sections.tasks]),
    '[Error Handling / Fallback]': dedupe([...baseBlocks['[Error Handling / Fallback]'], ...sections.fallbacks]),
  };

  const core = joinBlocks(mergedBlocks);
  const notesFinal = notes.filter(n => !isJunkLine(n));
  const notesBlock = notesFinal.length ? `

[Notes]
${bullets(dedupe(notesFinal))}` : '';

  const final = (core + notesBlock).trim();
  const diff = diffLines(base, final);
  const adds = diff.filter(d => d.t === 'add').length;
  const rems = diff.filter(d => d.t === 'rem').length;

  const summary = adds || rems ? `+${adds} / -${rems} lines` : 'No changes';
  return { merged: final, summary, diff };
}
