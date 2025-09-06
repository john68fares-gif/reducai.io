'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cpu, Bolt, Rocket, Gauge, KeyRound, ArrowLeft } from 'lucide-react';
import StepProgress from './StepProgress';

type Props = { onBack: () => void; onNext: (data: { model: string; apiKeyId: string }) => void };
type ApiKey = { id: string; name: string; key: string };

const MODEL_OPTIONS = [
  { value: 'gpt-4o',        label: 'GPT-4o',        icon: Bolt },
  { value: 'gpt-4o-mini',   label: 'GPT-4o mini',   icon: Rocket },
  { value: 'gpt-4.1',       label: 'GPT-4.1',       icon: Cpu },
  { value: 'gpt-4.1-mini',  label: 'GPT-4.1 mini',  icon: Gauge },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', icon: Cpu },
];

export default function Step2ModelSettings({ onBack, onNext }: Props) {
  const [model, setModel] = useState<string>('gpt-4o');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyId, setApiKeyId] = useState('');

  // load once
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('builder:step2') || 'null') as { model?: string; apiKeyId?: string } | null;
      const inList = (v?: string) => MODEL_OPTIONS.some(o => o.value === v);
      if (saved?.model && inList(saved.model)) setModel(saved.model);
      if (saved?.apiKeyId) setApiKeyId(String(saved.apiKeyId));
      if (saved?.model && !inList(saved.model)) localStorage.removeItem('builder:step2'); // purge bad/stale
    } catch {}
    try {
      const keys = JSON.parse(localStorage.getItem('apiKeys') || '[]');
      if (Array.isArray(keys)) setApiKeys(keys);
    } catch {}
  }, []);

  const selectedMeta = useMemo(
    () => MODEL_OPTIONS.find(m => m.value === model) || MODEL_OPTIONS[0],
    [model]
  );

  const canContinue = !!apiKeyId && apiKeys.some(k => k.id === apiKeyId && k.key);

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
          <div className="text-sm px-3 py-1 rounded-[10px] border" style={{ borderColor: 'rgba(106,247,209,0.35)', background: 'rgba(16,19,20,0.7)' }}>
            Choose your model & key
          </div>
        </div>

        <div className="relative rounded-[16px] p-7" style={{ background: 'rgba(13,15,17,0.92)', border: '1px solid rgba(106,247,209,0.22)', boxShadow: 'inset 0 0 12px rgba(0,0,0,0.28)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            {/* Model */}
            <div>
              <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">ChatGPT Model</label>
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-[10px] bg-[#101314] text-white/95 border border-[#13312b] px-4 py-3.5 text-[15px] outline-none focus:border-[#00ffc2]"
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
            </div>

            {/* API Key */}
            <div>
              <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">API Key</label>
              <div className="relative">
                <select
                  value={apiKeyId}
                  onChange={(e) => setApiKeyId(e.target.value)}
                  className="w-full rounded-[10px] bg-[#101314] text-white/95 border border-[#13312b] px-4 py-3.5 text-[15px] outline-none focus:border-[#00ffc2]"
                >
                  <option value="">Select an API key…</option>
                  {apiKeys.map((k) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
                <KeyRound className="w-4 h-4 absolute right-3 top-3.5 opacity-70" />
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            <button
              onClick={handleNext}
              disabled={!canContinue}
              className={[
                'inline-flex items-center gap-2 rounded-[12px] px-5 py-2.5 font-semibold transition',
                canContinue ? 'bg-[#00ffc2] text-white hover:brightness-95 active:scale-[0.99]' : 'bg-white/10 text-white/50 cursor-not-allowed',
              ].join(' ')}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
