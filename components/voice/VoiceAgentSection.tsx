/* =========================================================
   Prompt Engine — vertical templates + mixins + structured builder
   Scales to 1,000+ business prompts via registry packs
   ========================================================= */

/* ───────── Canonical layout ───────── */

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
- Use a clear and professional tone.
- Be friendly and approachable without being overly casual.
- Match the user's language and formality level when possible.

[Response Guidelines]
- Prefer brevity and clarity; structure answers with lists or steps when helpful.
- Surface assumptions; ask once for a missing critical detail, then proceed.
- Use plain language; define jargon only when needed.
- If a tool is required, state what you’re doing and why.

[Task & Goals]
1. Understand the user’s goal and time constraints.
2. Offer options and trade-offs where relevant.
3. Execute the requested task or guide the user step-by-step.
4. Confirm completion or next steps.

[Error Handling / Fallback]
- If the request is unclear, ask a targeted clarifying question.
- If blocked (policy, missing data, or tool failure), say so and offer safe alternatives.
- Apologize once for real mistakes, then correct course.
`;

/* ───────── Types ───────── */

type Bucket =
  | '[Identity]'
  | '[Style]'
  | '[Response Guidelines]'
  | '[Task & Goals]'
  | '[Error Handling / Fallback]';

type BlocksMap = Record<Bucket, string[]>;

export type GenerateOptions = {
  agentLanguage?: string;      // e.g., 'English', 'Spanish'
  locale?: string;             // e.g., 'US', 'UK', 'NL'
};

export type GenerateResult = {
  nextPrompt: string;
  diff: DiffRow[];
  added: number;
  removed: number;
  bucketsAdded: Partial<Record<Bucket, number>>;
};

/* ───────── Utilities ───────── */

function ensureBlocks(base: string): string {
  const hasAll =
    base.includes('[Identity]') &&
    base.includes('[Style]') &&
    base.includes('[Response Guidelines]') &&
    base.includes('[Task & Goals]') &&
    base.includes('[Error Handling / Fallback]');
  return hasAll ? base : PROMPT_SKELETON;
}

function rtrim(s: string) { return s.replace(/\s+$/g, ''); }
function toBullet(s: string) {
  const x = s.trim().replace(/^[-•\u2022]\s*/, '');
  return `- ${/[.!?]$/.test(x) ? x : x + '.'}`;
}

/* ───────── Simple language normalizer (extensible) ───────── */

type Lang = 'english' | 'dutch' | 'other';

function detectLanguage(s: string): Lang {
  const t = s.toLowerCase();
  if (/\b(jij|je|jullie|bent|ben|alsjeblieft|hoi|hallo|bedankt)\b/.test(t)) return 'dutch';
  if (/[a-z]/i.test(s) && /\b(the|and|to|of|please|make|use|tone|style)\b/i.test(s)) return 'english';
  return 'other';
}

// tiny Dutch → English (add phrases as needed)
function translateDutchToEnglish(s: string): string {
  return s
    .replace(/\bjij\b/gi, 'you')
    .replace(/\bje\b/gi, 'you')
    .replace(/\bjullie\b/gi, 'you')
    .replace(/\bbent\b/gi, 'are')
    .replace(/\bben\b/gi, 'am')
    .replace(/\balsjeblieft\b/gi, 'please')
    .replace(/\bbedankt\b/gi, 'thanks');
}

export function normalizeBuilderLine(line: string): string {
  const lang = detectLanguage(line);
  if (lang === 'dutch') return translateDutchToEnglish(line);
  return line;
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
    if (la === lb && la !== undefined) { rows.push({ t: 'same', text: la }); continue; }
    if (lb !== undefined && !setA.has(lb)) rows.push({ t: 'add', text: lb });
    if (la !== undefined && !setB.has(la)) rows.push({ t: 'rem', text: la });
  }
  for (let j = a.length; j < b.length; j++) {
    const lb = b[j];
    if (lb !== undefined && !setA.has(lb)) rows.push({ t: 'add', text: lb });
  }
  return rows;
}

/* ───────── Parse/serialize blocks ───────── */

const BLOCKS: Bucket[] = [
  '[Identity]',
  '[Style]',
  '[Response Guidelines]',
  '[Task & Goals]',
  '[Error Handling / Fallback]',
];

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
      if (BLOCKS.includes(t)) { current = t; return; }
      if (current) map[current].push(line);
    });

  return map;
}

function joinBlocks(map: BlocksMap): string {
  return BLOCKS.map((b) => {
    const body = (map[b] || [])
      .map((l) => rtrim(l))
      .filter((l, i, arr) => {
        if (l.trim() !== '') return true;
        const prev = arr[i - 1];
        return prev && prev.trim() !== '';
      })
      .join('\n');
    return `${b}\n${body}`.trim();
  }).join('\n\n');
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
    // drop junk bullets that sometimes slip in
    .filter((l) => !/^\-\s*$/.test(l))
    .filter((l) => l.trim().toLowerCase() !== '- assistant.')
    .filter((l) => l.trim().toLowerCase() !== 'assistant.')
    .filter((l) => l.trim() !== '-');

  return lines.join('\n').trim();
}

/* =========================================================
   NEW: Vertical Templates + Packs
   ========================================================= */

export type StylePack = {
  id: string;
  bullets: string[]; // goes under [Style]
};

export type SafetyPack = {
  id: string;
  bullets: string[]; // goes under [Error Handling / Fallback]
};

export type ToolPack = {
  id: string;
  guidelines: string[]; // goes under [Response Guidelines]
};

export type VerticalTemplate = {
  id: string;
  displayName: string;
  identity: string[]; // [Identity] lines (bullets or paragraphs)
  defaultTasks: string[]; // [Task & Goals] lines
  responseGuidelines?: string[]; // extra guidelines
  stylePacks?: string[]; // style pack ids
  safetyPacks?: string[]; // safety pack ids
  toolPacks?: string[]; // tool pack ids
};

export type PromptConfig = {
  verticalId: string;
  stylePackIds?: string[];
  safetyPackIds?: string[];
  toolPackIds?: string[];
  extraIdentity?: string[];
  extraGuidelines?: string[];
  extraTasks?: string[];
  extraFallback?: string[];
  language?: string; // visible hint: "Answer in {language}"
  brandName?: string;
  locale?: string; // e.g., "US", "UK"
};

/* ───────── Packs (add as many as you like / load from JSON) ───────── */

const STYLE_PACKS: Record<string, StylePack> = {
  'friendly_concise': {
    id: 'friendly_concise',
    bullets: [
      toBullet('Sound warm, competent, and to the point'),
      toBullet('Prefer short paragraphs and lists'),
      toBullet('Mirror the user’s formality and pace'),
    ],
  },
  'sales_consultative': {
    id: 'sales_consultative',
    bullets: [
      toBullet('Be upbeat and consultative, never pushy'),
      toBullet('Surface value, objections, and next steps'),
      toBullet('Keep CTAs explicit and easy to accept or decline'),
    ],
  },
  'support_empathetic': {
    id: 'support_empathetic',
    bullets: [
      toBullet('Acknowledge context and effort first'),
      toBullet('Keep instructions minimal and sequenced'),
      toBullet('Avoid blame; focus on solutions and prevention'),
    ],
  },
};

const SAFETY_PACKS: Record<string, SafetyPack> = {
  'default': {
    id: 'default',
    bullets: [
      toBullet('If user is abusive or frustrated, respond calmly and redirect to the goal'),
      toBullet('If the request conflicts with policy or law, refuse and suggest safer alternatives'),
      toBullet('If information is uncertain, state uncertainty and offer to verify'),
    ],
  },
  'healthcare': {
    id: 'healthcare',
    bullets: [
      toBullet('Not a medical professional; provide general info only'),
      toBullet('For urgent or alarming symptoms, advise seeking professional care'),
      toBullet('Avoid diagnosis; suggest discussing with a licensed clinician'),
    ],
  },
  'finance': {
    id: 'finance',
    bullets: [
      toBullet('Not financial advice; educational purposes only'),
      toBullet('Encourage consulting a licensed advisor for decisions'),
      toBullet('Avoid specific investment recommendations without context and risk disclosure'),
    ],
  },
};

const TOOL_PACKS: Record<string, ToolPack> = {
  'booking': {
    id: 'booking',
    guidelines: [
      toBullet('When booking, confirm dates, times, budget, and location before proceeding'),
      toBullet('Summarize choices with price and key trade-offs'),
      toBullet('After tool use, restate what changed and what’s next'),
    ],
  },
  'search': {
    id: 'search',
    guidelines: [
      toBullet('When searching, explain the plan briefly, then present verified results'),
      toBullet('Cite sources by name; highlight recency and credibility'),
    ],
  },
  'crm': {
    id: 'crm',
    guidelines: [
      toBullet('When updating CRM, confirm field names and values'),
      toBullet('Avoid overwriting unless explicitly requested; append notes safely'),
    ],
  },
};

/* ───────── Vertical Templates (sample set; extend to 1,000+) ───────── */

const VERTICALS: Record<string, VerticalTemplate> = {
  // 1) Dental clinic
  'health_dental': {
    id: 'health_dental',
    displayName: 'Dental Clinic Assistant',
    identity: [
      'You are a patient-first dental clinic assistant for {brand}.',
      'You help with appointment triage, insurance basics, pre-/post-op guidance, and friendly reminders.',
    ],
    defaultTasks: [
      'Greet and understand the patient’s concern or goal.',
      'Offer appointment options (date/time/provider), confirm insurance details if needed.',
      'Share pre-visit or after-care tips when relevant.',
      'Confirm booking and follow-up reminders.',
    ],
    responseGuidelines: [
      toBullet('Avoid medical diagnosis; share general info and link to clinician follow-up'),
      toBullet('Use lay language and provide timing expectations'),
    ],
    stylePacks: ['support_empathetic', 'friendly_concise'],
    safetyPacks: ['healthcare', 'default'],
    toolPacks: ['booking'],
  },

  // 2) Restaurant
  'hospitality_restaurant': {
    id: 'hospitality_restaurant',
    displayName: 'Restaurant Host & Concierge',
    identity: [
      'You are the official reservation and guest experience assistant for {brand}.',
      'Handle reservations, menu questions, dietary needs, and special occasions.',
    ],
    defaultTasks: [
      'Ask party size, date, time, seating preference, and occasion.',
      'Offer the best available slots; note dietary restrictions.',
      'Confirm reservation and provide arrival instructions.',
    ],
    responseGuidelines: [
      toBullet('Offer upsell options politely (tasting menu, pairings) when appropriate'),
    ],
    stylePacks: ['friendly_concise'],
    safetyPacks: ['default'],
    toolPacks: ['booking'],
  },

  // 3) E-commerce support
  'ecom_support': {
    id: 'ecom_support',
    displayName: 'E-commerce Support & Order Assistant',
    identity: [
      'You are a customer support assistant for {brand}, specializing in orders, returns, and product guidance.',
    ],
    defaultTasks: [
      'Authenticate the user if account action is needed.',
      'Locate the order or product and present status/options.',
      'Provide return/exchange policy and create labels if allowed.',
    ],
    responseGuidelines: [
      toBullet('Summarize resolution and timelines at the end of each turn'),
    ],
    stylePacks: ['support_empathetic', 'friendly_concise'],
    safetyPacks: ['default'],
    toolPacks: ['search'],
  },

  // 4) Real estate
  'realestate_buyer_agent': {
    id: 'realestate_buyer_agent',
    displayName: 'Real-Estate Buyer’s Agent Assistant',
    identity: [
      'You are a real-estate assistant for {brand} helping home buyers discover listings and prepare tours.',
    ],
    defaultTasks: [
      'Qualify budget, location, property type, must-haves/nice-to-haves.',
      'Share listings with key facts and trade-offs; schedule tours.',
      'Summarize next steps: pre-approval, docs, tour plan.',
    ],
    responseGuidelines: [
      toBullet('Avoid legal/financial advice; encourage consulting licensed pros'),
    ],
    stylePacks: ['friendly_concise', 'sales_consultative'],
    safetyPacks: ['default', 'finance'],
    toolPacks: ['search', 'booking'],
  },

  // 5) SaaS B2B Sales SDR
  'saas_sdr': {
    id: 'saas_sdr',
    displayName: 'SaaS SDR Assistant',
    identity: [
      'You are a B2B SaaS SDR assistant for {brand}, qualifying leads and booking demos.',
    ],
    defaultTasks: [
      'Identify role, pain points, current tools, and timeline.',
      'Map pains to value props; propose a demo slot.',
      'Confirm calendar invite and materials to send.',
    ],
    responseGuidelines: [
      toBullet('Keep outreach concise; end with a single, easy CTA'),
    ],
    stylePacks: ['sales_consultative', 'friendly_concise'],
    safetyPacks: ['default'],
    toolPacks: ['crm', 'booking'],
  },

  // 6) Fitness coach
  'fitness_coach': {
    id: 'fitness_coach',
    displayName: 'Personal Fitness Coach',
    identity: [
      'You are a motivational fitness coach for {brand}, crafting safe, goal-based routines.',
    ],
    defaultTasks: [
      'Clarify current level, injuries, equipment, and time per week.',
      'Propose a phased plan (warm-up, main, cooldown) with progression.',
      'Track adherence and adjust weekly.',
    ],
    responseGuidelines: [
      toBullet('Encourage gradual progression and rest days'),
    ],
    stylePacks: ['support_empathetic', 'friendly_concise'],
    safetyPacks: ['default', 'healthcare'],
    toolPacks: [],
  },

  // 7) Legal intake (non-advice)
  'legal_intake': {
    id: 'legal_intake',
    displayName: 'Law Firm Intake (No Legal Advice)',
    identity: [
      'You are a law-firm intake assistant for {brand}. You help collect case details and schedule consultations.',
    ],
    defaultTasks: [
      'Gather contact info, matter type, jurisdiction, and deadlines.',
      'Explain consultation process and conflicts checks.',
      'Offer available consultation times and next steps.',
    ],
    responseGuidelines: [
      toBullet('Do not provide legal advice; intake and scheduling only'),
    ],
    stylePacks: ['friendly_concise'],
    safetyPacks: ['default'],
    toolPacks: ['booking'],
  },

  // 8) HVAC service
  'hvac_service': {
    id: 'hvac_service',
    displayName: 'HVAC Service Coordinator',
    identity: [
      'You are a service coordinator for {brand} handling HVAC troubleshooting and appointments.',
    ],
    defaultTasks: [
      'Qualify system type, symptoms, model/age, and urgency.',
      'Offer troubleshooting steps when safe; otherwise schedule.',
      'Explain visit window and prep instructions.',
    ],
    responseGuidelines: [
      toBullet('Safety first: if gas smell or sparking, instruct immediate shutdown and call emergency services'),
    ],
    stylePacks: ['friendly_concise', 'support_empathetic'],
    safetyPacks: ['default'],
    toolPacks: ['booking'],
  },

  // 9) Travel planner
  'travel_planner': {
    id: 'travel_planner',
    displayName: 'Personal Travel Planner',
    identity: [
      'You are a travel planner for {brand}, designing itineraries that match budget and style.',
    ],
    defaultTasks: [
      'Gather destination, dates, budget, interests, pace, and constraints.',
      'Propose options with cost breakdown and trade-offs.',
      'Lock reservations when approved and share a concise itinerary.',
    ],
    responseGuidelines: [
      toBullet('Always summarize day-by-day with timings and must-knows'),
    ],
    stylePacks: ['friendly_concise'],
    safetyPacks: ['default'],
    toolPacks: ['search', 'booking'],
  },

  // 10) Generalist fallback
  'generalist': {
    id: 'generalist',
    displayName: 'General Purpose Assistant',
    identity: [
      'You are a multi-domain assistant for {brand}. Help with research, planning, writing, and task execution.',
    ],
    defaultTasks: [
      'Clarify goal, constraints, and timeline.',
      'Outline options, then execute or guide step-by-step.',
      'Confirm completion and provide follow-ups.',
    ],
    responseGuidelines: [],
    stylePacks: ['friendly_concise'],
    safetyPacks: ['default'],
    toolPacks: ['search'],
  },
};

/* =========================================================
   Builder: assemble a complete prompt from config
   ========================================================= */

export function buildPrompt(config: PromptConfig): string {
  const v = VERTICALS[config.verticalId] || VERTICALS['generalist'];

  const brand = config.brandName || 'the business';
  const identity = v.identity.map((l) => l.replace('{brand}', brand));

  const styleIds = [...new Set([...(v.stylePacks || []), ...(config.stylePackIds || [])])];
  const safetyIds = [...new Set([...(v.safetyPacks || []), ...(config.safetyPackIds || [])])];
  const toolIds   = [...new Set([...(v.toolPacks || []),   ...(config.toolPackIds || [])])];

  const styleLines = styleIds.flatMap((id) => STYLE_PACKS[id]?.bullets || []);
  const safetyLines = safetyIds.flatMap((id) => SAFETY_PACKS[id]?.bullets || []);
  const toolGuidelines = toolIds.flatMap((id) => TOOL_PACKS[id]?.guidelines || []);

  const guidelines = [
    ...(v.responseGuidelines || []),
    ...toolGuidelines,
    ...(config.extraGuidelines || []).map(toBullet),
  ];

  const tasks = [
    ...v.defaultTasks.map((t) => (t.startsWith('- ') ? t : `- ${t}`)),
    ...(config.extraTasks || []).map(toBullet),
  ];

  const fallback = [
    ...(safetyLines || []),
    ...(config.extraFallback || []).map(toBullet),
  ];

  if (config.language) {
    // Add explicit language directive to Style
    styleLines.unshift(toBullet(`Answer in ${config.language}`));
  }
  if (config.locale) {
    styleLines.push(toBullet(`Prefer ${config.locale} conventions for dates, units, and spelling`));
  }
  if (config.extraIdentity?.length) {
    identity.push(...config.extraIdentity);
  }

  const map: BlocksMap = {
    '[Identity]': identity,
    '[Style]': styleLines,
    '[Response Guidelines]': guidelines,
    '[Task & Goals]': tasks,
    '[Error Handling / Fallback]': fallback,
  };

  return normalizeFullPrompt(joinBlocks(map));
}

/* =========================================================
   Router: guess config from free-text so users can just describe
   ========================================================= */

const ROUTER: Array<{pattern: RegExp; verticalId: string}> = [
  { pattern: /\b(dentist|dental|teeth|tooth|orthodont|hygien)/i, verticalId: 'health_dental' },
  { pattern: /\b(reserv|restaurant|table|seating|menu|host)/i, verticalId: 'hospitality_restaurant' },
  { pattern: /\b(order|return|refund|shipment|e-?commerce|store)/i, verticalId: 'ecom_support' },
  { pattern: /\b(estate|realtor|listing|tour|open house|mls)/i, verticalId: 'realestate_buyer_agent' },
  { pattern: /\b(saas|demo|lead|pipeline|crm|cold|sdr)/i, verticalId: 'saas_sdr' },
  { pattern: /\b(workout|gym|trainer|fitness|coach)/i, verticalId: 'fitness_coach' },
  { pattern: /\b(legal|law firm|attorney|intake|case)/i, verticalId: 'legal_intake' },
  { pattern: /\b(hvac|air conditioning|furnace|heating|cooling|ac)/i, verticalId: 'hvac_service' },
  { pattern: /\b(travel|itinerary|flight|hotel|vacation|trip)/i, verticalId: 'travel_planner' },
];

export function suggestConfigFromText(freeText: string): PromptConfig {
  const hit = ROUTER.find(r => r.pattern.test(freeText));
  return {
    verticalId: hit?.verticalId || 'generalist',
  };
}

/* =========================================================
   Free-text -> structured merge (backwards compatible with your UI)
   ========================================================= */

export function generateFromFreeText(
  basePrompt: string,
  freeText: string,
  _opts?: GenerateOptions
): GenerateResult {
  // route and build a vertical prompt, then merge the free-text rules in Response Guidelines
  const route = suggestConfigFromText(freeText);
  const verticalPrompt = buildPrompt(route);

  const base = ensureBlocks(basePrompt || DEFAULT_PROMPT || PROMPT_SKELETON);
  const mergedBaseBlocks = splitIntoBlocks(verticalPrompt || base);

  const lines = freeText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const bucketsAdded: Partial<Record<Bucket, number>> = {};

  for (const raw of lines) {
    const normalized = normalizeBuilderLine(raw);
    // Basic routing of user bullets into reasonable spots:
    // if it looks like "ask/collect/do" -> Task; else -> Guidelines; insults -> fallback.
    const lower = normalized.toLowerCase();
    let bucket: Bucket = '[Response Guidelines]';
    if (/\b(task|goal|collect|ask|confirm|schedule|book|flow|process|qualify|onboard|intake)\b/.test(lower))
      bucket = '[Task & Goals]';
    if (/\b(error|fallback|fail|misunderstanding|retry|sorry|abuse|insult|refuse)\b/.test(lower))
      bucket = '[Error Handling / Fallback]';

    const bullet = toBullet(normalized);
    mergedBaseBlocks[bucket].push(bullet);
    bucketsAdded[bucket] = (bucketsAdded[bucket] || 0) + 1;
  }

  const nextPrompt = joinBlocks(mergedBaseBlocks);
  const diff = computeDiff(base, nextPrompt);
  const added = diff.filter((d) => d.t === 'add').length;
  const removed = diff.filter((d) => d.t === 'rem').length;

  return { nextPrompt: normalizeFullPrompt(nextPrompt), diff, added, removed, bucketsAdded };
}

export function applyInstructions(
  basePrompt: string,
  instructions: string,
  opts?: GenerateOptions
): { merged: string; summary: string; diff: DiffRow[] } {
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
