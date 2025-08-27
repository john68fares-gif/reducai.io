// components/builder/Step4Overview.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check, AlertCircle, Loader2, Sparkles, ArrowLeft,
  Cpu, BookText, FileText, KeyRound, Library, Settings2
} from 'lucide-react';
import StepProgress from './StepProgress';
import { s, st } from '@/utils/safe';

type Props = { onBack?: () => void; onFinish?: () => void };

/* === Outer card style: matches Step 3 tiles === */
const CARD_OUTER: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.18)',
  boxShadow:
    'inset 0 0 22px rgba(0,0,0,0.28), 0 0 18px rgba(106,247,209,0.05), 0 0 22px rgba(0,255,194,0.05)',
  borderRadius: 28,
};

/* === Inner card style (same as Step 3 preview/modal cards) === */
const CARD_INNER: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.30)',
  borderRadius: 20,
  boxShadow: 'inset 0 0 12px rgba(0,0,0,0.38)',
};

/* === Radial glow orb (Step 3 vibe) === */
const ORB_STYLE: React.CSSProperties = {
  background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)',
  filter: 'blur(38px)',
};

/* === Buttons: same palette/hover as Step 3 === */
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

function getStep1() {
  try { return JSON.parse(localStorage.getItem('builder:step1') || 'null') || {}; } catch { return {}; }
}
function getStep2() {
  try { return JSON.parse(localStorage.getItem('builder:step2') || 'null') || {}; } catch { return {}; }
}
function getStep3() {
  try { return JSON.parse(localStorage.getItem('builder:step3') || 'null') || {}; } catch { return {}; }
}

/* === Updated to include header (name / industry / language) and always keep COMPANY FAQ === */
function mergePrompt(): string {
  const s1 = getStep1();
  const s3 = getStep3();

  // 3-line header exactly like requested
  const header = [st(s1?.name), st(s1?.industry), st(s1?.language)]
    .filter(Boolean)
    .join('\n');

  const industry = st(s1?.industry, 'your industry');
  const language = st(s1?.language, 'English');

  // Always include the FAQ header—even if empty
  const faqBody = (s(s3?.company) || '').trim();

  const sections = [
    header,
`**DESCRIPTION:**

- **Language of prompt:** ${language}
- **Communication Level:** Informal and friendly tone, like two friends texting. Grade 3 according to the Hemingway app.
- **Core identity and personality of the AI:** Friendly and engaging virtual receptionist.
- **Primary purpose and expertise:** To assist clients in their ${industry} journey, provide expert advice, and facilitate the process.`,
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

export default function Step4Overview({ onBack, onFinish }: Props) {
  const s1 = useMemo(getStep1, []);
  const s2 = useMemo(getStep2, []);
  const s3 = useMemo(getStep3, []);
  const finalPrompt = useMemo(mergePrompt, []);
  const chars = finalPrompt.length;
  const maxChars = 32000;

  const estTokens = Math.max(1, Math.round(chars / 4));
  const inputCostPerMTok = 2.5;
  const outputCostPerMTok = 10.0;

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Generating AI…');
  const [done, setDone] = useState(false);

  const checks = {
    name: !!st(s1?.name),
    industry: !!st(s1?.industry),
    language: !!st(s1?.language),
    template: !!(s1?.type || s1?.botType || s1?.aiType),
    model: !!s2?.model,
    apiKey: !!s2?.apiKeyId || !!s2?.openaiKey,
    description: !!st(s3?.description),
    flow: !!st(s3?.flow),
    rules: !!st(s3?.rules),
    company: true,
  };
  const ready = Object.values(checks).every(Boolean);

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
    const id = setInterval(() => { i = (i + 1) % msgs.length; setLoadingMsg(msgs[i]); }, 1300);
    return () => clearInterval(id);
  }, [loading]);

  const validate = () => {
    if (!checks.name) return 'Please set an AI Name in Step 1.';
    if (!checks.industry) return 'Please set an industry in Step 1.';
    if (!checks.language) return 'Please choose a language in Step 1.';
    if (!checks.model) return 'Please pick a model in Step 2.';
    if (!checks.apiKey) return 'Please add an API key in Step 2.';
    if (!checks.description || !checks.rules || !checks.flow)
      return 'Please complete Description, Rules, and Conversation Flow in Step 3.';
    return null;
  };

  async function handleGenerate() {
    const err = validate();
    if (err) { alert(err); return; }

    const minMs = 15000, maxMs = 30000;
    const uiDelay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

    setLoading(true);
    setDone(false);

    try {
      const bots = JSON.parse(localStorage.getItem('chatbots') || '[]') as any[];

      const build = {
        id: crypto?.randomUUID?.() || String(Date.now()),
        name: st(s1?.name, 'Untitled Bot'),
        type: st(s1?.type || s1?.botType || s1?.aiType, 'ai automation'),
        industry: st(s1?.industry),
        language: st(s1?.language, 'English'),
        model: st(s2?.model, 'gpt-4o-mini'),
        prompt: finalPrompt,
        thumbnail: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      bots.unshift(build);
      localStorage.setItem('chatbots', JSON.stringify(bots));
      localStorage.setItem('builder:cleanup', '1');

      await new Promise(r => setTimeout(r, uiDelay));

      setLoading(false);
      setDone(true);
      onFinish?.();
    } catch {
      setLoading(false);
      alert('Failed to generate the AI. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white font-movatif">
      <div className="max-w-6xl mx-auto px-6 md:px-8 pt-10 pb-24">
        {/* Step header matches Step 3 */}
        <StepProgress current={4} />

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Final Review</h1>
            <div className="text-white/70 mt-1 text-sm">Review your AI configuration and generate your assistant</div>
          </div>
          <div className="text-sm text-white/60 hidden md:block">Step 4 of 4</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Configuration */}
            <div style={CARD_OUTER} className="p-6 rounded-[28px] relative">
              <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB_STYLE} />
              <div className="flex items-center gap-2 mb-4 text-white/90 font-semibold">
                <Settings2 className="w-4 h-4 text-[#6af7d1]" /> AI Configuration
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
              <div className="flex items-center gap-2 mb-4 text-white/90 font-semibold">
                <FileText className="w-4 h-4 text-[#6af7d1]" /> Content Length
              </div>
              <div style={CARD_INNER} className="p-4 rounded-2xl">
                <div className="text-sm text-white/80 mb-2">Characters</div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-2 rounded-full" style={{ background:'#6af7d1', width: `${Math.min(100, (chars / maxChars) * 100)}%` }} />
                </div>
                <div className="text-xs text-white/70 mt-2">{chars.toLocaleString()} / {maxChars.toLocaleString()}</div>
              </div>
            </div>

            {/* API Configuration */}
            <div style={CARD_OUTER} className="p-6 rounded-[28px] relative">
              <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB_STYLE} />
              <div className="flex items-center gap-2 mb-4 text-white/90 font-semibold">
                <KeyRound className="w-4 h-4 text-[#6af7d1]" /> API Configuration
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div style={CARD_INNER} className="p-4 rounded-2xl">
                  <div className="text-white/70">Input Cost</div>
                  <div className="text-white mt-1">
                    ${inputCostPerMTok.toFixed(2)} <span className="text-white/60">/ 1M tokens</span>
                  </div>
                  <div className="text-xs text-white/60 mt-1">Est. tokens: {estTokens.toLocaleString()}</div>
                </div>
                <div style={CARD_INNER} className="p-4 rounded-2xl">
                  <div className="text-white/70">Output Cost</div>
                  <div className="text-white mt-1">
                    ${outputCostPerMTok.toFixed(2)} <span className="text-white/60">/ 1M tokens</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div style={CARD_OUTER} className="p-6 rounded-[28px] relative">
              <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB_STYLE} />
              <div className="flex items-center gap-2 mb-4 text-white/90 font-semibold">
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

              <div className="rounded-2xl p-4 border" style={{ ...CARD_INNER, border: '1px solid rgba(255,255,255,0.18)' }}>
                <div className="flex items-center gap-2 text-[#6af7d1] font-semibold">
                  <Sparkles className="w-4 h-4" />
                  {ready ? 'Ready to Generate' : 'Missing Requirements'}
                </div>
                <div className="text-xs text-white/70 mt-1">
                  {ready
                    ? 'Your AI assistant will be created in about a minute.'
                    : 'Please complete the missing items above.'}
                </div>
                <div className="text-xs text-amber-300/80 mt-3 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  You’re using your own API key.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ⬇️ Footer controls BELOW the grid, like Step 3 */}
        <div className="flex justify-between mt-10">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          {/* SAME HEIGHT as Previous (py-2) */}
          <button
            onClick={handleGenerate}
            disabled={!ready}
            className="inline-flex items-center gap-2 px-8 py-2 rounded-[24px] font-semibold select-none transition-colors duration-150 disabled:cursor-not-allowed"
            style={{
              background: ready ? BTN_GREEN : BTN_DISABLED,
              color: '#ffffff',
              boxShadow: ready ? '0 1px 0 rgba(0,0,0,0.18)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!ready) return;
              (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
            }}
            onMouseLeave={(e) => {
              if (!ready) return;
              (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
            }}
          >
            <Sparkles className="w-4 h-4" /> Generate AI
          </button>
        </div>
      </div>

      {/* Loading overlay – improved visuals (glow + pulsing progress bar) */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div
            className="w-full max-w-md rounded-[28px] p-6 text-center relative overflow-hidden"
            style={{
              background:'linear-gradient(180deg, rgba(22,24,27,0.98) 0%, rgba(14,16,18,0.98) 100%)',
              border:'2px dashed rgba(0,255,194,0.30)',
              boxShadow:'0 0 24px rgba(0,255,194,0.12), inset 0 0 18px rgba(0,0,0,0.40)'
            }}
          >
            {/* soft radial glow inside modal */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-[35%] -left-[35%] w-[90%] h-[90%] rounded-full"
              style={{ background:'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter:'blur(40px)' }}
            />
            <Loader2 className="w-7 h-7 mx-auto animate-spin mb-3 text-[#6af7d1]" />
            <div className="text-lg font-semibold">Generating AI…</div>
            <div className="text-sm text-white/70 mt-1">{loadingMsg}</div>

            {/* pulsing progress bar */}
            <div className="mt-4 w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full w-1/2 animate-pulse rounded-full"
                style={{ background:'linear-gradient(90deg, transparent, rgba(106,247,209,0.85), transparent)' }}
              />
            </div>

            {/* subtle top accent line */}
            <div
              aria-hidden
              className="absolute left-0 right-0 top-0 h-[1px]"
              style={{ background:'linear-gradient(90deg, transparent, rgba(106,247,209,0.35), transparent)' }}
            />
          </div>
        </div>
      )}

      {/* Done toast */}
      {done && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-[16px] px-4 py-3"
          style={{ background:'rgba(16,19,20,0.95)', border:'1px solid rgba(106,247,209,0.40)', boxShadow:'0 0 14px rgba(106,247,209,0.18)' }}
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#6af7d1]" />
            <div className="text-sm">AI generated and saved to your Builds.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div style={CARD_INNER} className="p-3 rounded-2xl">
      <div className="text-xs text-white/60 flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-white mt-0.5 truncate">{value || '—'}</div>
    </div>
  );
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-[6px]"
        style={{ background: ok ? 'rgba(106,247,209,0.18)' : 'rgba(255,120,120,0.12)', border: `1px solid ${ok ? 'rgba(106,247,209,0.5)' : 'rgba(255,120,120,0.4)'}` }}
      >
        {ok ? <Check className="w-3 h-3 text-[#6af7d1]" /> : <AlertCircle className="w-3 h-3 text-[#ff8a8a]" />}
      </span>
      <span className={ok ? 'text-white/90' : 'text-white/60'}>{label}</span>
    </div>
  );
}
function ChecklistIcon() { return <div className="w-4 h-4 rounded-[6px] border border-[#6af7d1] text-[#6af7d1] flex items-center justify-center">✓</div>; }
function cap(sv: string) { return sv ? sv[0].toUpperCase() + sv.slice(1) : sv; }
