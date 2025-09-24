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
import { supabase } from '@/lib/supabase-client';

/* ───────────────── Visual tokens (match VoiceAgentSection) ───────────────── */

const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';
const BTN_DISABLED = 'color-mix(in oklab, var(--text) 14%, transparent)';
const RADIUS = 10;

const CARD: React.CSSProperties = {
  background: 'var(--panel)',
  border: `1px solid ${GREEN_LINE}`,
  boxShadow:
    '0 20px 40px rgba(0,0,0,.28),' +
    '0 0 0 1px rgba(255,255,255,.06) inset,' +
    '0 0 0 1px rgba(89,217,179,.20)',
  borderRadius: RADIUS,
};

const PANEL: React.CSSProperties = {
  background: 'var(--panel)',
  border: `1px solid ${GREEN_LINE}`,
  boxShadow:
    '0 20px 40px rgba(0,0,0,.28),' +
    '0 0 0 1px rgba(255,255,255,.06) inset,' +
    '0 0 0 1px rgba(89,217,179,.20)',
  borderRadius: RADIUS,
};

function PanelHead({ icon, title }:{ icon:React.ReactNode; title:string }) {
  return (
    <div
      className="flex items-center justify-between px-4 md:px-5 py-3"
      style={{
        background:
          `linear-gradient(90deg,var(--panel) 0%,
           color-mix(in oklab,var(--panel) 97%, white 3%) 50%,
           var(--panel) 100%)`,
        borderBottom:`1px solid ${GREEN_LINE}`,
        borderTopLeftRadius: RADIUS,
        borderTopRightRadius: RADIUS,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full grid place-items-center"
             style={{ background:'rgba(89,217,179,.12)', border:`1px solid ${GREEN_LINE}` }}>
          <span style={{ color: CTA }}>{icon}</span>
        </div>
        <div className="text-[15px] font-semibold" style={{ color:'var(--text)' }}>{title}</div>
      </div>
      <span className="w-5 h-5" />
    </div>
  );
}

function Orb() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
      style={{
        background:'radial-gradient(circle, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)',
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

/* ───────────────────────── Data helpers ───────────────────────── */

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
  the_rules:
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

/* ───────────── Robust JSON + negotiation helpers ───────────── */

async function safeJson<T = any>(resp: Response): Promise<{ ok: boolean; json?: T; text?: string; status: number; allow?: string }> {
  const ct = resp.headers.get('content-type') || '';
  const allow = resp.headers.get('allow') || resp.headers.get('Allow') || '';
  const body = await resp.text();
  if (ct.includes('application/json')) {
    try { return { ok: resp.ok, json: body ? JSON.parse(body) : {}, status: resp.status, allow }; }
    catch { return { ok: resp.ok, text: body, status: resp.status, allow }; }
  }
  return { ok: resp.ok, text: body, status: resp.status, allow };
}

function explainHttp(label: string, pack: { ok: boolean; json?: any; text?: string; status?: number; allow?: string }) {
  const code = pack.status ? ` (HTTP ${pack.status})` : '';
  const allow = pack.allow ? ` • Allow: ${pack.allow}` : '';
  if (pack.ok) return '';
  const serverMsg =
    (pack.json && (pack.json.error || pack.json.message)) ||
    (pack.text && pack.text.slice(0, 600)) ||
    'No response body';
  return `${label}${code}: ${serverMsg}${allow}`;
}

async function negotiateAndWriteJSON(
  endpoints: string[],
  payload: any,
  preferred: Array<'POST'|'PUT'|'PATCH'> = ['POST','PUT','PATCH']
): Promise<{ ok: boolean; json?: any; text?: string; status: number; allow?: string; tried?: string[] }> {
  const tried: string[] = [];
  const withSlashVariants = (u: string) => [u, u.endsWith('/') ? u : `${u}/`];

  for (const ep of endpoints) {
    for (const url of withSlashVariants(ep)) {
      let allow: string = '';
      try {
        const opt = await fetch(url, { method: 'OPTIONS' });
        allow = opt.headers.get('allow') || opt.headers.get('Allow') || '';
      } catch {}
      const allowList = allow.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      const methods = allowList.length ? preferred.filter(p => allowList.includes(p)) : preferred;

      for (const m of methods) {
        tried.push(`${m} ${url}`);
        const r = await fetch(url, {
          method: m,
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        });
        const pack = await safeJson(r);
        if (pack.ok) return { ...pack, tried };
        if (pack.status !== 405 && pack.status !== 404) return { ...pack, tried };
      }
    }
  }

  const finalResp = await fetch(endpoints[0], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload),
  });
  const finalPack = await safeJson(finalResp);
  return { ...finalPack, tried };
}

/* ───────────────────────── Component ───────────────────────── */

export default function Step4Overview({ onBack, onFinish }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('Preparing…');
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

  // Loading steps (for overlay)
  const steps = [
    'Compiling prompt blocks…',
    'Linking company knowledge…',
    'Warming up the model…',
    'Shaping tone & rules…',
    'Final checks & safety…',
  ];
  const progressPct = Math.round(((loadingIdx + 1) / steps.length) * 100);

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
    let i = 0;
    setLoadingIdx(0);
    setLoadingMsg(steps[0]);
    const id = setInterval(() => {
      i = (i + 1) % steps.length;
      setLoadingIdx(i);
      setLoadingMsg(steps[i]);
    }, 1100);
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

  async function saveBuildEverywhere(build: any) {
    // 1) Supabase (account-level) — guarantees cross-device
    try {
      const { data: user } = await supabase.auth.getUser();
      const userId = user?.user?.id;
      if (userId) {
        await supabase
          .from('chatbots')
          .upsert({
            user_id: userId,
            assistant_id: build.assistantId,
            name: build.name,
            model: build.model,
            industry: build.industry || null,
            language: build.language || 'English',
            prompt: build.prompt,
            appearance: build.appearance ?? null,
            created_at: build.createdAt,
            updated_at: build.updatedAt,
          }, { onConflict: 'user_id,assistant_id' });
      }
    } catch { /* ignore – UI still mirrors */ }

    // 2) Cloud (scopedStorage) — per-user workspace
    try {
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();
      const cloud = await ss.getJSON<any[]>('chatbots.v1', []);
      const list = Array.isArray(cloud) ? cloud : [];
      const key = build.assistantId || build.id;
      const idx = list.findIndex((b) => (b.assistantId || b.id) === key);
      if (idx >= 0) list[idx] = build;
      else list.unshift(build);
      await ss.setJSON('chatbots.v1', list);
    } catch {}

    // 3) Local mirror
    try {
      const local = getLS<any[]>('chatbots', []);
      const list = Array.isArray(local) ? local : [];
      const key = build.assistantId || build.id;
      const idx = list.findIndex((b) => (b.assistantId || b.id) === key);
      if (idx >= 0) list[idx] = build;
      else list.unshift(build);
      localStorage.setItem('chatbots', JSON.stringify(list));
    } catch {}

    try { window.dispatchEvent(new Event('builds:updated')); } catch {}
  }

  async function handleGenerate() {
    if (!ready || loading) return;

    setLoading(true);
    setDone(false);

    try {
      // 1) get API key selected in Step 2
      let apiKeyPlain = '';
      const selectedModel = s2?.model || 'gpt-4o-mini';
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const keys = await ss.getJSON<any[]>('apiKeys.v1', []);
        const sel = (keys || []).find(k => k.id === s2?.apiKeyId);
        apiKeyPlain = sel?.key || '';
      } catch {}
      if (!apiKeyPlain) throw new Error('No API key value found for the selected key. Re-select your API key in Step 2.');
      if (!finalPrompt?.trim()) throw new Error('Final prompt is empty. Please fill the description/rules/flow in previous steps.');

      // 2) create assistant on OpenAI
      setLoadingIdx(0); setLoadingMsg('Creating assistant on OpenAI…');
      const createResp = await fetch('/api/assistants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept':'application/json' },
        body: JSON.stringify({
          name: st(s1?.name, 'Untitled Assistant'),
          model: selectedModel,
          prompt: finalPrompt,
          apiKeyPlain,
        }),
      });
      const createPack = await safeJson(createResp);
      if (!createPack.ok) throw new Error(explainHttp('Assistant create failed', createPack));

      const assistantId: string | undefined = createPack.json?.assistant?.id;
      if (!assistantId) throw new Error('Assistant created but no ID returned from server.');

      // 3) get current user
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) throw new Error('No Supabase user session');

      // 4) save to your backend (negotiated)
      setLoadingIdx(1); setLoadingMsg('Saving build to your account…');
      const savePayload = {
        userId,
        assistantId,
        name: st(s1?.name, 'Untitled Assistant'),
        model: selectedModel,
        industry: st(s1?.industry, null),
        language: st(s1?.language, 'English'),
        prompt: finalPrompt,
        appearance: null,
      };

      const saveTargets = ['/api/chatbots/save','/api/chatbots','/api/builds/save','/api/builds'];
      const routed = await negotiateAndWriteJSON(saveTargets, savePayload, ['POST','PUT','PATCH']);
      if (!routed.ok && routed.status !== 405 && routed.status !== 404) {
        console.warn('Save route failed:', explainHttp('Save build failed', routed));
      }

      // 5) mirror + guaranteed Supabase/scopedStorage/local
      setLoadingIdx(2); setLoadingMsg('Mirroring to workspace…');
      const nowISO = new Date().toISOString();
      const build = {
        id: assistantId,
        assistantId,
        name: st(s1?.name, 'Untitled Assistant'),
        type: s1?.type || s1?.botType || s1?.aiType || 'ai automation',
        industry: st(s1?.industry),
        language: st(s1?.language, 'English'),
        model: selectedModel,
        prompt: finalPrompt,
        createdAt: nowISO,
        updatedAt: nowISO,
      };
      await saveBuildEverywhere(build);

      try { localStorage.setItem('builder:cleanup', '1'); } catch {}

      setLoading(false);
      setDone(true);
      onFinish?.();
    } catch (e: any) {
      setLoading(false);
      const msg = e?.message || 'Failed to generate the AI.';
      try { localStorage.setItem('builder:lastError', msg); } catch {}
      alert(msg);
    }
  }

  return (
    <div className="min-h-screen w-full font-movatif" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <StepProgress current={4} />

        {/* Final Review panel */}
        <section className="relative mb-8" style={PANEL}>
          <PanelHead icon={<Settings2 className="w-4 h-4" />} title="Final Review" />
          <div className="relative p-6 md:p-7">
            <Orb /><SubtleGrid />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Info label="AI Name" value={s1?.name || '—'} icon={<FileText className="w-3.5 h-3.5" />} />
              <Info label="Industry" value={s1?.industry || '—'} icon={<Library className="w-3.5 h-3.5" />} />
              <Info label="Template" value={s1?.type || s1?.botType || s1?.aiType || '—'} icon={<BookText className="w-3.5 h-3.5" />} />
              <Info label="Model" value={s2?.model || '—'} icon={<Cpu className="w-3.5 h-3.5" />} />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-4">
            <section style={PANEL} className="relative">
              <PanelHead icon={<FileText className="w-4 h-4" />} title="Content Length" />
              <div className="p-6">
                <div style={CARD} className="p-4">
                  <div className="text-sm mb-2" style={{ color: 'var(--text)' }}>Characters</div>
                  <div className="w-full h-2 rounded-[6px]" style={{ background: 'color-mix(in oklab, var(--text) 10%, transparent)' }}>
                    <div className="h-2 rounded-[6px]" style={{ background: CTA, width: `${Math.min(100, (chars / maxChars) * 100)}%` }} />
                  </div>
                  <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{chars.toLocaleString()} / {maxChars.toLocaleString()}</div>
                </div>
              </div>
            </section>

            <section style={PANEL} className="relative">
              <PanelHead icon={<KeyRound className="w-4 h-4" />} title="API Configuration" />
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div style={CARD} className="p-4">
                    <div style={{ color: 'var(--text-muted)' }}>Input Cost</div>
                    <div style={{ color: 'var(--text)' }} className="mt-1">
                      ${inputCostPerMTok.toFixed(2)} <span style={{ color: 'var(--text-muted)' }}>/ 1M tokens</span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Est. tokens: {estTokens.toLocaleString()}</div>
                  </div>
                  <div style={CARD} className="p-4">
                    <div style={{ color: 'var(--text-muted)' }}>Output Cost</div>
                    <div style={{ color: 'var(--text)' }} className="mt-1">
                      ${outputCostPerMTok.toFixed(2)} <span style={{ color: 'var(--text-muted)' }}>/ 1M tokens</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <section style={PANEL} className="relative">
              <PanelHead icon={<Check className="w-4 h-4" />} title="Requirements" />
              <div className="p-6">
                <div style={CARD} className="p-4 mb-4">
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

                <div className="p-4" style={{ ...CARD }}>
                  <div className="flex items-center gap-2 font-semibold" style={{ color: CTA }}>
                    <Sparkles className="w-4 h-4" />
                    {ready ? 'Ready to Generate' : 'Missing Requirements'}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {ready ? 'Your AI will be created now using your selected API key.' : 'Please complete the missing items above.'}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex justify-between mt-8">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm transition"
            style={{ background: 'var(--panel)', border: `1px solid ${GREEN_LINE}`, color: 'var(--text)', boxShadow: '0 10px 22px rgba(89,217,179,.20)' }}
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          <button
            onClick={handleGenerate}
            disabled={!ready || loading}
            className="inline-flex items-center gap-2 px-8 h-[42px] rounded-[10px] font-semibold select-none disabled:cursor-not-allowed"
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
          <div className="w-full max-w-md rounded-[12px] p-6 text-center"
               style={{ background: 'var(--panel)', border: `1px solid ${GREEN_LINE}`, boxShadow: '0 22px 44px rgba(0,0,0,.28), 0 8px 20px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.10)' }}>
            <div className="mb-4 flex items-center justify-center gap-2">
              {steps.map((_, i) => (
                <span key={i} className="inline-block w-2 h-2 rounded-full"
                      style={{
                        background: i <= loadingIdx ? CTA : 'rgba(255,255,255,.12)',
                        opacity: i === loadingIdx ? 1 : .55,
                        transform: i === loadingIdx ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all .25s ease',
                      }} />
              ))}
            </div>
            <div className="w-full h-1 rounded-full overflow-hidden"
                 style={{ background: 'rgba(255,255,255,.08)' }}>
              <div className="h-1" style={{ width: `${progressPct}%`, background: CTA, transition: 'width .35s ease' }} />
            </div>

            <Loader2 className="w-7 h-7 mx-auto animate-spin my-4" style={{ color: CTA }} />
            <div className="text-base font-semibold" style={{ color: 'var(--text)' }}>{loadingMsg}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Do not close this tab.
            </div>
          </div>
        </div>
      )}

      {/* Done toast */}
      {done && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-[10px] px-4 py-3"
          style={{ background: 'var(--panel)', border: `1px solid ${GREEN_LINE}`, boxShadow: '0 10px 22px rgba(89,217,179,.20)', color: 'var(--text)' }}
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" style={{ color: CTA }} />
            <div className="text-sm">AI generated and saved to your Builds.</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────── UI bits (VoiceAgent-style chips) ───────────────────── */

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div style={CARD} className="p-3 rounded-[10px]">
      <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
        <span className="inline-grid place-items-center w-4 h-4 rounded-[6px]"
              style={{ background:'rgba(89,217,179,.12)', color: CTA, border:`1px solid ${GREEN_LINE}` }}>
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-0.5 truncate" style={{ color: 'var(--text)' }}>{value || '—'}</div>
    </div>
  );
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-[6px]"
        style={{
          background: ok ? 'rgba(16,185,129,.14)' : 'rgba(239,68,68,.18)',
          border: `1px solid ${ok ? 'rgba(16,185,129,.35)' : 'rgba(239,68,68,.40)'}`,
          color: ok ? BTN_GREEN : '#ef4444',
        }}
      >
        {ok ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      </span>
      <span style={{ color: ok ? 'var(--text)' : 'var(--text-muted)' }}>{label}</span>
