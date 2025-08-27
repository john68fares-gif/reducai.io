// utils/apiKeys.ts
export type StoredKeys = {
  openaiKey?: string;
  vapiPublicKey?: string;
  vapiAssistantId?: string;
  twilioSid?: string;
  twilioAuth?: string;
};

const LS_KEY = 'app:keys';

export function loadKeys(): StoredKeys {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as StoredKeys) : {};
  } catch {
    return {};
  }
}

export function saveKeys(next: StoredKeys) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {}
}

/**
 * Optional convenience: also seed the Voice Agent local backup so the widget fields
 * (assistantId/publicKey) auto-fill when the user visits /voice-agent next time.
 */
export function seedVoiceSettingsFromKeys(keys: StoredKeys) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('voice:settings:backup') || '{}';
    const cur = JSON.parse(raw);
    const merged = {
      ...cur,
      publicKey: keys.vapiPublicKey || cur.publicKey || '',
      assistantId: keys.vapiAssistantId || cur.assistantId || '',
    };
    localStorage.setItem('voice:settings:backup', JSON.stringify(merged));
  } catch {}
}
