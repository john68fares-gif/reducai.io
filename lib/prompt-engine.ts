/* =========================================================
   Prompt Engine — structured editing + input normalization
   ========================================================= */

/* ───────── Canonical blocks ───────── */

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

/* ───────── Utility: ensure the 5 sections exist ───────── */

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

/* ───────── Lightweight language detection + translation ───────── */

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

/* ───────── Cleaners & guards (NEW) ───────── */

const JUNK_LINE_REGEXES: RegExp[] = [
  /^\s*[-–—•]\s*$/i,                // lone bullet
  /^\s*[-–—•]\s*assistant\.?\s*$/i, // "- assistant."
  /^\s*assistant\.?\s*$/i,          // "assistant."
];

function cleanLines(lines: string[]): string[] {
  const out: string[] = [];
  let prevBlank = false;

  for (const raw of lines) {
    const rtrim = raw.replace(/\s+$/g, '');
    const trimmed = rtrim.trim();

    if (JUNK_LINE_REGEXES.some(rx => rx.test(trimmed))) continue;

    const isBlank = trimmed === '';
    if (isBlank && prevBlank) continue;
    out.push(rtrim);
    prevBlank = isBlank;
  }
  while (out[0] && out[0].trim() === '') out.shift();
  while (out[out.length - 1] && out[out.length - 1].trim() === '') out.pop();
  return out;
}

function getSectionBodies(raw: string): Record<'Identity'|'Style'|'Response'|'Task'|'Error', string[]> {
  const map: Record<'Identity'|'Style'|'Response'|'Task'|'Error', string[]> = {
    Identity: [], Style: [], Response: [], Task: [], Error: []
  };
  let cur: keyof typeof map | null = null;

  const headerToKey = (h: string): keyof typeof map | null => {
    if (/^\s*\[Identity\]\s*$/i.test(h)) return 'Identity';
    if (/^\s*\[Style\]\s*$/i.test(h)) return 'Style';
    if (/^\s*\[Response Guidelines\]\s*$/i.test(h)) return 'Response';
    if (/^\s*\[Task & Goals\]\s*$/i.test(h)) return 'Task';
    if (/^\s*\[Error Handling\s*\/\s*Fallback\]\s*$/i.test(h)) return 'Error';
    return null;
  };

  const lines = String(raw ?? '').split('\n');
  for (const line of lines) {
    const key = headerToKey(line);
    if (key) { cur = key; continue; }
    if (!cur) continue;
    map[cur].push(line);
  }
  (Object.keys(map) as Array<keyof typeof map>).forEach(k => { map[k] = cleanLines(map[k]); });
  return map;
}

/** Backfill any empty section from DEFAULT_PROMPT. */
function ensureNonEmptySections(raw: string): string {
  const base = looksLikeFullPrompt(raw) ? raw : ensureBlocks(raw);
  const bodies = getSectionBodies(base);
  const fallback = getSectionBodies(DEFAULT_PROMPT);

  const rebuild = (label: string, key: keyof typeof bodies) => {
    const lines = bodies[key].length ? bodies[key] : fallback[key];
    return [label, ...lines, ''].join('\n');
  };

  return [
    rebuild('[Identity]', 'Identity'),
    rebuild('[Style]', 'Style'),
    rebuild('[Response Guidelines]', 'Response'),
    rebuild('[Task & Goals]', 'Task'),
    rebuild('[Error Handling / Fallback]', 'Error'),
  ].join('\n').trim();
}

/* ───────── Turn raw phrases into professional rules ───────── */

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

/* ───────── Routing rules ───────── */

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

/* ───────── Parse/serialize blocks ───────── */

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
  const chunks = BLOCKS.map((b) => {
    const lines = cleanLines(map[b] || []);
    return `${b}\n${lines.join('\n')}`.trim();
  });
  return chunks.join('\n\n');
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

/* ───────── Public API (builder) ───────── */

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

  const nextPromptDirty = joinBlocks(blocks);
  const nextPrompt = normalizeFullPrompt(nextPromptDirty); // ensure cleaned
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
  if (looksLikeFullPrompt(instructions)) {
    const normalized = normalizeFullPrompt(instructions);
    const merged = ensureNonEmptySections(normalized);
    const diff = computeDiff(basePrompt || DEFAULT_PROMPT, merged);
    return { merged, summary: 'Replaced prompt (manual paste).', diff };
  }

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

/* ───────── Full-prompt detection & normalization ───────── */

export function looksLikeFullPrompt(raw: string): boolean {
  const t = raw || '';
  return (
    /\[Identity\]/i.test(t) &&
    /\[Style\]/i.test(t) &&
    /\[Response Guidelines\]/i.test(t) &&
    /\[Task & Goals\]/i.test(t) &&
    /\[Error Handling \/ Fallback\]/i.test(t)
  );
}

export function normalizeFullPrompt(raw: string): string {
  const safe = ensureBlocks(String(raw ?? ''));
  const cleaned = cleanLines(safe.split('\n'));
  return cleaned.join('\n').trim();
}
