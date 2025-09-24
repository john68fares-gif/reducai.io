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

/* ─────────────────────────── Visual tokens (match VoiceAgentSection) ─────────────────────────── */

const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';
const BTN_DISABLED = 'color-mix(in oklab, var(--text) 14%, transparent)';

const RADIUS = 8;
const VA_BORDER = '1px solid rgba(255,255,255,.10)';
const VA_CARD_SHADOW = '0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px rgba(89,217,179,.20)';

const CARD: React.CSSProperties = {
  background: 'var(--panel)',
  border: VA_BORDER,
  boxShadow: VA_CARD_SHADOW,
  borderRadius: RADIUS,
};

const PANEL: React.CSSProperties = {
  background: 'var(--panel)',
  border: VA_BORDER,
  boxShadow: VA_CARD_SHADOW,
  borderRadius: RADIUS,
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

/* Robust JSON helpers */
async function safeJson<T = any>(resp: Response): Promise<{ ok: boolean; json?: T; text?: string; status: number; allow?: string }> {
  const ct = resp.headers.get('content-type') || '';
  const allow = resp.headers.get('allow') || resp.headers.get('Allow') || '';
  const body = await resp.text(); // read once
  if (ct.includes('application/json')) {
    try {
      const json = body ? JSON.parse(body) : {};
      return { ok: resp.ok, json, status: resp.status, allow };
    } catch {
      return { ok: resp.ok, text: body, status: resp.status, allow };
    }
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

/** Try OPTIONS to discover allowed verbs, then write with an allowed verb; try multiple endpoints + / */
async function negotiateAndWriteJSON(
  endpoints: string[],
  payload: any,
  preferred: Array<'POST'|'PUT'|'PATCH'> = ['POST','PUT','PATCH']
): Promise<{ ok: boolean; json?: any; text?: string; status: number; allow?: string; tried?: string[] }> {
  const tried: string[] = [];
  const withSlashVariants = (u: string) => [u, u.endsWith('/') ? u : `${u}/`];

  for (const ep of endpoints) {
    for (const url of withSlashVariants(ep)) {
      // 1) OPTIONS to read Allow
      let allow: string = '';
      try {
        const opt = await fetch(url, { method: 'OPTIONS' });
        allow = opt.headers.get('allow') || opt.headers.get('Allow') || '';
      } catch { /* ignore */ }

      const allowList = allow
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

      const methods = allowList.length
        ? preferred.filter(p => allowList.includes(p))
        : preferred;

      // 2) attempt with allowed / preferred methods
      for (const m of methods) {
        tried.push(`${m} ${url}`);
        const r = await fetch(url, {
          method: m,
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        });
        const pack = await safeJson(r);
        if (pack.ok) return { ...pack, tried };
        // If not OK and not 405/404, bubble up now
        if (pack.status !== 405 && pack.status !== 404) return { ...pack, tried };
      }
    }
  }

  // Final attempt: re-try first endpoint with POST so we can return a pack
  const finalResp = await fetch(endpoints[0], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload),
  });
  const finalPack = await safeJson(finalResp);
  return { ...finalPack, tried };
}

/** Simple resilient write (kept as fallback) */
async function resilientJsonWrite(
  url: string,
  payload: any,
  preferred: 'POST' | 'PUT' | 'PATCH' = 'POST'
): Promise<{ ok: boolean; json?: any; text?: string; status: number; allow?: string }> {
  const methods: Array<'POST'|'PUT'|'PATCH'> =
    preferred === 'POST' ? ['POST','PUT','PATCH'] :
    preferred === 'PUT'  ? ['PUT','PATCH','POST'] : ['PATCH','POST','PUT'];

  const candidates = [url, url.endsWith('/') ? url : `${url}/`];

  for (const m of methods) {
    for (const u of candidates) {
      const r = await fetch(u, {
        method: m,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      const pack = await safeJson(r);
      if (pack.ok) return pack;
      if (pack.status !== 405 && pack.status !== 404) return pack;
    }
  }
  const finalResp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload),
  });
  return safeJson(finalResp);
}

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

  async function saveBuildEverywhere(build: any) {
    // Cloud (scopedStorage)
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

    // Local (legacy mirror)
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
      // 1) read selected API key value from scopedStorage
      let apiKeyPlain = '';
      const selectedModel = s2?.model || 'gpt-4o-mini';
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const keys = await ss.getJSON<any[]>('apiKeys.v1', []);
        const sel = (keys || []).find(k => k.id === s2?.apiKeyId);
        apiKeyPlain = sel?.key || '';
      } catch {}

      if (!apiKeyPlain) {
        throw new Error('No API key value found for the selected key. Re-select your API key in Step 2.');
      }

      if (!finalPrompt || finalPrompt.trim().length === 0) {
        throw new Error('Final prompt is empty. Please fill the description/rules/flow in previous steps.');
      }

      // 2) create assistant via server route (robust JSON handling)
      setLoadingMsg('Creating assistant on OpenAI…');
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
      if (!createPack.ok) {
        throw new Error(explainHttp('Assistant create failed', createPack));
      }

      const assistantId: string | undefined = createPack.json?.assistant?.id;
      if (!assistantId) {
        throw new Error('Assistant created but no ID returned from server.');
      }

      // 3) current user id
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) throw new Error('No Supabase user session');

      // 4) persist to your backend — NEGOTIATE route + method like VA would
      setLoadingMsg('Saving build to your account…');

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

      // Try likely endpoints first (covers 405 on /api/chatbots/save)
      const saveTargets = [
        '/api/chatbots/save',
        '/api/chatbots',
        '/api/builds/save',
        '/api/builds',
      ];

      let savePack = await negotiateAndWriteJSON(saveTargets, savePayload, ['POST','PUT','PATCH']);
      if (!savePack.ok) {
        // as a last resort, try the original resilient writer on the first endpoint
        const fallback = await resilientJsonWrite('/api/chatbots/save', savePayload, 'POST');
        if (!fallback.ok || (fallback.json && fallback.json.ok === false)) {
          // show exactly what we tried and what the server allows
          const tried = (savePack.tried || []).join('  •  ');
          const allowNote = savePack.allow ? `Allowed methods reported: ${savePack.allow}` : 'No Allow header.';
          throw new Error(
            explainHttp('Save build failed', savePack) +
            (tried ? `\nTried: ${tried}` : '') +
            `\n${allowNote}`
          );
        }
        savePack = fallback;
      }

      // 5) mirror to cloud + local
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-4">
            <div style={PANEL} className="relative p-6">
              <Orb />
              <div className="flex items-center gap-2 mb-4 font-semibold">
                <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} /> Content Length
              </div>
              <div style={CARD} className="p-4">
                <div className="text-sm mb-2" style={{ color: 'var(--text)' }}>Characters</div>
                <div className="w-full h-2 rounded-[6px]" style={{ background: 'color-mix(in oklab, var(--text) 10%, transparent)' }}>
                  <div className="h-2 rounded-[6px]" style={{ background: 'var(--brand)', width: `${Math.min(100, (chars / maxChars) * 100)}%` }} />
                </div>
                <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{chars.toLocaleString()} / {maxChars.toLocaleString()}</div>
              </div>
            </div>

            <div style={PANEL} className="relative p-6">
              <Orb />
              <div className="flex items-center gap-2 mb-4 font-semibold">
                <KeyRound className="w-4 h-4" style={{ color: 'var(--brand)' }} /> API Configuration
              </div>
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
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div style={PANEL} className="relative p-6">
              <Orb />
              <div className="flex items-center gap-2 mb-4 font-semibold">
                <div className="w-4 h-4 rounded-[6px] border flex items-center justify-center" style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}>✓</div>
                Requirements
              </div>

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
        <div className="flex justify-between mt-8">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm transition"
            style={{ background: 'var(--panel)', border: VA_BORDER, color: 'var(--text)', boxShadow: VA_CARD_SHADOW }}
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          <button
            onClick={handleGenerate}
            disabled={!ready || loading}
            className="inline-flex items-center gap-2 px-8 h-[40px] rounded-[8px] font-semibold select-none disabled:cursor-not-allowed"
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
          <div className="w-full max-w-md rounded-[8px] p-6 text-center" style={{ background: 'var(--panel)', border: VA_BORDER, boxShadow: VA_CARD_SHADOW }}>
            <Loader2 className="w-7 h-7 mx-auto animate-spin mb-3" style={{ color: 'var(--brand)' }} />
            <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Generating AI…</div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{loadingMsg}</div>
          </div>
        </div>
      )}

      {/* Done toast */}
      {done && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-[8px] px-4 py-3"
          style={{ background: 'var(--panel)', border: VA_BORDER, boxShadow: VA_CARD_SHADOW, color: 'var(--text)' }}
        >
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
    <div style={CARD} className="p-3 rounded-[8px]">
      <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>{icon}{label}</div>
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
          background: ok ? 'color-mix(in oklab, var(--brand) 15%, transparent)' : 'rgba(255,120,120,0.12)',
          border: `1px solid ${ok ? 'color-mix(in oklab, var(--brand) 40%, transparent)' : 'rgba(255,120,120,0.4)'}`,
        }}
      >
        {ok ? <Check className="w-3 h-3" style={{ color: 'var(--brand)' }} /> : <AlertCircle className="w-3 h-3" style={{ color: 'salmon' }} />}
      </span>
      <span style={{ color: ok ? 'var(--text)' : 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}
