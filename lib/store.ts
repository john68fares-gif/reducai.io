// lib/store.ts

export type VoiceSettings = {
  systemPrompt: string;
  ttsVoice: string;
  language: string;
  fromE164: string;
  assistantId?: string;
  publicKey?: string;
};

type PhoneNum = { id: string; e164: string; label?: string; provider?: string; status?: string };

type Store = {
  settings: VoiceSettings;
  numbers: PhoneNum[];
  attachments: Record<string, string>; // agentId -> phone number
};

const defaultSettings: VoiceSettings = {
  systemPrompt: '',
  ttsVoice: 'Polly.Joanna',
  language: 'en-US',
  fromE164: '',
  assistantId: '',
  publicKey: '',
};

let __store: Store =
  (global as any).__VOICE_STORE__ ??
  {
    settings: defaultSettings,
    numbers: [
      { id: 'n1', e164: '+12025550123', label: 'Sales US', provider: 'twilio', status: 'active' },
      { id: 'n2', e164: '+442071231234', label: 'UK',        provider: 'twilio', status: 'active' },
    ],
    attachments: {},
  };

export function getStore(): Store {
  return __store;
}

(global as any).__VOICE_STORE__ = __store;
