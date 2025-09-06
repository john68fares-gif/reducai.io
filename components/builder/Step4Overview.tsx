// components/builder/Step4Overview.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check, AlertCircle, Loader2, Sparkles, ArrowLeft,
  Cpu, BookText, FileText, KeyRound, Library, Settings2
} from 'lucide-react';
import StepProgress from './StepProgress';
import { s, st } from '@/utils/safe';
import { supabase } from '@/lib/supabase-client';

/** ----------- Buttons: same palette as your API Keys page ----------- */
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';
const BTN_DISABLED = 'color-mix(in oklab, var(--text) 18%, transparent)';

/** ----------- Cards & surfaces use your theme tokens ----------- */
const CARD_OUTER: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: 28,
};
const CARD_INNER: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
};
const ORB_STYLE: React.CSSProperties = {
  background: 'radial-gradient(circle, color-mix(in oklab, var(--brand) 16%, transparent) 0%, transparent 70%)',
  filter: 'blur(38px)',
};

/** ----------- Pull prior steps from localStorage (your app’s pattern) ----------- */
function getStep1() {
  try { return JSON.parse(localStorage.getItem('builder:step1') || 'null') || {}; } catch { return {}; }
}
function getStep2() {
  try { return JSON.parse(localStorage.getItem('builder:step2') || 'null') || {}; } catch { return {}; }
}
function getStep3() {
  try { return JSON.parse(localStorage.getItem('builder:step3') || 'null') || {}; } catch { return {}; }
}

/** ----------- Build a single compiled prompt (stable section headers) ----------- */
function mergePrompt(): string {
  const s1 = getStep1();
  const s3 = getStep3();

  const header = [st(s1?.name), st(s1?.industry), st(s1?.language)].filter(Boolean).join('\n');
  const industry = st(s1?.industry, 'your industry');
  const language = st(s1?.language, 'English');
  const faqBody = (s(s3?.company) || '').trim();

  const sections = [
    header,
`**DESCRIPTION:**

- **Language of prompt:** ${language}
- **Communication Level:** Informal and friendly tone, like two friends texting (Hemingway Grade 3).
- **Core identity and personality of the AI:** Friendly, concise, helpful.
- **Primary purpose and expertise:** Assist clients in their ${industry} journey, answer questions, and qualify leads.`,
`**AI Description:**
${s(s3?.description)}`,
`**RULES AND GUIDELINES:**
${s(s3?.rules)}`,
`**QUESTION FLOW:**
${s(s3?.flow)}`,
`**COMPANY FAQ:**
${faqBody}`,
  ];

  return sections.filter(Boolean).join('\n\n').trim();
}

type Props = { onBack?: () => void; onFinish?: () => void };

export default function Step4Overview({ onBack, onFinish }: Props) {
  const s1 = useMemo(getStep1, []);
  const s2 = useMemo(getStep2, []);
  const s3 = useMemo(getStep3, []);
  const finalPrompt = useMemo(mergePrompt, []);
  const chars = finalPrompt.length;
  const maxChars = 32000;

  const estTokens = Math.max(1, Math.round(chars / 4));
  // Display-only; adjust to your pricing sheet if you want
  const inputCostPerMTok = 2.5;
  const outputCostPerMTok = 10.0;

  const checks = {
    name: !!st(s1?.name),
    industry: !!st(s1?.industry),
    language: !!st(s1?.language),
    template: !!(s1?.type || s1?.botType || s1?.aiType),
    model: !!s2?.model,
    apiKey: !!s2?.apiKeyId || !!s2?.openaiKey, // you store apiKeyId in step 2
    description: !!st(s3?.description),
    flow: !!st(s3?.flow),
    rules: !!st(s3?.rules),
    company: true, // optional but we keep the header
  };
  const ready = Object.values(checks).every(Boolean);

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Compiling…');
  const [done, setDone] = useState(false);

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

  const validate = () => {
    if (!checks.name) return 'Please set an AI Name in Step 1.';
    if (!checks.industry) return 'Please set an industry in Step 1.';
    if (!checks.language) return 'Please choose a language in Step 1.';
    if (!checks.model) return 'Please pick a model in Step 2.';
    if (!checks.apiKey) return 'Please add/select an API key in Step 2.';
    if (!checks.description || !checks.rules || !checks.flow)
      return 'Please complete Description, Rules, and Conversation Flow in Step 3.';
    if (chars > maxChars) return 'Your compiled prompt is too long. Trim Step 3 content.';
    return null;
  };

  async function handleGenerate() {
    const err = validate();
    if (err) { alert(err); return; }

    setLoading(true); setDone(false);

    try {
      // 1) get user access token (no helpers; works in browser)
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Not signed in');

      // 2) collect payload
      const name = st(s1?.name, 'Assistant');
      const model = st(s2?.model, 'gpt-4o-mini');
      const apiKeyId = s2?.apiKeyId; // Step 2 stored selection
      if (!apiKeyId) throw new Error('No API key selected');

      // 3) call our server route that creates the Assistant in the user's OpenAI
      const res = await fetch('/api/assistants/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`, // let the route act as this user
        },
        body: JSON.stringify({ apiKeyId, model, name, instructions: finalPrompt }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Failed to create assistant');

      const assistantId: string = body.assistantId;

      // 4) Save to your Builder Dashboard storage (keeps wiring for tests)
      const bots = JSON.parse(localStorage.getItem('chatbots') || '[]') as any[];
      const build = {
        id: crypto?.randomUUID?.() || String(Date.now()),
        name,
        industry: st(s1?.industry),
        language: st(s1?.language, 'English'),
        model,
        prompt: finalPrompt,
        assistantId,   // needed for chat/test later
        apiKeyId,      // which key this build uses
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      bots.unshift(build);
      localStorage.setItem('chatbots', JSON.stringify(bots));
      localStorage.setItem('builder:cleanup', '1');

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
      <div className="max-w-6xl mx-auto px-6 md:px-8 pt-10 pb-24">
        <StepProgress current={4} />

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Final Review</h1>
            <div className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Review your AI configuration and generate your assistant
            </div>
          </div>
          <div className="text-sm hidden md:block" style={{ color: 'var(--text-muted)' }}>Step 4 of 4</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Configuration */}
            <div style={CARD_OUTER} className="p-6 rounded-[28px] relative">
              <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB_STYLE} />
              <div className="flex items-center gap-2 mb-4 font-semibold" style={{ color: 'var(--text)' }}>
                <Settings2 className="w-4 h-4" style={{ color: 'var(--brand)' }} /> AI Configuration
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Info label="AI Name" value={s1?.name || '—'} icon={<FileText className="w-3.5 h-3.5" />} />
                <Info label="Industry" value={s1?.industry || '—'} icon={<Library className="w-3.5 h-3.5" />} />
                <Info label="Template" value={s1?.type ? cap(s1.type) : '—'} icon={<BookText className="w-3.5 h-3.5" />} />
                <Info label="Model" value={s2?.model || '—'} icon={<Cpu className="w-3.5 h-3.5" />} />
              </div>
            </div>

            {/* Content Length */}
            <div style={CARD_OUTER} className="p-6 rounded-[28px] relative">
              <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB_STYLE} />
              <div className="flex items-center gap-2 mb-4 font-semibold" style={{ color: 'var(--text)' }}>
                <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} /> Content Length
              </div>
              <div style={CARD_INNER} className="p-4 rounded-2xl">
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Characters</div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'color-mix(in oklab, var(--text) 10%, transparent)' }}>
                  <div className="h-2 rounded-full" style={{ background: 'var(--brand)', width: `${Math.min(100, (chars / maxChars) * 100)}%` }} />
                </div>
                <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  {chars.toLocaleString()} / {maxChars.toLocaleString()}
                </div>
              </div>
            </div>

            {/* API Costs (display-only) */}
            <div style={CARD_OUTER} className="p-6 rounded-[28px] relative">
              <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB_STYLE} />
              <div className="flex items-center gap-2 mb-4 font-semibold" style={{ color: 'var(--text)' }}>
                <KeyRound className="w-4 h-4" style={{ color: 'var(--brand)' }} /> API Configuration
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div style={CARD_INNER} className="p-4 rounded-2xl">
                  <div style={{ color: 'var(--text-muted)' }}>Input Cost</div>
                  <div style={{ color: 'var(--text)' }} className="mt-1">
                    ${inputCostPerMTok.toFixed(2)} <span style={{ color: 'var(--text-muted)' }}>/ 1M tokens</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Est. tokens: {estTokens.toLocaleString()}
                  </div>
                </div>
                <div style={CARD_INNER} className="p-4 rounded-2xl">
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
            <div style={CARD_OUTER} className="p-6 rounded-[28px] relative">
              <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB_STYLE} />
              <div className="flex items-center gap-2 mb-4 font-semibold" style={{ color: 'var(--text)' }}>
                <ChecklistIcon /> Requirements
              </div>

              <div style={CARD_INNER} className="p-4 rounded-2xl mb-4">
                <Req ok={checks.name} label="AI Name" />
                <Req ok={checks.industry} label="Industry" />
                <Req ok={checks.language} label="Language" />
                <Req ok={checks.template} label="Template" />
                <Req ok={checks.model} label="Model" />
                <Req ok={checks.apiKey} label="API Key" />
                <Req ok={checks.description} label="Description" />
                <Req ok={checks.flow} label="Conversation Flow" />
                <Req ok={checks.rules} label="Rules" />
                <Req ok={checks.company} label="Company Info" />
              </div>

              <div className="rounded-2xl p-4" style={{ ...CARD_INNER }}>
                <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--brand)' }}>
                  <Sparkles className="w-4 h-4" />
                  {ready ? 'Ready to Generate' : 'Missing Requirements'}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {ready
                    ? 'Your AI assistant will be created in your OpenAI account.'
                    : 'Please complete the missing items above.'}
                </div>
                <div className="text-xs mt-3 flex items-center gap-2" style={{ color: 'color-mix(in oklab, var(--text) 80%, #fcd34d)' }}>
                  <AlertCircle className="w-3.5 h-3.5" />
                  You’re using your own OpenAI API key.
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
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          <button
            onClick={handleGenerate}
            disabled={!ready}
            className="inline-flex items-center gap-2 px-8 h-[42px] rounded-[18px] font-semibold select-none disabled:cursor-not-allowed"
            style={{ background: ready ? BTN_GREEN : BTN_DISABLED, color: '#ffffff', boxShadow: ready ? '0 10px 24px rgba(16,185,129,.25)' : 'none' }}
            onMouseEnter={(e) => { if (ready) (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER; }}
            onMouseLeave={(e) => { if (ready) (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN; }}
          >
            <Sparkles className="w-4 h-4" /> Generate AI
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
          <div
            className="w-full max-w-md rounded-[28px] p-6 text-center relative overflow-hidden"
            style={{ ...CARD_OUTER, borderRadius: 28 }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-[35%] -left-[35%] w-[90%] h-[90%] rounded-full"
              style={ORB_STYLE}
            />
            <Loader2 className="w-7 h-7 mx-auto animate-spin mb-3" style={{ color: 'var(--brand)' }} />
            <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Generating AI…</div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{loadingMsg}</div>
            <div className="mt-4 w-full h-2 rounded-full overflow-hidden" style={{ background: 'color-mix(in oklab, var(--text) 10%, transparent)' }}>
              <div
                className="h-full w-1/2 animate-pulse rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, var(--brand), transparent)' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Done toast */}
      {done && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-[16px] px-4 py-3"
          style={{ background: 'var(--panel)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', color: 'var(--text)' }}
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

/* ------------------------------- tiny helpers ------------------------------ */
function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div style={CARD_INNER} className="p-3 rounded-2xl">
      <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>{icon}{label}</div>
      <div className="mt-0.5 truncate" style={{ color: 'var(--text)' }}>{value || '—'}</div>
    </div>
  );
}
function Req({ ok, label }: { ok: boolean; label: string }) {
  const okBg = 'color-mix(in oklab, var(--brand) 16%, transparent)';
  const okBr = 'color-mix(in oklab, var(--brand) 52%, transparent)';
  const noBg = 'color-mix(in oklab, crimson 16%, transparent)';
  const noBr = 'color-mix(in oklab, crimson 52%, transparent)';
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-[6px]"
        style={{ background: ok ? okBg : noBg, border: `1px solid ${ok ? okBr : noBr}` }}
      >
        {ok ? <Check className="w-3 h-3" style={{ color: 'var(--brand)' }} /> : <AlertCircle className="w-3 h-3" style={{ color: 'crimson' }} />}
      </span>
      <span style={{ color: ok ? 'var(--text)' : 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}
function ChecklistIcon() {
  return (
    <div
      className="w-4 h-4 rounded-[6px] flex items-center justify-center"
      style={{ border: '1px solid var(--brand)', color: 'var(--brand)' }}
    >
      ✓
    </div>
  );
}
function cap(sv: string) { return sv ? sv[0].toUpperCase() + sv.slice(1) : sv; }
