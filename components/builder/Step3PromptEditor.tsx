// components/builder/Step3PromptEditor.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import StepProgress from './StepProgress';
import {
  FileText,
  Settings,
  MessageSquareText,
  Landmark,
  BrainCircuit,
  ArrowLeft,
  X,
  Globe,
  Plus,
  Edit3,
  Sparkles,
  CircleHelp
} from 'lucide-react';
import { st } from '@/utils/safe';

/* ----------------------------- local helpers ----------------------------- */
function jget<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

type Props = { onNext?: () => void; onBack?: () => void };
type AIKind = 'sales' | 'support' | 'blank';
type SectionKey = 'language' | 'description' | 'rules' | 'flow' | 'company';

type Section = {
  key: SectionKey;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  defaultText: string;
  wide?: boolean;
};

type SavedStep3 = {
  kind: AIKind;
  industry: string;
  language: string;
  boundIndustry: string;
  boundLanguage: string;
  languageText: string;
  description: string;
  rules: string;
  flow: string;
  company: string;
};

/* ------------------------------- shared UI ------------------------------- */
const FRAME_STYLE: React.CSSProperties = {
  background: 'rgba(13,15,17,0.95)',
  border: '2px dashed rgba(106,247,209,0.30)',
  boxShadow: '0 0 40px rgba(0,0,0,0.7)',
  borderRadius: 30,
};
const HEADER_BORDER = { borderBottom: '1px solid rgba(255,255,255,0.4)' };
const CARD_STYLE: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.30)',
  borderRadius: 20,
};

/* === Same green as Step 2 === */
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

/* === Shorter preview heights === */
const PREVIEW_LANG_H = 'h-[110px]';
const PREVIEW_STD_H = 'h-[160px]';

export default function Step3PromptEditor({ onNext, onBack }: Props) {
  const [kind, setKind] = useState<AIKind>('sales');
  const [industry, setIndustry] = useState<string>('');
  const [language, setLanguage] = useState<string>('');
  const [defs, setDefs] = useState<Section[]>([]);
  const [values, setValues] = useState<string[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);

  // Import Website (multi-URL)
  const [importOpen, setImportOpen] = useState(false);
  const [urls, setUrls] = useState<string[]>(['']);

  const companyIdx = useMemo(() => defs.findIndex((d) => d.key === 'company'), [defs]);

  function buildSections(kind: AIKind, rawIndustry: string, rawLanguage: string): Section[] {
    const IN = st(rawIndustry, 'your industry');
    const LANG = st(rawLanguage, 'English');

    const LANG_TEXT =
      `The AI should speak ${LANG}. The prompt should be written in ${LANG}. ` +
      `AI should speak informal and friendly tone. Like 2 friends texting on SMS. ` +
      `Grade 3 according to the Hemingway app.`;

    const SALES_FLOW = `ALWAYS answer any questions and objections first. Start with a brief, friendly greeting, then ask this as your first question:

1. What’s the main challenge you’re trying to solve right now in your ${IN}?
   Then, it should ask each of these questions 1 by 1 to go through the rest of the conversation flow:
3. What’s your budget range for getting this solved?
4. Who else, if anyone, will be involved in the decision-making process?
5. Would mornings or afternoons usually work best for a quick phone call?`;

    const SUPPORT_DESC =
      `Create an AI that works as a support agent for a company in ${IN}. ` +
      `Be friendly, engaging, and empathetic while resolving issues and providing accurate information.`;

    const SUPPORT_RULES = `1. Handle questions with empathy and understanding.
2. Don’t just repeat the customer's question.
3. Use exclamation points sparingly.
4. Emojis are okay occasionally 🙂 if it feels natural for ${IN}.`;

    const SUPPORT_FLOW =
      `Answer the user’s question completely. If they have objections, address them calmly and clearly.
Then ask: “Is there anything else I can help you with today?” If the issue requires escalation, explain the next step in ${IN}.`;

    const SALES_SECTIONS: Section[] = [
      { key: 'language', title: 'Language Instructions Preview', subtitle: 'Template-generated language instructions for your AI', icon: <BrainCircuit className="w-4 h-4 text-[#6af7d1]" />, defaultText: LANG_TEXT, wide: true },
      { key: 'description', title: 'AI Description', subtitle: 'Define what your AI should do and how it should behave', icon: <FileText className="w-4 h-4 text-[#6af7d1]" />, defaultText: `You are a receptionist / lead-qualifying AI for a company in ${IN}.
Be friendly, concise, and helpful. Qualify inquiries, answer questions, and offer to schedule a call/meeting.` },
      { key: 'rules', title: 'Rules & Guidelines', subtitle: 'Set important rules and constraints for your AI’s behavior', icon: <Settings className="w-4 h-4 text-[#6af7d1]" />, defaultText: `1) Ask one question at a time.
2) Don’t promise exact quotes; set expectations appropriate to ${IN}.
3) Keep messages under 2–3 short sentences.
4) After a brief greeting, immediately ask the first qualifying question.
5) If policy/compliance topics appear, advise checking relevant regulations for ${IN}.` },
      { key: 'flow', title: 'Conversation Flow (first message + sequence)', subtitle: 'Exact flow you want followed', icon: <MessageSquareText className="w-4 h-4 text-[#6af7d1]" />, defaultText: SALES_FLOW },
      { key: 'company', title: 'Company Information', subtitle: 'Docs, FAQs, policies, links', icon: <Landmark className="w-4 h-4 text-[#6af7d1]" />, defaultText: '' },
    ];

    const SUPPORT_SECTIONS: Section[] = [
      { key: 'language', title: 'Language Instructions Preview', subtitle: 'Template-generated language instructions for your AI', icon: <BrainCircuit className="w-4 h-4 text-[#6af7d1]" />, defaultText: LANG_TEXT, wide: true },
      { key: 'description', title: 'AI Description', subtitle: 'Define what your AI should do and how it should behave', icon: <FileText className="w-4 h-4 text-[#6af7d1]" />, defaultText: SUPPORT_DESC },
      { key: 'rules', title: 'Rules & Guidelines', subtitle: 'Set important rules and constraints for your AI’s behavior', icon: <Settings className="w-4 h-4 text-[#6af7d1]" />, defaultText: SUPPORT_RULES },
      { key: 'flow', title: 'Conversation Flow (first message + sequence)', subtitle: 'Exact flow you want followed', icon: <MessageSquareText className="w-4 h-4 text-[#6af7d1]" />, defaultText: SUPPORT_FLOW },
      { key: 'company', title: 'Company Information', subtitle: 'Docs, FAQs, policies, links', icon: <Landmark className="w-4 h-4 text-[#6af7d1]" />, defaultText: '' },
    ];

    if (kind === 'support') return SUPPORT_SECTIONS;
    if (kind === 'blank') {
      return [
        { key: 'language', title: 'Language Instructions Preview', subtitle: 'Write your own tone & style from scratch', icon: <BrainCircuit className="w-4 h-4 text-[#6af7d1]" />, defaultText: LANG_TEXT, wide: true },
        { key: 'description', title: 'AI Description', subtitle: 'Tell the AI what it should do', icon: <FileText className="w-4 h-4 text-[#6af7d1]" />, defaultText: '' },
        { key: 'rules', title: 'Rules & Guidelines', subtitle: 'Add any hard rules or boundaries', icon: <Settings className="w-4 h-4 text-[#6af7d1]" />, defaultText: '' },
        { key: 'flow', title: 'Conversation Flow (first message + sequence)', subtitle: 'Write the step-by-step flow', icon: <MessageSquareText className="w-4 h-4 text-[#6af7d1]" />, defaultText: '' },
        { key: 'company', title: 'Company Information', subtitle: 'Docs, FAQs, policies, links', icon: <Landmark className="w-4 h-4 text-[#6af7d1]" />, defaultText: '' },
      ];
    }
    return SALES_SECTIONS;
  }

  /* ----------------------------- load & hydrate ---------------------------- */
  useEffect(() => {
    const s1 = jget<any>('builder:step1', {});
    const detected: string = s1?.type ?? s1?.botType ?? s1?.mode ?? s1?.aiType ?? s1?.selectedType ?? 'sales';
    const t: AIKind = (['sales', 'support', 'blank'].includes(detected) ? detected : 'sales') as AIKind;

    const ind = st(s1?.industry);
    const lang = st(s1?.language);

    setKind(t);
    setIndustry(ind);
    setLanguage(lang);

    const sdefs = buildSections(t, ind, lang);
    setDefs(sdefs);

    const saved = jget<SavedStep3 | null>('builder:step3', null);

    if (!saved || saved.boundIndustry !== ind || saved.boundLanguage !== lang) {
      setValues(sdefs.map((s) => s.defaultText));
      const payload: SavedStep3 = {
        kind: t,
        industry: ind,
        language: lang,
        boundIndustry: ind,
        boundLanguage: lang,
        languageText: sdefs[0].defaultText,
        description: sdefs[1].defaultText,
        rules: sdefs[2].defaultText,
        flow: sdefs[3].defaultText,
        company: sdefs[4].defaultText,
      };
      localStorage.setItem('builder:step3', JSON.stringify(payload));
    } else {
      setValues([
        saved.languageText ?? sdefs[0].defaultText,
        saved.description ?? sdefs[1].defaultText,
        saved.rules ?? sdefs[2].defaultText,
        saved.flow ?? sdefs[3].defaultText,
        saved.company ?? sdefs[4].defaultText,
      ]);
    }
  }, []);

  const setValue = (i: number, v: string) =>
    setValues((prev) => {
      const n = [...prev];
      n[i] = v;
      return n;
    });

  const persistNow = () => {
    const idx = (k: SectionKey) => defs.findIndex((d) => d.key === k);
    const payload: SavedStep3 = {
      kind,
      industry,
      language,
      boundIndustry: industry,
      boundLanguage: language,
      languageText: values[idx('language')] ?? '',
      description: values[idx('description')] ?? '',
      rules: values[idx('rules')] ?? '',
      flow: values[idx('flow')] ?? '',
      company: values[idx('company')] ?? '',
    };
    try {
      localStorage.setItem('builder:step3', JSON.stringify(payload));
    } catch {}
  };

  const handleNext = () => {
    persistNow();
    onNext?.();
  };

  const totalChars = useMemo(
    () => values.reduce((n, v) => n + (v ? v.length : 0), 0),
    [values]
  );

  /* ------------------------- Import Websites (multi) ------------------------ */
  const validUrls = useMemo(() => urls.map((u) => st(u)).filter(Boolean), [urls]);

  async function importWebsites() {
    if (!validUrls.length) return;

    try {
      const out: string[] = [];
      for (let i = 0; i < validUrls.length; i++) {
        const url = validUrls[i];
        const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('Bad response');
        const body = await res.text();
        out.push(`Website ${i + 1} (${url}):\n${body}`);
      }
      const compiled = out.join('\n\n');
      const existing = values[companyIdx] || '';
      setValue(companyIdx, [existing, compiled].filter(Boolean).join('\n\n'));
      setImportOpen(false);
      setUrls(['']);
      setTimeout(persistNow, 0);
    } catch {
      alert('Fetch blocked or site returned an error. Paste text manually.');
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#0b0c10] text-white font-movatif">
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 pt-10 pb-24">
        <StepProgress current={3} />

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Personality & Knowledge{industry ? ` — ${industry}` : ''}
            </h2>
            <div className="text-white/70 mt-1 text-sm">Define your AI’s behavior, rules, and knowledge base</div>
          </div>
          <div className="text-sm text-white/60 hidden md:block">Step 3 of 4</div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {defs.map((d, i) => {
            const isCompany = d.key === 'company';

            return (
              <div
                key={d.key}
                className={`${d.wide ? 'md:col-span-2' : ''} relative rounded-3xl p-6`}
                style={{
                  background: 'rgba(13,15,17,0.92)',
                  border: '1px solid rgba(106,247,209,0.18)',
                  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 18px rgba(106,247,209,0.05)',
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(38px)' }}
                />

                {/* Edit button */}
                <button
                  onClick={() => setEditIdx(i)}
                  className="absolute top-3.5 right-3.5 text-xs px-3 py-1.5 rounded-2xl border inline-flex items-center gap-1.5"
                  style={{
                    background: 'rgba(16,19,20,0.88)',
                    border: '1px solid rgba(255,255,255,0.16)',
                    boxShadow: '0 0 12px rgba(0,0,0,0.25)',
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5 text-white/80" />
                  <span className="text-white/90">Edit</span>
                </button>

                <h3 className="text-[13px] font-semibold mb-1.5 flex items-center gap-2">
                  {d.icon}
                  <span className="text-white/90">{d.title}</span>
                  {d.key !== 'language' && <span className="text-red-400">*</span>}
                </h3>
                <p className="text-[12px] text-white/55 mb-2">{d.subtitle}</p>

                {/* Company actions — no preview box here; compact buttons */}
                {isCompany ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => setEditIdx(i)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm"
                      style={{
                        ...CARD_STYLE,
                        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.38)',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(0,255,194,0.55)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(255,255,255,0.30)';
                      }}
                    >
                      <Sparkles className="w-4 h-4" />
                      Add Company Information
                    </button>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={() => setImportOpen(true)}
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm"
                        style={{
                          ...CARD_STYLE,
                          boxShadow: 'inset 0 0 12px rgba(0,0,0,0.38)',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(0,255,194,0.55)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(255,255,255,0.30)';
                        }}
                      >
                        <Globe className="w-4 h-4" />
                        Import Website
                      </button>

                      <button
                        disabled
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm opacity-50 cursor-not-allowed"
                        style={{
                          ...CARD_STYLE,
                          boxShadow: 'inset 0 0 12px rgba(0,0,0,0.38)',
                        }}
                      >
                        <CircleHelp className="w-4 h-4" />
                        Generate FAQ
                      </button>
                    </div>
                  </div>
                ) : (
                  // Preview boxes shortened
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditIdx(i)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setEditIdx(i)}
                    className={`text-sm ${
                      d.key === 'language' ? PREVIEW_LANG_H : PREVIEW_STD_H
                    } overflow-y-auto whitespace-pre-wrap rounded-2xl px-4 py-3 cursor-pointer`}
                    style={{
                      background: CARD_STYLE.background as string,
                      border: CARD_STYLE.border as string,
                      boxShadow: 'inset 0 0 12px rgba(0,0,0,0.38)',
                      color: '#ffffff',
                    }}
                  >
                    {values[i] || <span className="text-white/40 italic">(Not set yet)</span>}
                  </div>
                )}

                {/* Modal editor */}
                {editIdx === i && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="relative w-full max-w-[980px] max-h-[88vh] flex flex-col text-white font-movatif" style={FRAME_STYLE}>
                      {/* Header */}
                      <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={HEADER_BORDER}>
                        <div className="min-w-0">
                          <h4 className="text-white text-lg font-semibold truncate">{d.title}</h4>
                          <div className="text-white/80 text-xs truncate">{d.subtitle}</div>
                        </div>
                        <button onClick={() => setEditIdx(null)} className="p-2 rounded-full hover:bg-white/10" aria-label="Close">
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>

                      {/* Body */}
                      <div className="flex-1 overflow-y-auto p-6">
                        <div style={CARD_STYLE} className="p-5">
                          <textarea
                            value={values[i]}
                            onChange={(e) => setValue(i, e.target.value)}
                            className="w-full h-[26rem] bg-transparent outline-none resize-none text-sm leading-6 placeholder-white/40"
                            placeholder="Start typing…"
                            style={{ color: '#ffffff' }}
                          />
                          <div className="mt-3 text-xs text-white/70 flex items-center justify-between">
                            <span>Character count: {(values[i] || '').length.toLocaleString()}</span>
                            <span>Total: {totalChars.toLocaleString()} / 32,000</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop: '1px solid rgba(255,255,255,0.3)', background: '#101314' }}>
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              setEditIdx(null);
                              persistNow();
                            }}
                            className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition-colors duration-150"
                            style={{
                              background: BTN_GREEN,
                              color: '#ffffff',
                              boxShadow: '0 1px 0 rgba(0,0,0,0.18)',
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Import Websites modal */}
        {importOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
            <div
              className="w-full max-w-3xl rounded-3xl p-6 font-movatif"
              style={{
                background: 'linear-gradient(180deg, rgba(22,24,27,0.98) 0%, rgba(14,16,18,0.98) 100%)',
                border: '1px solid rgba(0,255,194,0.25)',
                boxShadow: '0 0 24px rgba(0,255,194,0.10), inset 0 0 18px rgba(0,0,0,0.40)',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-lg font-semibold">Import Website Content</h4>
                  <p className="text-sm text-white/70 mt-1">Import content from up to 10 websites to enrich your AI’s knowledge base</p>
                </div>
                <button className="p-1 rounded-2xl border border-white/15" onClick={() => setImportOpen(false)}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* URLs label + counter */}
              <div className="flex items-center justify-between mt-6 mb-2">
                <label className="text-sm text-white/80">Website URLs</label>
                <div className="text-xs text-white/50">{Math.max(1, urls.length)} / 10 URLs</div>
              </div>

              {/* First URL input */}
              <input
                value={urls[0] ?? ''}
                onChange={(e) => {
                  const arr = [...urls];
                  arr[0] = e.target.value;
                  setUrls(arr);
                }}
                placeholder="https://example.com"
                className="w-full rounded-2xl bg-[#0b0e0f] text-white border border-white/15 px-3 py-3 outline-none text-sm"
              />

              {/* Additional URL inputs */}
              {urls.slice(1).map((u, i) => (
                <input
                  key={i + 1}
                  value={u}
                  onChange={(e) => {
                    const arr = [...urls];
                    arr[i + 1] = e.target.value;
                    setUrls(arr);
                  }}
                  placeholder="https://another-site.com"
                  className="w-full rounded-2xl bg-[#0b0e0f] text-white border border-white/15 px-3 py-3 outline-none mt-3 text-sm"
                />
              ))}

              {/* Add another URL row */}
              {urls.length < 10 && (
                <button
                  onClick={() => setUrls((p) => [...p, ''])}
                  className="w-full mt-3 rounded-2xl px-3 py-3 text-sm flex items-center justify-center gap-2 border border-dashed"
                  style={{ borderColor: 'rgba(255,255,255,0.20)', background: 'rgba(255,255,255,0.04)' }}
                >
                  <Plus className="w-4 h-4" /> Add Another URL
                </button>
              )}

              <p className="text-sm text-white/60 mt-4">
                All website content will be combined and appended to your existing company information
              </p>

              {/* Footer buttons */}
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setImportOpen(false)} className="px-5 py-2 text-sm rounded-2xl border border-white/15">
                  Cancel
                </button>

                <button
                  onClick={importWebsites}
                  disabled={!validUrls.length}
                  className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition-colors duration-150 disabled:cursor-not-allowed"
                  style={{
                    background: validUrls.length ? BTN_GREEN : BTN_DISABLED,
                    color: '#ffffff',
                    boxShadow: validUrls.length ? '0 1px 0 rgba(0,0,0,0.18)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!validUrls.length) return;
                    (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
                  }}
                  onMouseLeave={(e) => {
                    if (!validUrls.length) return;
                    (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
                  }}
                >
                  <Globe className="w-4 h-4" /> Import Content
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer buttons (Step 2 style) */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          <button
            onClick={handleNext}
            className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition-colors duration-150"
            style={{
              background: BTN_GREEN,
              color: '#ffffff',
              boxShadow: '0 1px 0 rgba(0,0,0,0.18)',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
