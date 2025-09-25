// FILE: utils/prompt-builder.ts
'use client';

/**
 * Utilities for generating prompts for agents from raw website text or user description.
 * Split out of VoiceAgentSection to reduce its size.
 */

export const DEFAULT_PROMPT = `[Identity]

[Style]

[Response Guidelines]

[Task & Goals]

[Error Handling / Fallback]`;

export type PromptBuckets = {
  identity: string;
  services: string;
  contact: string;
  sponsors: string;
  other: string;
};

function sliceAround(regex: RegExp, text: string, take = 1600): string {
  const lower = text.toLowerCase();
  const m = lower.match(regex);
  if (!m) return '';
  const i = Math.max(0, m.index || 0);
  return text.slice(i, i + take).trim();
}

/** Roughly categorize website text into identity/services/etc. */
export function toBuckets(raw: string): PromptBuckets {
  const text = (raw || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  return {
    identity: [
      sliceAround(/\b(about us|about|who we are|our story|mission|vision|values)\b/, text),
      sliceAround(/\b(team|leadership|founders)\b/, text),
    ].filter(Boolean).join('\n\n'),
    services: sliceAround(/\b(services|what we do|products|solutions|offerings)\b/, text),
    contact:  sliceAround(/\b(contact|get in touch|address|email|phone)\b/, text),
    sponsors: sliceAround(/\b(sponsors?|partners?|our partners|supported by)\b/, text),
    other: text,
  };
}

/** Build a structured prompt from raw site content + a base template. */
export function buildPromptFromWebsite(raw: string, basePrompt = DEFAULT_PROMPT): string {
  const b = toBuckets(raw);
  const blocks: string[] = [];
  if (b.identity)  blocks.push(`[Identity]\n${b.identity}`);
  if (b.services)  blocks.push(`[Services]\n${b.services}`);
  if (b.contact)   blocks.push(`[Contact]\n${b.contact}`);
  if (b.sponsors)  blocks.push(`[Sponsors]\n${b.sponsors}`);
  if (b.other)     blocks.push(`[Context]\n${b.other.slice(0, 4000)}`);
  return [basePrompt.trim(), ...blocks].join('\n\n').trim();
}
