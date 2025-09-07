// components/builder/Step2ModelSettings.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { Cpu, Bolt, Rocket, Gauge, KeyRound, ArrowLeft, ArrowRight, ChevronDown, Search } from 'lucide-react';
import StepProgress from './StepProgress';
import { scopedStorage } from '@/utils/scoped-storage';

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

const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';
const BTN_DISABLED = 'color-mix(in oklab, var(--text) 14%, transparent)';

// shared keys used across the app
const LS_KEYS = 'apiKeys.v1';
const LS_SELECTED = 'apiKeys.selectedId';

/* -----------------------------------------------------------------------------
   Generic styled dropdown — same look/feel as Step 1 custom selects
----------------------------------------------------------------------------- */
type Item<T extends string> = { value: T; label: string; icon?: React.ComponentType<any> };
function StyledSelect<T extends string>({
  value,
  items,
  onChange,
  placeholder,
  leftIcon,
  filterable = true,
}: {
  value: T | '';
  items: Item<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
  leftIcon?: React.ReactNode;
  filterable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  const selected = items.find(i => i.value === value) || null;
  const filtered = items.filter(i => i.label.toLowerCase().includes(query.trim().toLowerCase()));

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const viewH = window.innerHeight;
    const openUp = r.bottom + 360 > viewH;
    setRect({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-[14px] text-[15px] transition will-change-transform"
        style={{
          background: 'var(--ms-input-bg)',
          border: '1px solid var(--ms-input-border)',
          boxShadow: 'var(--ms-input-shadow)',
          color: 'var(--text)',
        }}
      >
        {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            {selected.icon ? <selected.icon className="w-4 h-4" style={{ color: 'var(--brand)' }} /> : null}
            <span className="truncate">{selected.label}</span>
          </span>
        ) : (
          <span className="opacity-70">{placeholder || 'Select…'}</span>
        )}
        <span className="ml-auto" />
        <ChevronDown className="w-4 h-4 opacity-80" style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && rect && typeof document !== 'undefined'
        ? ( // portal menu
          <div
            ref={portalRef}
            className="fixed z-[9999] p-3 animate-[popIn_140ms_ease-out]"
            style={{
              top: rect.openUp ? rect.top - 8 : rect.top + 8,
              left: rect.left,
              width: rect.width,
              transform: rect.openUp ? 'translateY(-100%)' : 'none',
              background: 'var(--ms-menu-bg, #ffffff)',
              border: '1px solid var(--ms-menu-border, rgba(0,0,0,.10))',
              borderRadius: 20,
              boxShadow: '0 28px 70px rgba(0,0,0,.12), 0 10px 26px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.02)',
            }}
          >
            <style jsx global>{`
              [data-theme="dark"] .model-step-scope ~ .fixed {
                --ms-menu-bg: #101314;
                --ms-menu-border: rgba(255,255,255,.16);
              }
            `}</style>

            {filterable && (
              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[12px]"
                style={{
                  background: 'var(--ms-input-bg)',
                  border: '1px solid var(--ms-input-border)',
                  boxShadow: 'var(--ms-input-shadow)',
                  color: 'var(--text)',
                }}
              >
                <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type to filter…"
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text)' }}
                />
              </div>
            )}

            <div className="max-h-80 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {filtered.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left transition"
                  style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--text)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,194,0.10)';
                    (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(0,255,194,0.35)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.border = '1px solid transparent';
                  }}
                >
                  {opt.icon ? <opt.icon className="w-4 h-4" style={{ color: 'var(--brand)' }} /> : null}
                  <span className="flex-1 truncate">{opt.label}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                  No matches.
                </div>
              )}
            </div>
          </div>
        ) : null}
    </>
  );
}

/* -----------------------------------------------------------------------------
   Page component
----------------------------------------------------------------------------- */
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

        // Prefer new bucket; fallback to legacy
        const v1 = await ss.getJSON<ApiKey[]>(LS_KEYS, []);
        const legacy = await ss.getJSON<ApiKey[]>('apiKeys', []);
        const merged = Array.isArray(v1) && v1.length ? v1 : Array.isArray(legacy) ? legacy : [];

        const cleaned = merged
          .filter(Boolean)
          .map((k: any) => ({
            id: String(k?.id || ''),
            name: String(k?.name || ''),
            key: String(k?.key || ''),
          }))
          .filter((k) => k.id && k.name);

        if (!mounted) return;
        setApiKeys(cleaned);

        // Restore previous Step2 selection (scoped)
        const saved = await ss.getJSON<{ model?: string; apiKeyId?: string } | null>('builder:step2', null);
        if (saved?.model) setModel(String(saved.model));

        // Default order: saved apiKeyId -> globally selected -> first key
        const globalSelected = await ss.getJSON<string>(LS_SELECTED, '');
        const chosen =
          (saved?.apiKeyId && cleaned.some((k) => k.id === saved.apiKeyId)) ? saved.apiKeyId :
          (globalSelected && cleaned.some((k) => k.id === globalSelected)) ? globalSelected :
          (cleaned[0]?.id || '');

        setApiKeyId(chosen);

        if (chosen) await ss.setJSON(LS_SELECTED, chosen);

        if (saved) {
          try { localStorage.setItem('builder:step2', JSON.stringify({ model: saved.model || model, apiKeyId: chosen })); } catch {}
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
      await ss.setJSON(LS_SELECTED, apiKeyId);

      try { localStorage.setItem('builder:step2', JSON.stringify(payload)); } catch {}

      onNext(payload);
    })();
  };

  // API Keys -> items for StyledSelect (label includes masked tail)
  const apiKeyItems = useMemo(() => {
    return apiKeys.map(k => ({
      value: k.id,
      label: `${k.name} ••••${(k.key || '').slice(-4).toUpperCase()}`,
    })) as Item<string>[];
  }, [apiKeys]);

  return (
    <div className="min-h-screen w-full font-movatif model-step-scope" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <StepProgress current={2} />

        <section
          className="relative rounded-[28px] p-7 md:p-8"
          style={{ background: 'var(--panel)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[26%] -left-[28%] w-[70%] h-[70%] rounded-full"
            style={{
              background: 'radial-gradient(circle, color-mix(in oklab, var(--brand) 18%, transparent) 0%, transparent 70%)',
              filter: 'blur(38px)',
            }}
          />

          <header className="mb-6">
            <div
              className="inline-flex items-center gap-2 text-xs tracking-wide px-3 py-1.5 rounded-[20px] border"
              style={{ borderColor: 'var(--border)', background: 'color-mix(in oklab, var(--brand) 10%, var(--card))' }}
            >
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
                  <div className="h-4 w-40 rounded mb-3" style={{ background: 'color-mix(in oklab, var(--text) 10%, transparent)' }} />
                  <div className="h-12 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }} />
                  <div className="mt-2 h-3 w-48 rounded" style={{ background: 'color-mix(in oklab, var(--text) 8%, transparent)' }} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {err && (
                <div
                  className="mb-5 rounded-[14px] px-4 py-3 text-sm"
                  style={{ background: 'color-mix(in oklab, red 6%, var(--card))', border: '1px solid color-mix(in oklab, red 20%, var(--border))', color: 'var(--text)' }}
                >
                  {err}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                {/* Model */}
                <div>
                  <label className="block mb-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                    ChatGPT Model
                  </label>
                  <StyledSelect
                    value={model as any}
                    items={MODEL_OPTIONS as any}
                    onChange={(v) => setModel(v)}
                    leftIcon={<Cpu className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                  />
                  <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {selectedMeta?.icon ? <selectedMeta.icon className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                    <span>{selectedMeta?.label}</span>
                  </div>
                  <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Your assistant will actually use this model.
                  </div>
                </div>

                {/* API key */}
                <div>
                  <label className="block mb-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                    API Key
                  </label>
                  <StyledSelect
                    value={(apiKeyId || '') as any}
                    items={apiKeyItems as any}
                    onChange={async (val) => {
                      setApiKeyId(val);
                      try {
                        const ss = await scopedStorage();
                        await ss.ensureOwnerGuard();
                        await ss.setJSON(LS_SELECTED, val);
                      } catch {}
                    }}
                    leftIcon={<KeyRound className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                  />
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
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow-soft)' }}
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
                color: '#ffffff',
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

      {/* Scoped theme vars (light/dark) for this step */}
      <style jsx global>{`
        @keyframes popIn { 0% { opacity: 0; transform: scale(.985); } 100% { opacity: 1; transform: scale(1); } }
        .model-step-scope{
          --ms-input-bg: #ffffff;
          --ms-input-border: rgba(0,0,0,.12);
          --ms-input-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 10px 22px rgba(0,0,0,.06);
        }
        [data-theme="dark"] .model-step-scope{
          --ms-input-bg: rgba(255,255,255,.02);
          --ms-input-border: rgba(255,255,255,.14);
          --ms-input-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.38);
        }
      `}</style>
    </div>
  );
}
