// components/builder/Step4Overview.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check, AlertCircle, Loader2, Sparkles, ArrowLeft,
  Cpu, BookText, FileText, KeyRound, Library, Settings2
} from 'lucide-react';
import StepProgress from './StepProgress';
import { s, st } from '@/utils/safe';
import { scopedStorage } from '@/utils/scoped-storage';

/* ─────────────────────────── Shared visuals (same as Step 1) ─────────────────────────── */

const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';
const BTN_DISABLED = 'color-mix(in oklab, var(--text) 14%, transparent)';

const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
  borderRadius: 20,
};

const PANEL: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: 28,
};

function Orb() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
      style={{
        background:
          'radial-gradient(circle, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)',
        filter: 'blur(38px)',
      }}
    />
  );
}

function SubtleGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[.07]"
      style={{
        background:
          'linear-gradient(transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px), linear-gradient(90deg, transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px)',
        backgroundSize: '32px 32px',
        maskImage: 'radial-gradient(circle at 30% 20%, black, transparent 70%)',
      }}
    />
  );
}

/* ───────────────────────────── Data helpers ───────────────────────────── */

type Props = { onBack?: () => void; onFinish?: () => void };

function getLS<T = any>(k: string, fb?: T): T {
  try { const v = localStorage.getItem(k); return (v ? JSON.parse(v) : fb) as T; } catch { return fb as T; }
}

function buildFinalPrompt() {
  const s1 = getLS<any>('builder:step1', {});
  const s3 = getLS<any>('builder:step3', {});

  const header = [st(s1?.name), st(s1?.industry), st(s1?.language)].filter(Boolean).join('\n');

  const languageText = s3?.languageText || s3?.language || '';
  const description = s(s3?.description) || '';
  const rules = s(s3?.rules) || '';
  const flow = s(s3?.flow) || '';
  const company = (s(s3?.company) || '').trim();

  const blocks = [
    header,
    '**LANGUAGE INSTRUCTIONS:**', languageText,
    '**AI DESCRIPTION:**', description,
    '**RULES & GUIDELINES:**', rules,
    '**CONVERSATION FLOW:**', flow,
    '**COMPANY INFORMATION (FAQ / Docs / Policies):**', company,
  ];

  return blocks
    .map((b) => (b ?? '').toString().trim())
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ────────────── NEW: cloud builds key (keeps all your logic intact) ────────────── */
const BUILDS_KEY = 'chatbots.v1';

/* ───────────────────────────── Component ───────────────────────────── */

export default function Step4Overview({ onBack, onFinish }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Generating AI…');
  const [done, setDone] = useState(false);

  const [s1] = useState<any>(getLS('builder:step1', {}));
  const [s3] = useState<any>(getLS('builder:step3', {}));
  const [s2, setS2] = useState<any>(getLS('builder:step2', {}));

  const finalPrompt = useMemo(buildFinalPrompt, []);
  const chars = finalPrompt.length;
  const maxChars = 32000;
  const estTokens = Math.max(1, Math.round(chars / 4));
  const inputCostPerMTok = 2.5;
  const outputCostPerMTok = 10.0;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const v = await ss.getJSON<any>('builder:step2', null);
        if (mounted && v) {
          setS2(v);
          try { localStorage.setItem('builder:step2', JSON.stringify(v)); } catch {}
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const msgs = [
      'Compiling prompt blocks…',
      'Linking company knowledge…',
      'Warming up the model…',
      'Shaping tone & rules…',
      'Final checks & safety…',
    ];
    let i = 0;
    setLoadingMsg(msgs[i]);
    const id = setInterval(() => { i = (i + 1) % msgs.length; setLoadingMsg(msgs[i]); }, 1200);
    return () => clearInterval(id);
  }, [loading]);

  const checks = {
    name: !!st(s1?.name),
    industry: !!st(s1?.industry),
    language: !!st(s1?.language),
    template: !!(s1?.type || s1?.botType || s1?.aiType),
    model: !!s2?.model,
    apiKey: !!s2?.apiKeyId,
    description: !!st(s3?.description),
    flow: !!st(s3?.flow),
    rules: !!st(s3?.rules),
    company: true,
    languageText: !!st(s3?.languageText || s3?.language),
  };
  const ready = Object.values(checks).every(Boolean);

  async function handleGenerate() {
    if (!ready) return;

    setLoading(true);
    setDone(false);

    try {
      let apiKeyPlain = '';
      const selectedModel = s2?.model || 'gpt-4o-mini';

      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const keys = await ss.getJSON<any[]>('apiKeys.v1', []);
        const sel = (keys || []).find(k => k.id === s2?.apiKeyId);
        apiKeyPlain = sel?.key || '';
      } catch {}

      const resp = await fetch('/api/assistants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: st(s1?.name, 'Untitled Assistant'),
          model: selectedModel,
          prompt: finalPrompt,
          apiKeyPlain,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data?.ok || !data?.assistant?.id) {
        throw new Error(data?.error || 'Failed to create assistant');
      }

      // build object (unchanged)
      const bots = getLS<any[]>('chatbots', []);
      const build = {
        id: data.assistant.id,
        assistantId: data.assistant.id,
        name: st(s1?.name, 'Untitled Assistant'),
        type: s1?.type || s1?.botType || s1?.aiType || 'ai automation',
        industry: st(s1?.industry),
        language: st(s1?.language, 'English'),
        model: selectedModel,
        prompt: finalPrompt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      bots.unshift(build);

      // mirror to localStorage (same as before)
      try { localStorage.setItem('chatbots', JSON.stringify(bots)); } catch {}
      try { localStorage.setItem('builder:cleanup', '1'); } catch {}

      /* ────────────── NEW: also persist to scopedStorage for cross-device sync ────────────── */
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const cloud = (await ss.getJSON<any[]>(BUILDS_KEY, [])) || [];
        const nextCloud = [build, ...cloud].slice(0, 200); // optional cap
        await ss.setJSON(BUILDS_KEY, nextCloud);
      } catch (e) {
        console.warn('Cloud save failed (chatbots.v1). Falling back to local only.', e);
      }
      /* ─────────────────────────────────────────────────────────────────────────── */

      setLoading(false);
      setDone(true);
      onFinish?.();
    } catch (e: any) {
      setLoading(false);
      alert(e?.message || 'Failed to generate the AI.');
    }
  }

  return (
    <div className="min-h-screen w-full font-movatif" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <StepProgress current={4} />

        {/* Top summary card */}
        <section className="relative p-6 md:p-7 mb-8" style={PANEL}>
          <Orb /><SubtleGrid />
          <div className="flex items-center gap-2 mb-5 font-semibold">
            <Settings2 className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            Final Review
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Info label="AI Name" value={s1?.name || '—'} icon={<FileText className="w-3.5 h-3.5" />} />
            <Info label="Industry" value={s1?.industry || '—'} icon={<Library className="w-3.5 h-3.5" />} />
            <Info label="Template" value={s1?.type || s1?.botType || s1?.aiType || '—'} icon={<BookText className="w-3.5 h-3.5" />} />
            <Info label="Model" value={s2?.model || '—'} icon={<Cpu className="w-3.5 h-3.5" />} />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            <div style={PANEL} className="relative p-6 rounded-[28px]">
              <Orb />
              <div className="flex items-center gap-2 mb-4 font-semibold">
                <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} /> Content Length
              </div>
              <div style={CARD} className="p-4 rounded-2xl">
                <div className="text-sm mb-2" style={{ color: 'var(--text)' }}>Characters</div>
                <div className="w-full h-2 rounded-full" style={{ background: 'color-mix(in oklab, var(--text) 10%, transparent)' }}>
                  <div className="h-2 rounded-full" style={{ background: 'var(--brand)', width: `${Math.min(100, (chars / maxChars) * 100)}%` }} />
                </div>
                <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{chars.toLocaleString()} / {maxChars.toLocaleString()}</div>
              </div>
            </div>

            <div style={PANEL} className="relative p-6 rounded-[28px]">
              <Orb />
              <div className="flex items-center gap-2 mb-4 font-semibold">
                <KeyRound className="w-4 h-4" style={{ color: 'var(--brand)' }} /> API Configuration
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div style={CARD} className="p-4 rounded-2xl">
                  <div style={{ color: 'var(--text-muted)' }}>Input Cost</div>
                  <div style={{ color: 'var(--text)' }} className="mt-1">
                    ${inputCostPerMTok.toFixed(2)} <span style={{ color: 'var(--text-muted)' }}>/ 1M tokens</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Est. tokens: {estTokens.toLocaleString()}</div>
                </div>
                <div style={CARD} className="p-4 rounded-2xl">
                  <div style={{ color: 'var(--text-muted)' }}>Output Cost</div>
                  <div style={{ color: 'var(--text)' }} className="mt-1">
                    ${outputCostPerMTok.toFixed(2)} <span style={{ color: 'var(--text-muted)' }}>/ 1M tokens</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div style={PANEL} className="relative p-6 rounded-[28px]">
              <Orb />
              <div className="flex items-center gap-2 mb-4 font-semibold">
                <div className="w-4 h-4 rounded-[6px] border flex items-center justify-center" style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}>✓</div>
                Requirements
              </div>

              <div style={CARD} className="p-4 rounded-2xl mb-4">
                <Req ok={!!checks.name} label="AI Name" />
                <Req ok={!!checks.industry} label="Industry" />
                <Req ok={!!checks.language} label="Language" />
                <Req ok={!!checks.languageText} label="Language Instructions" />
                <Req ok={!!checks.template} label="Template" />
                <Req ok={!!checks.model} label="Model" />
                <Req ok={!!checks.apiKey} label="API Key" />
                <Req ok={!!checks.description} label="Description" />
                <Req ok={!!checks.flow} label="Conversation Flow" />
                <Req ok={!!checks.rules} label="Rules" />
                <Req ok={!!checks.company} label="Company Info" />
              </div>

              <div className="rounded-2xl p-4" style={{ ...CARD }}>
                <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--brand)' }}>
                  <Sparkles className="w-4 h-4" />
                  {ready ? 'Ready to Generate' : 'Missing Requirements'}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {ready ? 'Your AI will be created now using your selected API key.' : 'Please complete the missing items above.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex justify-between mt-10">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[18px] px-4 py-2 text-sm transition"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow-soft)' }}
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          <button
            onClick={handleGenerate}
            disabled={!ready || loading}
            className="inline-flex items-center gap-2 px-8 h-[46px] rounded-[18px] font-semibold select-none disabled:cursor-not-allowed"
            style={{ background: ready && !loading ? BTN_GREEN : BTN_DISABLED, color: '#fff' }}
            onMouseEnter={(e) => {
              if (!ready || loading) return;
              (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
            }}
            onMouseLeave={(e) => {
              if (!ready || loading) return;
              (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
            }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate AI
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center px-4">
          <div className="w-full max-w-md rounded-[24px] p-6 text-center" style={{ background: 'var(--panel)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}>
            <Loader2 className="w-7 h-7 mx-auto animate-spin mb-3" style={{ color: 'var(--brand)' }} />
            <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Generating AI…</div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{loadingMsg}</div>
          </div>
        </div>
      )}

      {/* Done toast */}
      {done && (
        <div className="fixed bottom-6 right-6 z-50 rounded-[16px] px-4 py-3"
             style={{ background:'var(--panel)', border:'1px solid var(--border)', boxShadow:'var(--shadow-soft)', color:'var(--text)' }}>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            <div className="text-sm">AI generated and saved to your Builds.</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── UI bits ─────────────────────────── */

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div style={CARD} className="p-3 rounded-2xl">
      <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>{icon}{label}</div>
      <div className="mt-0.5 truncate" style={{ color: 'var(--text)' }}>{value || '—'}</div>
    </div>
  );
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-[6px]"
            style={{
              background: ok ? 'color-mix(in oklab, var(--brand) 15%, transparent)' : 'rgba(255,120,120,0.12)',
              border: `1px solid ${ok ? 'color-mix(in oklab, var(--brand) 40%, transparent)' : 'rgba(255,120,120,0.4)'}`
            }}>
        {ok ? <Check className="w-3 h-3" style={{ color: 'var(--brand)' }} /> : <AlertCircle className="w-3 h-3" style={{ color: 'salmon' }} />}
      </span>
      <span style={{ color: ok ? 'var(--text)' : 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}
