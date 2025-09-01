export type HelpdeskPreset = {
  id: string;
  name: string;
  description?: string;
  personality: string;   // new field: how the AI should behave
  assistantId: string;
  publicKey: string;
  published: boolean;
};

export const HELP_DESK_PRESETS: HelpdeskPreset[] = [
  {
    id: 'helpful-short',
    name: 'Helpful Assistant',
    description: 'Short, tidy answers. Explains clearly without extra fluff.',
    personality: `
      You are a support assistant for reduc.ai.
      Personality:
      - Always be concise: short, tidy sentences.
      - Never write more words than needed, but stay clear and helpful.
      - If explanation is needed, break it down step by step, but still keep answers compact.
      - Be friendly and professional, not too formal, not too casual.
      - Goal: help the user understand the platform quickly without scrolling walls of text.
    `,
    assistantId: 'ASSISTANT_ID_HERE',   // replace with your real ID
    publicKey: 'PUBLIC_KEY_HERE',       // replace with your real key
    published: true,
  },
];
