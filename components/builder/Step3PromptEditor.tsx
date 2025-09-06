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
  CircleHelp,
} from 'lucide-react';
import { st } from '@/utils/safe';

/* ----------------------------- tiny local utils ----------------------------- */
function jget<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function jset<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/* ---------------------------------- types ---------------------------------- */
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

/* ------------------------------- look & feel ------------------------------- */
/** Match API Keys / Phone Numbers aesthetics via CSS vars (works in light + dark) */
const FRAME_STYLE: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: 30,
};
const HEADER_BORDER = { borderBottom: '1px solid var(--border)' };
const CARD_STYLE: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
};

/** Same emerald buttons as API Keys page */
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

/* Shorter preview heights */
const PREVIEW_LANG_H = 'h-[110px]';
const PREVIEW_STD_H = 'h-[160px]';

/* ---------------------------------- page ---------------------------------- */
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

  /* ----------------------------- section builder ---------------------------- */
  function buildSections(kind: AIKind, rawIndustry: string, rawLanguage: string): Section[] {
    const IN = st(rawIndustry, 'your industry');
    const LANG = st(rawLanguage, 'English');

    const LANG_TEXT =
      `The AI should speak ${LANG}. The prompt should be written in ${LANG}. ` +
      `AI should speak in a friendly, informal tone similar to two friends texting. ` +
      `Keep reading level around Grade 3 per Hemingway.`;

    const SALES_FLOW = `ALWAYS answer any questions and objections first. Start with a brief, friendly greeting, then ask this as your first question:

1) What’s the main challenge you’re trying to solve right now in your ${IN}?
Then ask each of these one by one:
2) What’s your budget range for getting this solved?
3) Who else, if anyone, will be involved in the decision-making process?
4) Would mornings or afternoons usually work best for a quick phone call?`;

    const SUPPORT_DESC =
      `Create an AI that works as a support agent for a company in ${IN}. ` +
      `Be friendly, engaging, and empathetic while resolving issues and providing accurate information.`;

    const SUPPORT_RULES = `1) Handle questions with empathy and understanding.
2) Don’t just repeat the customer's question.
3) Use exclamation points sparingly.
4) Emojis are okay occasionally 🙂 if it feels natural for ${IN}.`;

    const SUPPORT_FLOW =
      `Answer the user’s question completely. If they have objections, address them calmly and clearly.
Then ask: “Is there anything else I can help you with today?” If the issue requires escalation, explain the next step for ${IN}.`;

    const SALES_SECTIONS: Section[] = [
      { key: 'language', title: 'Language Instructions Preview', subtitle: 'Template-generated tone & language instructions', icon: <BrainCircuit className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: LANG_TEXT, wide: true },
      { key: 'description', title: 'AI Description', subtitle: 'Define what your AI should do and how it should behave', icon: <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: `You are a receptionist / lead-qualifying AI for a company in ${IN}.
Be friendly, concise, and helpful. Qualify inquiries, answer questions, and offer to schedule a call/meeting.` },
      { key: 'rules', title: 'Rules & Guidelines', subtitle: 'Important rules and constraints', icon: <Settings className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: `1) Ask one question at a time.
2) Don’t promise exact quotes; set expectations appropriate to ${IN}.
3) Keep messages under 2–3 short sentences.
4) After a brief greeting, immediately ask the first qualifying question.
5) If policy/compliance topics appear, advise checking relevant regulations for ${IN}.` },
      { key: 'flow', title: 'Conversation Flow (first message + sequence)', subtitle: 'Exact flow to follow', icon: <MessageSquareText className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: SALES_FLOW },
      { key: 'company', title: 'Company Information', subtitle: 'Docs, FAQs, policies, links (or pasted summaries)', icon: <Landmark className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: '' },
    ];

    const SUPPORT_SECTIONS: Section[] = [
      { key: 'language', title: 'Language Instructions Preview', subtitle: 'Template-generated tone & language instructions', icon: <BrainCircuit className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: LANG_TEXT, wide: true },
      { key: 'description', title: 'AI Description', subtitle: 'Define what your AI should do and how it should behave', icon: <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: SUPPORT_DESC },
      { key: 'rules', title: 'Rules & Guidelines', subtitle: 'Important rules and constraints', icon: <Settings className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: SUPPORT_RULES },
      { key: 'flow', title: 'Conversation Flow (first message + sequence)', subtitle: 'Exact flow to follow', icon: <MessageSquareText className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: SUPPORT_FLOW },
      { key: 'company', title: 'Company Information', subtitle: 'Docs, FAQs, policies, links (or pasted summaries)', icon: <Landmark className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: '' },
    ];

    if (kind === 'support') return SUPPORT_SECTIONS;
    if (kind === 'blank') {
      return [
        { key: 'language', title: 'Language Instructions Preview', subtitle: 'Write your own tone & style from scratch', icon: <BrainCircuit className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: LANG_TEXT, wide: true },
        { key: 'description', title: 'AI Description', subtitle: 'Tell the AI what it should do', icon: <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: '' },
        { key: 'rules', title: 'Rules & Guidelines', subtitle: 'Add any hard rules or boundaries', icon: <Settings className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: '' },
        { key: 'flow', title: 'Conversation Flow (first message + sequence)', subtitle: 'Write the step-by-step flow', icon: <MessageSquareText className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: '' },
        { key: 'company', title: 'Company Information', subtitle: 'Docs, FAQs, policies, links (or pasted summaries)', icon: <Landmark className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: '' },
      ];
    }
    return SALES_SECTIONS;
  }

  /* ----------------------------- load & hydrate ---------------------------- */
  useEffect(() => {
    // step1 values (type, industry, language)
    const s1 = jget<any>('builder:step1', {});
    const detected: string = s1?.type ?? s1?.botType ?? s1?.mode ?? s1?.aiType ?? s1?.selectedType ?? 'sales';
    const kindResolved: AIKind = (['sales', 'support', 'blank'].includes(detected) ? detected : 'sales') as AIKind;

    const ind = st(s1?.industry);
    const lang = st(s1?.language);

    setKind(kindResolved);
    setIndustry(ind);
    setLanguage(lang);

    // build current sections
    const sdefs = buildSections(kindResolved, ind, lang);
    setDefs(sdefs);

    // load saved step3, but invalidate if industry/language changed
    const saved = jget<SavedStep3 | null>('builder:step3', null);
    if (!saved || saved.boundIndustry !== ind || saved.boundLanguage !== lang) {
      setValues(sdefs.map((s) => s.defaultText));
      const payload: SavedStep3 = {
        kind: kindResolved,
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
      jset('builder:step3', payload);
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
    jset('builder:step3', payload);
  };

  const handleNext = () => {
    persistNow();
    onNext?.();
  };

  const totalChars = useMemo(() => values.reduce((n, v) => n + (v ? v.length : 0), 0), [values]);

  /* ------------------------- Import Websites (multi) ------------------------ */
  const validUrls = useMemo(() => urls.map((u) => st(u)).filter(Boolean), [urls]);

  async function importWebsites() {
    if (!validUrls.length || companyIdx < 0) return;

    // per-site cap is enforced server-side; also cap overall appended text here
    const MAX_TOTAL_APPEND = 32_000;
    const HARD_FIELD_CAP = 64_000;

    try {
      const chunks: string[] = [];
      for (let i = 0; i < validUrls.length; i++) {
        const url = validUrls[i];
        const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('Bad response');
        const text = await res.text(); // already cleaned + capped to ~12k per site
        const labeled = `From ${url}:\n${text}`.trim();
        chunks.push(labeled);
      }

      let compiled = chunks.join('\n\n').trim();
      if (compiled.length > MAX_TOTAL_APPEND) {
        compiled = compiled.slice(0, MAX_TOTAL_APPEND) + '\n[…overall import truncated]';
      }

      const existing = values[companyIdx] || '';
      const nextCompany = [existing, compiled].filter(Boolean).join('\n\n').trim();

      const finalCompany =
        nextCompany.length > HARD_FIELD_CAP
          ? nextCompany.slice(0, HARD_FIELD_CAP) + '\n[…field truncated]'
          : nextCompany;

      setValue(companyIdx, finalCompany);
      setImportOpen(false);
      setUrls(['']);
      setTimeout(persistNow, 0);
    } catch {
      alert('Import failed or the site blocked the request. Paste text manually if needed.');
    }
  }

  /* ---------------------------------- UI ---------------------------------- */
  return (
    <div className="min-h-screen w-full font-movatif" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 pt-10 pb-24">
        <StepProgress current={3} />

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              Personality & Knowledge{industry ? ` — ${industry}` : ''}
            </h2>
            <div className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Define your AI’s behavior, rules, and knowledge base
            </div>
          </div>
          <div className="text-sm hidden md:block" style={{ color: 'var(--text-muted)' }}>
            Step 3 of 4
          </div>
        </div>

        {/* Frame wrapper (matches API keys vibe) */}
        <div style={FRAME_STYLE} className="p-6 md:p-7">
          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {defs.map((d, i) => {
              const isCompany = d.key === 'company';
              return (
                <div key={d.key} className={`${d.wide ? 'md:col-span-2' : ''} relative`} style={CARD_STYLE}>
                  {/* header row */}
                  <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                        {d.icon}
                        {d.title}
                        {d.key !== 'language' && <span className="text-red-500">*</span>}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {d.subtitle}
                      </div>
                    </div>
                    <button
                      onClick={() => setEditIdx(i)}
                      className="text-xs px-3 py-1.5 rounded-2xl border inline-flex items-center gap-1.5"
                      style={{
                        background: 'var(--panel)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        boxShadow: 'var(--shadow-soft)',
                      }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>

                  {/* body */}
                  <div className="px-5 py-4">
                    {isCompany ? (
                      <div className="space-y-2">
                        <button
                          onClick={() => setEditIdx(i)}
                          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm"
                          style={CARD_STYLE}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.border = '1px solid color-mix(in oklab, var(--brand) 55%, var(--border))')
                          }
                          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.border = '1px solid var(--border)')}
                        >
                          <Sparkles className="w-4 h-4" />
                          Add Company Information
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            onClick={() => setImportOpen(true)}
                            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm"
                            style={CARD_STYLE}
                            onMouseEnter={(e) =>
                              ((e.currentTarget as HTMLButtonElement).style.border = '1px solid color-mix(in oklab, var(--brand) 55%, var(--border))')
                            }
                            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.border = '1px solid var(--border)')}
                          >
                            <Globe className="w-4 h-4" />
                            Import Website
                          </button>

                          <button
                            disabled
                            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm opacity-60 cursor-not-allowed"
                            style={CARD_STYLE}
                          >
                            <CircleHelp className="w-4 h-4" />
                            Generate FAQ (soon)
                          </button>
                        </div>

                        {/* small preview of existing text */}
                        <div
                          className="text-sm max-h-[140px] overflow-y-auto whitespace-pre-wrap rounded-2xl px-3 py-2 mt-2"
                          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                        >
                          {values[i] || <span style={{ color: 'var(--text-muted)' }}>(Empty)</span>}
                        </div>
                      </div>
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setEditIdx(i)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setEditIdx(i)}
                        className={`text-sm ${d.key === 'language' ? PREVIEW_LANG_H : PREVIEW_STD_H} overflow-y-auto whitespace-pre-wrap rounded-2xl px-4 py-3 cursor-pointer`}
                        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      >
                        {values[i] || <span style={{ color: 'var(--text-muted)' }}>(Not set yet)</span>}
                      </div>
                    )}
                  </div>

                  {/* Modal editor */}
                  {editIdx === i && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
                      <div className="relative w-full max-w-[980px] max-h-[88vh] flex flex-col" style={FRAME_STYLE}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={HEADER_BORDER}>
                          <div className="min-w-0">
                            <h4 className="text-lg font-semibold truncate" style={{ color: 'var(--text)' }}>
                              {d.title}
                            </h4>
                            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {d.subtitle}
                            </div>
                          </div>
                          <button onClick={() => setEditIdx(null)} className="p-2 rounded-full hover:opacity-80" aria-label="Close">
                            <X className="w-5 h-5" style={{ color: 'var(--text)' }} />
                          </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                          <div style={CARD_STYLE} className="p-5">
                            <textarea
                              value={values[i]}
                              onChange={(e) => setValue(i, e.target.value)}
                              className="w-full h-[26rem] bg-transparent outline-none resize-none text-sm leading-6"
                              placeholder="Start typing…"
                              style={{ color: 'var(--text)' }}
                            />
                            <div className="mt-3 text-xs flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
                              <span>Characters: {(values[i] || '').length.toLocaleString()}</span>
                              <span>Total: {totalChars.toLocaleString()} / 32,000</span>
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop: '1px solid var(--border)', background: 'var(--card)' }}>
                          <div className="flex justify-end">
                            <button
                              onClick={() => {
                                setEditIdx(null);
                                persistNow();
                              }}
                              className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[18px] font-semibold select-none transition-colors duration-150"
                              style={{ background: BTN_GREEN, color: '#fff', boxShadow: '0 1px 0 rgba(0,0,0,0.18)' }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonButtonElement).style.background = BTN_GREEN)}
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
        </div>

        {/* Import Websites modal */}
        {importOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
            <div className="w-full max-w-3xl rounded-3xl p-6 font-movatif" style={FRAME_STYLE}>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                    Import Website Content
                  </h4>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Import content from up to 10 websites to enrich your AI’s knowledge base
                  </p>
                </div>
                <button className="p-1 rounded-2xl border" style={{ borderColor: 'var(--border)' }} onClick={() => setImportOpen(false)}>
                  <X className="w-4 h-4" style={{ color: 'var(--text)' }} />
                </button>
              </div>

              {/* URLs label + counter */}
              <div className="flex items-center justify-between mt-6 mb-2">
                <label className="text-sm" style={{ color: 'var(--text)' }}>
                  Website URLs
                </label>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {Math.max(1, urls.length)} / 10 URLs
                </div>
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
                className="w-full rounded-2xl px-3 py-3 outline-none text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
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
                  className="w-full rounded-2xl px-3 py-3 outline-none mt-3 text-sm"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              ))}

              {/* Add another URL row */}
              {urls.length < 10 && (
                <button
                  onClick={() => setUrls((p) => [...p, ''])}
                  className="w-full mt-3 rounded-2xl px-3 py-3 text-sm flex items-center justify-center gap-2 border border-dashed"
                  style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--text)' }}
                >
                  <Plus className="w-4 h-4" /> Add Another URL
                </button>
              )}

              <p className="text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
                All website content will be converted to clean text and appended to your existing company information.
              </p>

              {/* Footer buttons */}
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setImportOpen(false)}
                  className="px-5 py-2 text-sm rounded-2xl border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  Cancel
                </button>

                <button
                  onClick={importWebsites}
                  disabled={!validUrls.length}
                  className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[18px] font-semibold select-none transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: BTN_GREEN, color: '#fff' }}
                  onMouseEnter={(e) => validUrls.length && ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                  onMouseLeave={(e) => validUrls.length && ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
                >
                  <Globe className="w-4 h-4" /> Import Content
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer buttons (match Step 2 / API Keys buttons) */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[18px] border px-4 py-2 transition"
            style={{ borderColor: 'var(--border)', background: 'transparent', color: 'var(--text)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          <button
            onClick={handleNext}
            className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[18px] font-semibold select-none transition-colors duration-150"
            style={{ background: BTN_GREEN, color: '#ffffff', boxShadow: '0 1px 0 rgba(0,0,0,0.18)' }}
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
