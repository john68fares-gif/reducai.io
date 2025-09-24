// components/builder/Step4Overview.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check, AlertCircle, Loader2, Sparkles, ArrowLeft,
  Cpu, BookText, FileText, KeyRound, Library, Settings2
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';
import { supabase } from '@/lib/supabase-client';
import StepProgress from './StepProgress';
import { s, st } from '@/utils/safe';

/* ─────────────────────────── Visual tokens to match VoiceAgentSection ─────────────────────────── */
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';

const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --bg:#0b0c10; --panel:#0d0f11; --text:#e6f1ef; --text-muted:#9fb4ad;
      --card:#0f1214; --border:rgba(255,255,255,.10);
      --shadow-card:0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px ${GREEN_LINE};
      --shadow-soft:0 10px 22px rgba(0,0,0,.22);
      --radius:8px;
    }
    .va-card{ border-radius:var(--radius); border:1px solid var(--border); background:var(--panel); box-shadow:var(--shadow-card); overflow:hidden; }
    .va-head{
      display:grid; grid-template-columns:1fr auto; align-items:center;
      min-height:56px; padding:0 12px; border-bottom:1px solid rgba(255,255,255,.08);
      background:linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%);
      color:var(--text);
    }
    .chip{ border:1px solid rgba(255,255,255,.12); border-radius:8px; padding:4px 8px; }
  `}</style>
);

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

/* Robust HTTP helpers (no JSON crashes) */
async function safeJson<T = any>(resp: Response): Promise<{ ok: boolean; status: number; json?: T; text?: string }> {
  const status = resp.status;
  const ct = resp.headers.get('content-type') || '';
  const body = await resp.text(); // read once
  if (ct.includes('application/json')) {
    try { return { ok: resp.ok, status, json: body ? JSON.parse(body) : {} }; }
    catch { return { ok: resp.ok, status, text: body }; }
  }
  return { ok: resp.ok, status, text: body };
}
function httpExplain(label: string, pack: { ok: boolean; status: number; json?: any; text?: string }) {
  if (pack.ok) return '';
  const msg = (pack.json && (pack.json.error || pack.json.message)) || (pack.text || '').slice(0, 600) || 'No response body';
  return `${label} (HTTP ${pack.status}): ${msg}`;
}

/* Try multiple save routes/methods to dodge 405s transparently */
async function resilientSaveBuild(payload: any) {
  const trials: Array<{ url: string; method: 'POST' | 'PUT' }> = [
    { url: '/api/chatbots/save', method: 'POST' },
    { url: '/api/chatbots/save', method: 'PUT'  },     // handle servers that expect PUT
    { url: '/api/builds/save',   method: 'POST' },     // legacy/fallback path
  ];

  let lastError = 'Unknown error';
  for (const t of trials) {
    try {
      const r = await fetch(t.url, {
        method: t.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const pack = await safeJson(r);
      if (pack.ok && (pack.json?.ok !== false)) return pack.json || { ok: true };
      // if method not allowed, keep trying
      if (pack.status === 405) { lastError = httpExplain('Save build failed', pack); continue; }
      // other server-side errors – stop early with explanation
      throw new Error(httpExplain('Save build failed', pack));
    } catch (e:any) {
      lastError = e?.message || String(e);
    }
  }
  throw new Error(lastError);
}

/* ───────────────────────────── Component ───────────────────────────── */

export default function Step4Overview({ onBack, onFinish }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Generating AI…');
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [toastKind, setToastKind] = useState<'info'|'error'>('info');

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

    // Local mirror (legacy)
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
    setToast('');

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

      // 2) create assistant via server route
      setLoadingMsg('Creating assistant on OpenAI…');
      const createResp = await fetch('/api/assistants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: st(s1?.name, 'Untitled Assistant'),
          model: selectedModel,
          prompt: finalPrompt,
          apiKeyPlain,
        }),
      });
      const createPack = await safeJson(createResp);
      if (!createPack.ok) throw new Error(httpExplain('Assistant create failed', createPack));

      const assistantId: string | undefined = createPack.json?.assistant?.id;
      if (!assistantId) throw new Error('Assistant created but no ID returned from server.');

      // 3) current user id
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) throw new Error('No Supabase user session');

      // 4) persist to your DB via resilient saver (handles 405)
      setLoadingMsg('Saving build to your account…');
      await resilientSaveBuild({
        userId,
        assistantId,
        name: st(s1?.name, 'Untitled Assistant'),
        model: selectedModel,
        industry: st(s1?.industry, null),
        language: st(s1?.language, 'English'),
        prompt: finalPrompt,
        appearance: null,
      });

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
      setToastKind('info'); setToast('AI generated and saved to your Builds.');
      setTimeout(()=>setToast(''), 2200);
      onFinish?.();
    } catch (e: any) {
      setLoading(false);
      const msg = e?.message || 'Failed to generate the AI.';
      try { localStorage.setItem('builder:lastError', msg); } catch {}
      setToastKind('error'); setToast(msg);
      setTimeout(()=>setToast(''), 4000);
      alert(msg);
    }
  }

  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <StepProgress current={4} />

        {/* Top summary card — matches va-card/va-head */}
        <div className="va-card mb-6">
          <div className="va-head">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg grid place-items-center" style={{ background:'rgba(89,217,179,.12)' }}>
                <Settings2 className="w-4 h-4" style={{ color: CTA }} />
              </span>
              <span className="font-semibold">Final Review</span>
            </div>
            <div className="text-xs" style={{ color:'var(--text-muted)' }}>{loading ? loadingMsg : ''}</div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Info label="AI Name" value={s1?.name || '—'} icon={<FileText className="w-3.5 h-3.5" />} />
              <Info label="Industry" value={s1?.industry || '—'} icon={<Library className="w-3.5 h-3.5" />} />
              <Info label="Template" value={s1?.type || s1?.botType || s1?.aiType || '—'} icon={<BookText className="w-3.5 h-3.5" />} />
              <Info label="Model" value={s2?.model || '—'} icon={<Cpu className="w-3.5 h-3.5" />} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            <Panel title="Content Length">
              <div className="p-4 rounded-[8px]" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                <div className="text-sm mb-2">Characters</div>
                <div className="w-full h-2 rounded-full" style={{ background: 'color-mix(in oklab, var(--text) 10%, transparent)' }}>
                  <div className="h-2 rounded-full" style={{ background: CTA, width: `${Math.min(100, (chars / maxChars) * 100)}%` }} />
                </div>
                <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{chars.toLocaleString()} / {maxChars.toLocaleString()}</div>
              </div>
            </Panel>

            <Panel title="API Configuration" icon={<KeyRound className="w-4 h-4" style={{ color: CTA }} />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-[8px]" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Input Cost</div>
                  <div className="mt-1">${inputCostPerMTok.toFixed(2)} <span style={{ color: 'var(--text-muted)' }}>/ 1M tokens</span></div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Est. tokens: {estTokens.toLocaleString()}</div>
                </div>
                <div className="p-4 rounded-[8px]" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Output Cost</div>
                  <div className="mt-1">${outputCostPerMTok.toFixed(2)} <span style={{ color: 'var(--text-muted)' }}>/ 1M tokens</span></div>
                </div>
              </div>
            </Panel>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <Panel title="Requirements">
              <div className="p-4 rounded-[8px] mb-4" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
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

              <div className="rounded-[8px] p-4" style={{ background:'var(--panel)', border:'1px solid var(--border)' }}>
                <div className="flex items-center gap-2 font-semibold" style={{ color: CTA }}>
                  <Sparkles className="w-4 h-4" />
                  {ready ? 'Ready to Generate' : 'Missing Requirements'}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {ready ? 'Your AI will be created now using your selected API key.' : 'Please complete the missing items above.'}
                </div>
              </div>
            </Panel>
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex justify-between mt-10">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm transition"
            style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          <button
            onClick={handleGenerate}
            disabled={!ready || loading}
            className="inline-flex items-center gap-2 h-[40px] rounded-[8px] font-semibold select-none px-5 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: ready && !loading ? CTA : 'color-mix(in oklab, var(--text) 14%, transparent)', color: '#0b0f0e', boxShadow:'0 10px 22px rgba(89,217,179,.20)' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate AI
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center px-4">
          <div className="w-full max-w-md rounded-[8px] p-6 text-center" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
            <Loader2 className="w-7 h-7 mx-auto animate-spin mb-3" style={{ color: CTA }} />
            <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Generating AI…</div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{loadingMsg}</div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-[8px] px-4 py-3"
             style={{
               background:'var(--panel)', border:'1px solid var(--border)', color:'var(--text)',
               boxShadow:'0 10px 22px rgba(0,0,0,.22)'
             }}>
          <div className="flex items-center gap-2">
            {toastKind === 'error'
              ? <AlertCircle className="w-4 h-4" style={{ color:'#ef4444' }} />
              : <Check className="w-4 h-4" style={{ color: CTA }} />
            }
            <div className="text-sm">{toast}</div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────── UI bits (match VA style) ─────────────────────────── */

function Panel({ title, icon, children }:{
  title:string; icon?:React.ReactNode; children:React.ReactNode;
}) {
  return (
    <div className="va-card">
      <div className="va-head">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg grid place-items-center" style={{ background:'rgba(89,217,179,.12)' }}>
            {icon ?? <div className="w-3 h-3 rounded-full" style={{ background: CTA }} />}
          </span>
          <span className="font-semibold">{title}</span>
        </div>
        <div />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="p-3 rounded-[8px]" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
      <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)'
