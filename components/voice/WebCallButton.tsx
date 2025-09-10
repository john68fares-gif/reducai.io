// components/voice/WebCallButton.tsx (only the changed pieces)
export type WebCallButtonProps = {
  greet: string;
  voiceLabel: string;
  systemPrompt: string;
  model: string;
  onTurn: (role: 'user'|'assistant', text: string) => void;
  apiKey: string;                       // ← NEW
  endpoint?: string;                    // ← NEW (default /api/va-chat)
};

export default function WebCallButton({
  greet, voiceLabel, systemPrompt, model, onTurn, apiKey, endpoint = '/api/va-chat',
}: WebCallButtonProps) {
  // ...
  async function askLLM(userText: string): Promise<string> {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        user: userText,
        key: apiKey,                  // ← send key from settings
      }),
    });
    if (!r.ok) throw new Error('chat failed');
    const j = await r.json();
    return (j?.text || '').trim() || 'Understood.';
  }
  // ...
}
