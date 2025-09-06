// components/builder/Step2ModelSettings.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cpu, Bolt, Rocket, Gauge, KeyRound, ArrowLeft, ArrowRight } from 'lucide-react';
import StepProgress from './StepProgress';
import { scopedStorage } from '@/utils/scoped-storage';

/**
 * What changed & why:
 * - Keys source: reads BOTH 'apiKeys.v1' (new) and 'apiKeys' (legacy) so Step 2 never crashes/empties.
 * - Robust load: wrapped in try/catch + an error state; shows UI instead of a blank page.
 * - Button style: same green as API Keys page (#10b981 hover #0ea473), white text in light+dark.
 * - Light/Dark: all surfaces/colors come from your CSS vars (var(--bg), --panel, --card, --border, --text, etc).
 * - Skeletons + inline hints to match the vibe of Step 1/API Keys.
 */

type Props = {
  onBack: () => void;
  onNext: (data: { model: string; apiKeyId: string }) => void;
};

type ApiKey = { id: string; name: string; key: string };

const MODEL_OPTIONS = [
  { value: 'gpt-4o',        label: 'GPT-4o',        icon: Bolt },
  { value: 'gpt-4o-mini',   label: 'GPT-4o mini',   icon: Rocket },
  { value: 'gpt-4.1',       label: 'GPT-4.1',       icon: Cpu },
  { value: 'gpt-4.1-mini',  label: 'GPT-4.1 mini',  icon: Gauge },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', icon: Cpu },
];

/* Same green as API Keys page */
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';
const BTN_DISABLED = 'color-mix(in oklab, var(--text) 14%, transparent)';

export default function Step2ModelSettings({ onBack, onNext }: Props) {
  const [model, setModel] = useState<string>('gpt-4o');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyId, setApiKeyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();

        // Read BOTH new and legacy buckets, prefer new
        const v1 = await ss.getJSON<ApiKey[]>('apiKeys.v1', []);
        const legacy = await ss.getJSON<ApiKey[]>('apiKeys', []);
        const merged = Array.isArray(v1) && v1.length ? v1
                     : Array.isArray(legacy) ? legacy
                     : [];

        // Defensive normalize
        const cleaned = merged
          .filter(Boolean)
          .map((k) => ({
            id: String((k as any).id || ''),
            name: String((k as any).name || ''),
            key: String((k as any).key || ''),
          }))
          .filter((k) => k.id && k.name);

        if (!mounted) return;

        setApiKeys(cleaned);

        // Restore previous choice
        const saved = await ss.getJSON<{ model?: string; apiKeyId?: string } | null>('builder:step2', null);
        if (saved?.model) setModel(String(saved.model));
        if (saved?.apiKeyId && cleaned.some((k) => k.id === saved.apiKeyId)) {
          setApiKeyId(saved.apiKeyId);
        } else if (cleaned[0]) {
          setApiKeyId(cleaned[0].id);
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Failed to load settings');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
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
    <div className="min-h-screen w-full font-movatif" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        {/* Progress only (title lives in the global chip/header) */}
        <StepProgress current={2} />

        {/* Frame card */}
        <section
          className="relative rounded-[28px] p-7 md:p-8"
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          {/* soft ambient grid/glow like Step 1 / API Keys */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[26%] -left-[28%] w-[70%] h-[70%] rounded-full"
            style={{
              background: 'radial-gradient(circle, color-mix(in oklab, var(--brand) 18%, transparent) 0%, transparent 70%)',
              filter: 'blur(38px)',
            }}
          />

          <header className="mb-6">
            <div className="inline-flex items-center gap-2 text-xs tracking-wide px-3 py-1.5 rounded-[20px] border"
                 style={{ borderColor: 'var(--border)', background: 'color-mix(in oklab, var(--brand) 10%, var(--card))' }}>
              <KeyRound className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} />
              Choose your model & key
            </div>
            <h2 className="mt-3 text-2xl md:text-3xl font-semibold">Model Settings</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              We’ll use your selected model and the API key you added in the API Keys page.
            </p>
          </header>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
              {[0, 1].map((i) => (
                <div key={i}>
                  <div className="h-4 w-40 rounded mb-3"
                       style={{ background: 'color-mix(in oklab, var(--text) 10%, transparent)' }} />
                  <div className="h-12 rounded-2xl"
                       style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }} />
                  <div className="mt-2 h-3 w-48 rounded"
                       style={{ background: 'color-mix(in oklab, var(--text) 8%, transparent)' }} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {err && (
                <div className="mb-5 rounded-[14px] px-4 py-3 text-sm"
                     style={{ background: 'color-mix(in oklab, red 6%, var(--card))', border: '1px solid color-mix(in oklab, red 20%, var(--border))', color: 'var(--text)' }}>
                  {err}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                {/* Model */}
                <div>
                  <label className="block mb-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                    ChatGPT Model
                  </label>
                  <div className="relative">
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none"
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                      }}
                    >
                      {MODEL_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {selectedMeta?.icon ? <selectedMeta.icon className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                      <span>{selectedMeta?.label}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Your assistant will actually use this model.
                  </div>
                </div>

                {/* API key (per-user scoped) */}
                <div>
                  <label className="block mb-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                    API Key
                  </label>
                  <div className="relative">
                    <select
                      value={apiKeyId}
                      onChange={(e) => setApiKeyId(e.target.value)}
                      className="w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none"
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                      }}
                    >
                      <option value="">Select an API key…</option>
                      {apiKeys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name} ••••{(k.key || '').slice(-4).toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <KeyRound className="w-4 h-4 absolute right-3 top-3.5 opacity-70" style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Keys are per-account via scoped storage. Add/manage them on the API Keys page.
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-[18px] px-4 py-2 text-sm transition"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            <button
              disabled={!canContinue || loading}
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-8 h-[42px] rounded-[18px] font-semibold select-none disabled:cursor-not-allowed"
              style={{
                background: canContinue && !loading ? BTN_GREEN : BTN_DISABLED,
                color: '#ffffff', // ALWAYS white label (light + dark)
                boxShadow: canContinue && !loading ? '0 10px 24px rgba(16,185,129,.25)' : 'none',
                transition: 'transform .15s ease, box-shadow .15s ease, background .15s ease',
              }}
              onMouseEnter={(e) => {
                if (!canContinue || loading) return;
                (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
              }}
              onMouseLeave={(e) => {
                if (!canContinue || loading) return;
                (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
              }}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  Next <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
