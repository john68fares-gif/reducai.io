// components/builder/Step2ModelSettings.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cpu, Bolt, Rocket, Gauge, KeyRound, ArrowLeft, ArrowRight } from 'lucide-react';
import StepProgress from './StepProgress';
import { scopedStorage, migrateLegacyKeysToUser } from '@/utils/scoped-storage';

type Props = {
  onBack: () => void;
  onNext: (data: { model: string; apiKeyId: string }) => void;
};

type ApiKey = { id: string; name: string; key: string };

const MODEL_OPTIONS = [
  { value: 'gpt-4o',        label: 'GPT-4o',         icon: Bolt },
  { value: 'gpt-4o-mini',   label: 'GPT-4o mini',    icon: Rocket },
  { value: 'gpt-4.1',       label: 'GPT-4.1',        icon: Cpu },
  { value: 'gpt-4.1-mini',  label: 'GPT-4.1 mini',   icon: Gauge },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo',  icon: Cpu },
];

/* === EXACT same button colors as Step1 === */
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

/**
 * Create an OpenAI Assistant using the user's scoped Step 2 selections + API key.
 * (Keeps your original behavior, but now reads via scopedStorage per-account.)
 */
export async function createOpenAIAssistantFromLocalSelections(opts?: {
  nameOverride?: string;
  instructionsOverride?: string;
}) {
  const ss = await scopedStorage();
  await ss.ensureOwnerGuard();

  const s2 = (await ss.getJSON<{ model: string; apiKeyId: string } | null>('builder:step2', null));
  if (!s2?.model || !s2?.apiKeyId) throw new Error('Missing step 2 selections.');

  // Per-account API keys
  const keys = (await ss.getJSON<ApiKey[]>('apiKeys', [])) || [];
  const found = keys.find((k) => k.id === s2.apiKeyId);
  if (!found?.key) throw new Error('Selected API key not found.');
  const apiKey = found.key;

  // Optional Step 1 context (still local/scoped)
  const s1 = (await ss.getJSON<{ name?: string; industry?: string; language?: string } | null>('builder:step1', null));

  const name =
    opts?.nameOverride ||
    s1?.name ||
    'My AI Assistant';

  const instructions =
    opts?.instructionsOverride ||
    `You are a helpful assistant for ${s1?.industry || 'a business'}. Reply in ${s1?.language || 'English'}.`;

  const res = await fetch('https://api.openai.com/v1/assistants', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, model: s2.model, instructions }),
  });
  if (!res.ok) throw new Error(`OpenAI error (${res.status}): ${await res.text()}`);
  return res.json();
}

export default function Step2ModelSettings({ onBack, onNext }: Props) {
  const [model, setModel] = useState<string>('gpt-4o');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyId, setApiKeyId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Load per-user data (apiKeys + prior step2 choice)
  useEffect(() => {
    (async () => {
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();
      // one-time migration of legacy localStorage -> scoped (if needed)
      await migrateLegacyKeysToUser();

      const saved = await ss.getJSON<{ model?: string; apiKeyId?: string } | null>('builder:step2', null);
      if (saved?.model) setModel(String(saved.model));
      if (saved?.apiKeyId) setApiKeyId(String(saved.apiKeyId));

      const stored = await ss.getJSON<ApiKey[]>('apiKeys', []);
      if (Array.isArray(stored)) setApiKeys(stored);

      setLoading(false);
    })();
  }, []);

  const selectedMeta = useMemo(
    () => MODEL_OPTIONS.find((m) => m.value === model) || MODEL_OPTIONS[0],
    [model]
  );

  const canContinue = useMemo(
    () => !!model && !!apiKeyId && apiKeys.some((k) => k.id === apiKeyId && k.key),
    [model, apiKeyId, apiKeys]
  );

  const handleNext = () => {
    if (!canContinue) return;
    const payload = { model, apiKeyId };
    (async () => {
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();
      await ss.setJSON('builder:step2', payload);
      onNext(payload);
    })();
  };

  return (
    <div className="min-h-screen w-full text-white font-movatif" style={{ background: '#0b0c10' }}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <StepProgress current={2} />

        <div className="flex items-center justify-between mb-7">
          <h1 className="text-2xl md:text-3xl font-semibold">Model Settings</h1>
          <div
            className="text-sm px-3 py-1 rounded-[20px] border"
            style={{ borderColor: 'rgba(106,247,209,0.35)', background: 'rgba(16,19,20,0.7)' }}
          >
            Choose your model & key
          </div>
        </div>

        <div
          className="relative rounded-[28px] p-7 transition-all"
          style={{
            background: 'rgba(13,15,17,0.92)',
            border: '2px solid rgba(106,247,209,0.32)',
            boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
          }}
        >
          <div
            className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.12) 0%, transparent 70%)', filter: 'blur(38px)' }}
          />

          {loading ? (
            // Subtle skeleton so it feels "real" before keys arrive
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
              {[0, 1].map((i) => (
                <div key={i}>
                  <div className="h-4 w-40 bg-white/10 rounded mb-3" />
                  <div className="h-12 rounded-2xl bg-[#101314] border border-[#13312b]" />
                  <div className="mt-2 h-3 w-48 bg-white/10 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
              {/* Model */}
              <div>
                <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">
                  ChatGPT Model
                </label>
                <div className="relative">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-2xl bg-[#101314] text-white/95 border border-[#13312b] px-4 py-3.5 text-[15px] outline-none focus:border-[#00ffc2]"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2 mt-2 text-xs text-white/70">
                    {selectedMeta.icon ? <selectedMeta.icon className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                    <span>{selectedMeta.label}</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-white/60">Your assistant will actually use this model.</div>
              </div>

              {/* API key */}
              <div>
                <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">
                  API Key
                </label>
                <div className="relative">
                  <select
                    value={apiKeyId}
                    onChange={(e) => setApiKeyId(e.target.value)}
                    className="w-full rounded-2xl bg-[#101314] text-white/95 border border-[#13312b] px-4 py-3.5 text-[15px] outline-none focus:border-[#00ffc2]"
                  >
                    <option value="">Select an API key…</option>
                    {apiKeys.map((k) => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                  <KeyRound className="w-4 h-4 absolute right-3 top-3.5 opacity-70" />
                </div>
                <div className="mt-2 text-xs text-white/60">Must be one you created in the API Keys section.</div>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            {/* === EXACT COPY OF STEP 1 NEXT BUTTON === */}
            <button
              disabled={!canContinue || loading}
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition-colors duration-150 disabled:cursor-not-allowed"
              style={{
                background: !loading && canContinue ? BTN_GREEN : BTN_DISABLED,
                color: '#ffffff',
                boxShadow: !loading && canContinue ? '0 1px 0 rgba(0,0,0,0.18)' : 'none',
                filter: !loading && canContinue ? 'none' : 'saturate(85%) opacity(0.9)',
              }}
              onMouseEnter={(e) => {
                if (loading || !canContinue) return;
                (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
              }}
              onMouseLeave={(e) => {
                if (loading || !canContinue) return;
                (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
              }}
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
