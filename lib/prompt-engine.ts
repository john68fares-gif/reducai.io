// lib/prompt-engine.ts
/**
 * Prompt Engine — assemble, normalize, and extend system prompts.
 *
 * Works with lib/prompt-presets.ts (PRESETS, TONE_CANONICAL, etc.)
 *
 * Features:
 * - assemblePromptFromPreset: build full system prompt from a preset, brand, tone, booking, services
 * - looksLikeFullPrompt / normalizeFullPrompt: detect and clean pasted full prompts
 * - generateFromFreeText: convert short user instructions into added professional bullets (bucketed)
 * - applyInstructions: wrapper that returns merged prompt + human-readable summary + diff rows
 *
 * This file is intentionally framework/library-agnostic and test-friendly.
 */

import {
  PRESETS,
  IndustryKey,
  toneToStyleSentence,
  TONE_CANONICAL,
  DEFAULT_TONE,
  bookingToText,
  Preset,
  DiffRow,
} from './prompt-presets';

/* --------------------- Types --------------------- */

export type GenerateOptions = {
  agentLanguage?: string; // reserved for future i18n normalization
};

export type GenerateResult = {
  nextPrompt: string;
  diff: DiffRow[];
  added: number;
  removed: number;
  bucketsAdded: Partial<Record<string, number>>;
};

export type ApplyResult = {
  merged: string;
  summary: string;
  diff: DiffRow[];
};

/* --------------------- Utilities --------------------- */

/**
 * Ensure the five canonical blocks exist and are in order.
 * If base is missing some headers we use a skeleton from PRESETS generic shape.
 */
const HEADERS = [
  '[Identity]',
  '[Style]',
  '[Response Guidelines]',
  '[Task & Goals]',
  '[Error Handling / Fallback]',
];

function ensureBlocksOrder(raw: string): string {
  if (!raw || typeof raw !== 'string') return HEADERS.join('\n\n');
  // If it already contains all headers, return as-is (but preserve order).
  const hasAll = HEADERS.every(h => raw.includes(h));
  if (hasAll) {
    // Re-order into canonical order to avoid weird variants
    const map = splitIntoBlocks(raw);
    return joinBlocks(map);
  }
  return HEADERS.join('\n\n');
}

/* --------------------- Block parsing helpers --------------------- */

type BlocksMap = Record<string, string[]>;

function emptyBlocksMap(): BlocksMap {
  const out: BlocksMap = {};
  for (const h of HEADERS) out[h] = [];
  return out;
}

/**
 * Split a prompt text into canonical blocks.
 * Keeps original lines (non-header lines) and preserves spacing minimally.
 */
export function splitIntoBlocks(base: string): BlocksMap {
  const safe = ensureBlocksOrder(base);
  const map = emptyBlocksMap();
  const lines = safe.split('\n');
  let current: string | null = null;

  for (let rawLine of lines) {
    const line = rawLine ?? '';
    const trimmed = line.trim();
    if (HEADERS.includes(trimmed)) {
      current = trimmed;
      continue;
    }
    if (current) map[current].push(line);
  }
  return map;
}

function joinBlocks(map: BlocksMap): string {
  return HEADERS.map(h => `${h}\n${(map[h] || []).join('\n')}`.trim()).join('\n\n').trim();
}

/* --------------------- Diff util (for UI) --------------------- */

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
  // Add trailing additions if any (already handled above mostly)
  for (let j = a.length; j < b.length; j++) {
    const lb = b[j];
    if (lb !== undefined && !setA.has(lb)) rows.push({ t: 'add', text: lb });
  }
  return rows;
}

/* --------------------- Full prompt detection & normalization --------------------- */

/** True if raw contains all canonical headers (loose match) */
export function looksLikeFullPrompt(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const t = raw;
  return HEADERS.every(h => new RegExp(escapeRegExp(h)).test(t));
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize a complete prompt:
 * - ensures the canonical headers (order preserved)
 * - rtrim lines
 * - collapse multiple blank lines
 * - remove junk solitary bullets like "- assistant." or lone "-"
 */
export function normalizeFullPrompt(raw: string): string {
  const safe = ensureBlocksOrder(String(raw ?? ''));
  const lines = safe
    .split('\n')
    .map(l => l.replace(/\s+$/g, '')) // rtrim
    .filter((l, i, arr) => {
      // collapse 2+ blank lines to max 1
      if (l.trim() !== '') return true;
      const prev = arr[i - 1];
      return prev && prev.trim() !== '';
    })
    .filter(l => !/^\-\s*$/.test(l)) // remove lone "-"
    .filter(l => l.trim().toLowerCase() !== '- assistant.')
    .filter(l => l.trim().toLowerCase() !== 'assistant.')
    .filter(l => l.trim() !== '-');

  return lines.join('\n').trim();
}

/* --------------------- Convert user phrases -> professional bullets --------------------- */

/**
 * Minimal rewrite heuristics:
 * - Trim and convert to a bullet (- ...)
 * - Convert rude inputs to safety fallback instructions
 * - Normalize some starter phrases to better grammar
 */
function toBullet(s: string): string {
  const trimmed = s.trim().replace(/^[-•\u2022]\s*/, '');
  const sentence = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  // Ensure it starts with a dash and a space for easy diff visibility.
  return `- ${sentence}`;
}

function sanitizeInsultsToFallback(line: string): string | null {
  const t = line.toLowerCase();
  // If user typed abuse/insult, map to a fallback rule line
  const looksLikeInsultExample =
    /\b(you are (really )?dumb|you suck|idiot|stupid|dumb|trash|useless|hate)\b/.test(t);
  if (!looksLikeInsultExample) return null;
  return toBullet(
    'If a user expresses frustration or uses insults, remain calm and professional. Redirect to solving the user’s problem and offer to escalate to a human if needed.'
  );
}

/* Route simple line to one of the five buckets using key terms */
function routeBucketOf(line: string): string {
  const s = line.toLowerCase();
  if (/\b(identity|persona|role|act as|behave as|you are)\b/.test(s)) return '[Identity]';
  if (/\b(tone|style|friendly|formal|approachable|concise|polite|empathetic|confidence|voice|voice style|tone)\b/.test(s))
    return '[Style]';
  if (/\b(guideline|format|answer|response|clarity|steps|list|jargon|brevity|structure|citation|example)\b/.test(s))
    return '[Response Guidelines]';
  if (/\b(task|goal|collect|ask|confirm|escalate|handoff|flow|process|onboarding|qualify|booking|schedule|pricing|offer)\b/.test(s))
    return '[Task & Goals]';
  if (/\b(error|fallback|fail|misunderstanding|retry|sorry|apologize|escalate|abuse|insult|frustration|emergency)\b/.test(s))
    return '[Error Handling / Fallback]';

  // Default fallback: response guidelines
  return '[Response Guidelines]';
}

/* Normalize a single builder line (language detection plug can be later) */
export function normalizeBuilderLine(line: string): string {
  // For now just trim. Placeholder for advanced normalization (translation, spelling fixes).
  return line.trim();
}

/**
 * generateFromFreeText:
 * - basePrompt: existing full prompt (may be DEFAULT_PROMPT or empty)
 * - freeText: multi-line instructions (bullets / sentences)
 *
 * It normalizes, routes into buckets, rewrites to professional bullets, merges,
 * and returns a diff + summary.
 */
export function generateFromFreeText(
  basePrompt: string,
  freeText: string,
  _opts?: GenerateOptions
): GenerateResult {
  const base = ensureBlocksOrder(basePrompt || '');
  const blocks = splitIntoBlocks(base);

  const rawLines = (freeText || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const bucketsAdded: Partial<Record<string, number>> = {};
  for (const raw of rawLines) {
    const normalized = normalizeBuilderLine(raw);
    // sanitize rude inputs to fallback
    const fallback = sanitizeInsultsToFallback(normalized);
    const policy = fallback ? fallback : toBullet(normalized);
    const bucket = routeBucketOf(normalized);
    blocks[bucket].push(policy);
    bucketsAdded[bucket] = (bucketsAdded[bucket] || 0) + 1;
  }

  const nextPrompt = joinBlocks(blocks);
  const diff = computeDiff(base, nextPrompt);
  const added = diff.filter(d => d.t === 'add').length;
  const removed = diff.filter(d => d.t === 'rem').length;

  return { nextPrompt, diff, added, removed, bucketsAdded };
}

/* Wrapper that applies instructions and returns summary text for UI */
export function applyInstructions(
  basePrompt: string,
  instructions: string,
  opts?: GenerateOptions
): ApplyResult {
  const { nextPrompt, diff, added, removed, bucketsAdded } = generateFromFreeText(basePrompt, instructions, opts);

  const parts: string[] = [];
  if (added || removed) parts.push(`+${added} / -${removed} lines`);
  const bucketBits = Object.entries(bucketsAdded)
    .map(([k, v]) => `${k} +${v}`)
    .join(', ');
  if (bucketBits) parts.push(bucketBits);

  const summary = parts.join(' · ') || 'No changes';

  return { merged: nextPrompt, summary, diff };
}

/* --------------------- Assemble full prompt from preset --------------------- */

/**
 * assemblePromptFromPreset:
 * - Takes an industry key (preset), brand, locale/title, tone, services list, booking info
 * - Assembles a full prompt with the canonical sections, injecting preset instructions and generated style sentences.
 *
 * This lets you show a "full prompt" in the textarea (frontend) that is consistent and machine-friendly.
 */
export function assemblePromptFromPreset(params: {
  industry: IndustryKey | string;
  brand?: string;
  inLocation?: string;
  tone?: string; // friendly, warm, formal, etc.
  services?: string[]; // optional list of business services to mention
  booking?: { type: string; url?: string; phone?: string; hours?: string } | null;
  basePrompt?: string; // optional existing system prompt to merge into
}): string {
  const {
    industry,
    brand = 'Assistant',
    inLocation = '',
    tone,
    services = [],
    booking = null,
    basePrompt = '',
  } = params;

  const presetKey = ((industry || 'generic') as string) as keyof typeof PRESETS;
  const preset: Preset = (PRESETS as any)[presetKey] || PRESETS.generic;

  // Tone canonicalization
  const tKey = (tone && (TONE_CANONICAL as any)[tone.toLowerCase()]) || (Object.values(TONE_CANONICAL)[0] ?? DEFAULT_TONE);
  const styleSentences = toneToStyleSentence((tKey as any) ?? DEFAULT_TONE);

  // Basic identity injection
  const inLocText = inLocation ? ` in ${inLocation}` : '';
  const bookingText = booking ? bookingToText(booking as any) : '';

  // Build identity block (with brand and booking)
  const identityParts: string[] = [];
  // Use preset identity template if present; otherwise fallback
  if (preset.templateInstructions?.identity) {
    identityParts.push(
      preset.templateInstructions.identity
        .replace(/\$\{brand\}/g, brand)
        .replace(/\$\{inLocation\}/g, inLocText)
        .replace(/\$\{bookingText\}/g, bookingText)
    );
  } else {
    identityParts.push(`${brand} assistant${inLocText}.`);
  }

  // If services are present, add a short line describing them
  if (services && services.length) {
    const svcLine = `Services: ${services.slice(0, 8).join(', ')}.`; // limit length
    identityParts.push(svcLine);
  }

  // Style block: preset style + tone sentences
  const styleBlock = [
    ...(preset.templateInstructions?.style ?? []),
    ...styleSentences,
  ];

  // Response Guidelines: preset responseGuidelines
  const responseGuidelines = preset.templateInstructions?.responseGuidelines ?? [
    'Be concise and helpful.',
  ];

  // Task & Goals
  const taskGoals = preset.templateInstructions?.taskGoals ?? ['Assist the user to completion or handoff.'];

  // Error / fallback
  const fallback = preset.templateInstructions?.fallback ?? [
    'If unsure, ask a clarifying question.',
    'If a tool fails, apologize and offer alternative options.',
  ];

  // Compose blocks object
  const blocks: BlocksMap = {
    '[Identity]': identityParts,
    '[Style]': styleBlock,
    '[Response Guidelines]': responseGuidelines,
    '[Task & Goals]': taskGoals,
    '[Error Handling / Fallback]': fallback,
  };

  // Merge with basePrompt if provided: prefer base for lines already present
  if (basePrompt && looksLikeFullPrompt(basePrompt)) {
    // We will merge: keep base's lines, append any missing instructions from preset
    const baseMap = splitIntoBlocks(basePrompt);
    for (const h of HEADERS) {
      // Append preset lines to base if they are not duplicates
      const presetLines = blocks[h] || [];
      const baseLinesSet = new Set((baseMap[h] || []).map(l => l.trim()));
      for (const pl of presetLines) {
        if (!baseLinesSet.has(pl.trim())) baseMap[h].push(pl);
      }
    }
    return joinBlocks(baseMap);
  }

  return joinBlocks(blocks);
}

/* --------------------- Exports --------------------- */

export default {
  assemblePromptFromPreset,
  generateFromFreeText,
  applyInstructions,
  computeDiff,
  looksLikeFullPrompt,
  normalizeFullPrompt,
  splitIntoBlocks,
  joinBlocks,
};
