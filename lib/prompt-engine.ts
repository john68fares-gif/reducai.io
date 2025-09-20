// prompt-engine.ts

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

  // If anything is missing, start from a clean skeleton
  return PROMPT_SKELETON;
}

/* ───────── Lightweight language detection + translation ─────────
   We normalize builder input into English so the downstream routing
   works consistently. (Stub; swap with real translation later.)
*/

type Lang = 'english' | 'dutch' | 'other';

function detectLanguage(s: string): Lang {
  const t = s.toLowerCase();

  // crude Dutch hints
  if (/\b(jij|je|jullie|bent|ben|een|echt|dom|alsjeblieft|hoi|hallo|bedankt|toon|vriendelijk|korte|antwoorden)\b/.test(t)) {
    return 'dutch';
  }

  // crude English hint (latin chars + common words)
  if (/[a-z]/i.test(s) && /\b(the|and|to|of|a|you|your|please|make|use|tone|style)\b/i.test(s)) {
    return 'english';
  }

  // fallthrough
  return 'other';
}

// Tiny phrase-level Dutch → English (extend as you like)
function translateDutchToEnglish(s: string): string {
  return s
    // pronouns / basic verbs
    .replace(/\bjij\b/gi, 'you')
    .replace(/\bje\b/gi, 'you')
    .replace(/\bjullie\b/gi, 'you')
    .replace(/\bbent\b/gi, 'are')
    .replace(/\bben\b/gi, 'am')
    .replace(/\been\b/gi, 'a')
    .replace(/\becht\b/gi, 'really')
    .replace(/\bdom\b/gi, 'dumb')
    // common prompt words
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

// Normalize a single instruction line into English
export function normalizeBuilderLine(line: string): string {
  const lang = detectLanguage(line);
  if (lang === 'dutch') return translateDutchToEnglish(line);
  // If "other", return as-is (or plug a real translator later)
  return line;
}

/* ───────── Turn raw phrases into professional rules ─────────
   - Converts insults or rough phrasing into clear, helpful policy lines.
   - Adds punctuation & bullet formatting to fit the blocks cleanly.
*/

function toBullet(s: string): string {
  const trimmed = s.trim().replace(/^[-•\u2022]\s*/, ''); // strip leading bullets
  return `- ${/[.!?]$/.test(trimmed) ? trimmed : trimmed + '.'}`;
}

/** Convert harsh/insult examples into a calm professional fallback rule. */
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

/* ───────── Routing rules ─────────
   Decide which block a given (normalized) line belongs to.
*/

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

  // default → Response Guidelines
  return '[Response Guidelines]';
}

function rewriteToProfessional(line: string): string {
  // If line is an insult or contains a toxic example → convert to fallback policy.
  const fallback = sanitizeInsultsToFallback(line);
  if (fallback) return fallback;

  // Otherwise, keep the user's intent but make it a crisp, instructive rule.
  // Light transformations (turn imperative hints into proper policy lines).
  let s = line.trim();

  // Common quick rephrasings
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

/* ───────── Public API ───────── */

export type GenerateOptions = {
  /** Currently unused; when you add more languages later, pass in 'English', 'Dutch', etc. */
  agentLanguage?: string;
};

export type GenerateResult = {
  nextPrompt: string;
  diff: DiffRow[];
  added: number;
  removed: number;
  bucketsAdded: Partial<Record<Bucket, number>>;
};

/**
 * Merge free-text instructions into a structured prompt.
 * - Normalizes input to English (simple Dutch→English stub).
 * - Rewrites rough input to professional lines.
 * - Routes to the correct block.
 * - Returns the merged prompt + a change summary.
 */
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
    // 1) normalize (translate to English if needed)
    const normalized = normalizeBuilderLine(raw);

    // 2) decide target bucket
    const bucket = routeBucketOf(normalized);

    // 3) rewrite to professional policy line
    const policy = rewriteToProfessional(normalized);

    // 4) append to that block
    blocks[bucket].push(policy);

    bucketsAdded[bucket] = (bucketsAdded[bucket] || 0) + 1;
  }

  const nextPrompt = joinBlocks(blocks);

  const diff = computeDiff(base, nextPrompt);
  const added = diff.filter((d) => d.t === 'add').length;
  const removed = diff.filter((d) => d.t === 'rem').length;

  return { nextPrompt, diff, added, removed, bucketsAdded };
}

/* ───────── Convenience: apply+summarize in one go ───────── */

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

/* ───────── Example (for quick local testing; remove in prod) ─────────
const demoBase = DEFAULT_PROMPT;
const demoInput = `
maak de toon vriendelijker en gebruik korte antwoorden
als de gebruiker zegt jij bent dom
format answers with numbered steps
collect name and email first
`;

const out = applyInstructions(demoBase, demoInput);
console.log(out.summary);
console.log(out.merged);
--------------------------------------------------------------------- */
