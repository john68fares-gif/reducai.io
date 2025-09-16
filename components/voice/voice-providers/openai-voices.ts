// components/voice/voice-providers/openai-voices.ts
// OpenAI TTS voice allow-list + helpers.
// Model to use: "gpt-4o-mini-tts" (works for TTS streaming or file gen).

export type LocaleKey =
  | 'en-US' // American English
  | 'en-GB' // British English
  | 'en-AU' // Australian English
  | 'es-ES' // Spanish
  | 'de-DE' // German
  | 'nl-NL';// Dutch

// Curated human-friendly labels for UI (you can rename to your taste)
export const localeLabels: Record<LocaleKey, string> = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'en-AU': 'English (Australia)',
  'es-ES': 'Spanish',
  'de-DE': 'German',
  'nl-NL': 'Dutch',
};

// OpenAI doesn’t publish a list endpoint; maintain an allow-list.
// These voices are known to work with gpt-4o-mini-tts.
// Keep the set small and consistent for product feel.
const OPENAI_VOICE_SETS: Record<LocaleKey, string[]> = {
  // You can re-use the same voices across locales if you like their timbre.
  'en-US': ['alloy', 'verse', 'aria', 'sage'],
  'en-GB': ['aria', 'alloy', 'verse'],
  'en-AU': ['verse', 'alloy', 'aria'],
  'es-ES': ['aria', 'sage'],
  'de-DE': ['sage', 'alloy'],
  'nl-NL': ['aria', 'verse'],
};

// Optional pretty names (UI). Keys are the voice IDs you pass to OpenAI.
export const voiceLabel: Record<string, string> = {
  alloy: 'Alloy',
  verse: 'Verse',
  aria:  'Aria',
  sage:  'Sage',
};

export function getOpenAIVoices(locale: LocaleKey) {
  const list = OPENAI_VOICE_SETS[locale] || [];
  return list.map(v => ({ value: v, label: voiceLabel[v] || v }));
}

// If you centralize the model string:
export const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
