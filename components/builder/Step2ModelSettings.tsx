// components/builder/Step2ModelSettings.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Cpu, Bolt, Rocket, Gauge, KeyRound, ArrowLeft, ArrowRight, Link as LinkIcon } from 'lucide-react';
import StepProgress from './StepProgress';
import { scopedStorage } from '@/utils/scoped-storage';

/**
 * Step 2 — Model & API Key
 * - Light + Dark mode via CSS vars (same palette used in Step 1 + API Keys page)
 * - “Next” button = EXACT green style from API Keys page (#10b981 / #0ea473)
 * - Pulls API keys from the same scoped storage keys used by the API Keys page:
 *     LS_KEYS      = 'apiKeys.v1'
 *     LS_SELECTED  = 'apiKeys.selectedId'
 * - Adds gentle loading skeletons and polished cards
 */

type Props = {
  onBack: () => void;
  onNext: (data: { model: string; apiKeyId: string }) => void;
};

type StoredKey = { id: string; name: string; key: string; createdAt?: number };

// Models (icons only for description pill)
const MODEL_OPTIONS = [
  { value: 'gpt-4o',        label: 'GPT-4o',        icon: Bolt },
  { value: 'gpt-4o-mini',   label: 'GPT-4o mini',   icon: Rocket },
  { value: 'gpt-4.1',       label: 'GPT-4.1',       icon: Cpu },
  { value: 'gpt-4.1-mini',  label: 'GPT-4.1 mini',  icon: Gauge },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', icon: Cpu },
];

// EXACT same green used on API Keys page
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

// Shared card styling (matches Step 1 + API Keys)
const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
  borderRadius: 20,
};

const LS_KEYS = 'apiKeys.v1';
const LS_SELECTED = 'apiKeys.selectedId';

export default function Step2ModelSettings({ onBack, onNext }: Props) {
  const [model, setModel] = useState<string>('gpt-4o');
  const [apiKeys, setApiKeys] = useState<StoredKey[]>([]);
  const [apiKeyId, setApiKeyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load keys from the SAME place as the API Keys page
  useEffect(() => {
    (async () => {
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();

      const keys = await ss.getJSON<StoredKey[]>(LS_KEYS, []);
      setApiKeys(Array.isArray(keys) ? keys : []);

      // restore previous choice if any
      const saved = await ss.getJSON<{ model?: string; apiKeyId?: string } | null>('builder:step2', null);
      const rememberedId = await ss.getJSON<string>(LS_SELECTED, '');

      if (saved?.model) setModel(String(saved.model));

      // prefer: saved.apiKeyId → LS_SELECTED → first key
      const pick =
        (saved?.apiKeyId && (keys || []).some(k => k.id === saved.apiKeyId) ? saved.apiKeyId : '') ||
        (rememberedId && (keys || []).some(k => k.id === rememberedId) ? rememberedId : '') ||
        (keys && keys[0]?.id) || '';

      setApiKeyId(pick);
      setLoading(false);
    })();
  }, []);

  const selectedMeta = useMemo(
    () => MODEL_OPTIONS.find((m) => m.value === model) || MODEL_OPTIONS[0],
    [model]
  );

  const canContinue = useMemo(
    () => !!model && !!apiKeyId && apiKeys.some((k) => k.id === apiKeyId && !!k.key),
    [model, apiKeyId, apiKeys]
  );

  const persistAndNext = useCallback(async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    const ss = await scopedStorage();
    await ss.ensureOwnerGuard();
    await ss.setJSON('builder:step2', { model, apiKeyId });
    // gentle pause for UX parity with Step 1
    await new Promise((r) => setTimeout(r, 280));
    onNext({ model, apiKeyId });
    setSaving(false);
  }, [canContinue, saving, model, apiKeyId, onNext]);

  return (
    <main className="min-h-screen w-full font-movatif" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        {/* Step label lives INSIDE this progress (no extra title above, per your request) */}
        <StepProgress current={2} />

        {/* Panel */}
        <section className="relative p-6 sm:p-7" style={CARD}>
          {/* subtle emerald glow, same vibe as Step 1 */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
            style={{
              background: 'radial-gradient(circle, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)',
              filter: 'blur(38px)',
            }}
          />

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
              {[0, 1].map((i) => (
                <div key={i}>
                  <div className="h-4 w-32 rounded mb-3" style={{ background: 'color-mix(in oklab, var(--text) 8%, transparent)' }} />
                  <div className="h-[46px] rounded-2xl" style={{ background: 'color-mix(in oklab, var(--text) 6%, transparent)' }} />
                  <div className="mt-2 h-3 w-40 rounded" style={{ background: 'color-mix(in oklab, var(--text) 6%, transparent)' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
              {/* Model select */}
              <div>
                <label className="block mb-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                  ChatGPT Model
                </label>
                <div className="relative">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-2xl px-4 h-[46px] text-[15px] outline-none"
                    style={{
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      boxShadow: 'var(--shadow-soft)',
                    }}
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {selectedMeta.icon ? <selectedMeta.icon className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                    <span>{selectedMeta.label}</span>
                  </div>
                </div>
                <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Your assistant will actually use this model.
                </div>
              </div>

              {/* API Key select (reads same storage as API Keys page) */}
              <div>
                <label className="block mb-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                  API Key
                </label>
                <div className="relative">
                  <select
                    value={apiKeyId}
                    onChange={(e) => setApiKeyId(e.target.value)}
                    className="w-full rounded-2xl pl-10 pr-4 h-[46px] text-[15px] outline-none appearance-none"
                    style={{
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      boxShadow: 'var(--shadow-soft)',
                    }}
                  >
                    <option value="">Select an API key…</option>
                    {apiKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} ••••{(k.key || '').slice(-4).toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-80" style={{ color: 'var(--brand)' }} />
                </div>
                <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Keys are saved per account. Manage them in <a href="/api-keys" className="underline">API Keys</a>.
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-[14px] px-4 h-[42px] transition hover:-translate-y-[1px]"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-3">
              <a
                href="/api-keys"
                className="hidden sm:inline-flex items-center gap-2 rounded-[14px] px-4 h-[42px] transition hover:-translate-y-[1px]"
                style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow-soft)' }}
              >
                <LinkIcon className="w-4 h-4" />
                Open API Keys
              </a>

              <button
                disabled={!canContinue || loading || saving}
                onClick={persistAndNext}
                className="inline-flex items-center justify-center gap-2 px-6 h-[46px] rounded-[18px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition will-change-transform"
                style={{ background: BTN_GREEN, color: '#fff' }}
                onMouseEnter={(e) => {
                  if (!canContinue || loading || saving) return;
                  (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
                }}
                onMouseLeave={(e) => {
                  if (!canContinue || loading || saving) return;
                  (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
                }}
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
                    Next
                  </>
                ) : (
                  <>
                    Next <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
