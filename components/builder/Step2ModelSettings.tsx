// components/builder/Step2ModelSettings.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cpu, Bolt, Rocket, Gauge, KeyRound, ArrowLeft, ArrowRight } from 'lucide-react';
import StepProgress from './StepProgress';

type Props = {
  onBack: () => void;
  onNext: (data: { model: string; apiKeyId: string }) => void;
};

type ApiKey = { id: string; name: string; key: string };

/* ---------- Models ---------- */
const MODEL_OPTIONS = [
  { value: 'gpt-4o',        label: 'GPT-4o',        icon: Bolt },
  { value: 'gpt-4o-mini',   label: 'GPT-4o mini',   icon: Rocket },
  { value: 'gpt-4.1',       label: 'GPT-4.1',       icon: Cpu },
  { value: 'gpt-4.1-mini',  label: 'GPT-4.1 mini',  icon: Gauge },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', icon: Cpu },
];

/* ---------- Buttons (keep Step1 look) ---------- */
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

/* ---------- LocalStorage compatibility helpers ---------- */
const LS_LIST_NEW = 'apiKeys.v1';
const LS_LIST_OLD = 'apiKeys';
const LS_ACTIVE   = 'apiKeys.activeId';

function loadApiKeysCompat(): { list: ApiKey[]; activeId: string | null } {
  let list: ApiKey[] = [];
  try {
    const rawNew = localStorage.getItem(LS_LIST_NEW);
    const rawOld = localStorage.getItem(LS_LIST_OLD);
    if (rawNew) list = JSON.parse(rawNew);
    else if (rawOld) list = JSON.parse(rawOld);
  } catch {}
  if (!Array.isArray(list)) list = [];
  const activeId = localStorage.getItem(LS_ACTIVE);
  return { list, activeId };
}

/* ---------- Public helper used elsewhere in the app ---------- */
export async function createOpenAIAssistantFromLocalSelections(opts?: {
  nameOverride?: string;
  instructionsOverride?: string;
}) {
  // Step 2 selection (model + chosen key id)
  const s2 = JSON.parse(localStorage.getItem('builder:step2') || 'null') as
    | { model: string; apiKeyId?: string }
    | null;

  const { list: keys, activeId } = loadApiKeysCompat();
  const resolvedKeyId =
    s2?.apiKeyId ||
    activeId ||
    (keys[0]?.id ?? '');

  if (!s2?.model || !resolvedKeyId) throw new Error('Missing model or API key.');
  const found = keys.find(k => k.id === resolvedKeyId);
  if (!found?.key) throw new Error('Selected API key not found.');
  const apiKey = found.key;

  // Step 1 info (for name + language/industry context)
  const s1 = JSON.parse(localStorage.getItem('builder:step1') || 'null') as
    | { name?: string; industry?: string; language?: string }
    | null;

  const name = opts?.nameOverride || s1?.name || 'My AI Assistant';
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

/* ---------- Component ---------- */
export default function Step2ModelSettings({ onBack, onNext }: Props) {
  const [model, setModel] = useState<string>('gpt-4o');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyId, setApiKeyId] = useState<string>('');

  useEffect(() => {
    // Load saved step values first
    let savedModel: string | undefined;
    let savedApiKeyId: string | undefined;
    try {
      const saved = JSON.parse(localStorage.getItem('builder:step2') || 'null');
      if (saved?.model) savedModel = String(saved.model);
      if (saved?.apiKeyId) savedApiKeyId = String(saved.apiKeyId);
    } catch {}

    // Load keys from new or old storage + activeId
    const { list, activeId } = loadApiKeysCompat();
    setApiKeys(list);

    // Resolve initial apiKeyId preference:
    // 1) previously chosen in step2, 2) active key from /apikeys, 3) first available
    const initialKeyId =
      savedApiKeyId && list.some(k => k.id === savedApiKeyId)
        ? savedApiKeyId
        : (activeId && list.some(k => k.id === activeId) ? activeId : (list[0]?.id || ''));

    if (initialKeyId) setApiKeyId(initialKeyId);
    if (savedModel) setModel(savedModel);
  }, []);

  const selectedMeta = useMemo(
    () => MODEL_OPTIONS.find((m) => m.value === model) || MODEL_OPTIONS[0],
    [model]
  );

  const canContinue = useMemo(
    () => !!model && !!apiKeyId && apiKeys.some((k) => k.id === apiKeyId && !!k.key),
    [model, apiKeyId, apiKeys]
  );

  const handleNext = () => {
    if (!canContinue) return;
    const payload = { model, apiKeyId };
    try { localStorage.setItem('builder:step2', JSON.stringify(payload)); } catch {}
    onNext(payload);
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

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            <button
              disabled={!canContinue}
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition-colors duration-150 disabled:cursor-not-allowed"
              style={{
                background: canContinue ? BTN_GREEN : BTN_DISABLED,
                color: '#ffffff',
                boxShadow: canContinue ? '0 1px 0 rgba(0,0,0,0.18)' : 'none',
                filter: canContinue ? 'none' : 'saturate(85%) opacity(0.9)',
              }}
              onMouseEnter={(e) => {
                if (!canContinue) return;
                (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
              }}
              onMouseLeave={(e) => {
                if (!canContinue) return;
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
