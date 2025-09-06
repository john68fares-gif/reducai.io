// components/builder/Step3PromptEditor.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import StepProgress from './StepProgress';
import {
  FileText, Settings, MessageSquareText, Landmark, BrainCircuit,
  ArrowLeft, X, Globe, Plus, Edit3, Sparkles, CircleHelp,
} from 'lucide-react';
import { st } from '@/utils/safe';
import { scopedStorage } from '@/utils/scoped-storage';

/* ───────────────────────── Types ───────────────────────── */

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

/* ─────────────────────── Visual constants (match Step 1) ─────────────────────── */

const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';
const BTN_DISABLED = 'color-mix(in oklab, var(--text) 14%, transparent)';

const FRAME_STYLE: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: 28,
};

const HEADER_BORDER = { borderBottom: '1px solid var(--border)' };

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
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

const PREVIEW_LANG_H = 'h-[110px]';
const PREVIEW_STD_H = 'h-[160px]';

/* ───────────────────────── Helpers ───────────────────────── */

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
    { key: 'language', title: 'Language Instructions Preview', subtitle: 'Template-generated language instructions for your AI', icon: <BrainCircuit className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: LANG_TEXT, wide: true },
    { key: 'description', title: 'AI Description', subtitle: 'Define what your AI should do and how it should behave', icon: <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: `You are a receptionist / lead-qualifying AI for a company in ${IN}.
Be friendly, concise, and helpful. Qualify inquiries, answer questions, and offer to schedule a call/meeting.` },
    { key: 'rules', title: 'Rules & Guidelines', subtitle: 'Set important rules and constraints for your AI’s behavior', icon: <Settings className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: `1) Ask one question at a time.
2) Don’t promise exact quotes; set expectations appropriate to ${IN}.
3) Keep messages under 2–3 short sentences.
4) After a brief greeting, immediately ask the first qualifying question.
5) If policy/compliance topics appear, advise checking relevant regulations for ${IN}.` },
    { key: 'flow', title: 'Conversation Flow (first message + sequence)', subtitle: 'Exact flow you want followed', icon: <MessageSquareText className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: SALES_FLOW },
    { key: 'company', title: 'Company Information', subtitle: 'Docs, FAQs, policies, links', icon: <Landmark className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: '' },
  ];

  const SUPPORT_SECTIONS: Section[] = [
    { key: 'language', title: 'Language Instructions Preview', subtitle: 'Template-generated language instructions for your AI', icon: <BrainCircuit className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: LANG_TEXT, wide: true },
    { key: 'description', title: 'AI Description', subtitle: 'Define what your AI should do and how it should behave', icon: <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: SUPPORT_DESC },
    { key: 'rules', title: 'Rules & Guidelines', subtitle: 'Set important rules and constraints for your AI’s behavior', icon: <Settings className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: SUPPORT_RULES },
    { key: 'flow', title: 'Conversation Flow (first message + sequence)', subtitle: 'Write the step-by-step flow', icon: <MessageSquareText className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: SUPPORT_FLOW },
    { key: 'company', title: 'Company Information', subtitle: 'Docs, FAQs, policies, links', icon: <Landmark className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: '' },
  ];

  if (kind === 'support') return SUPPORT_SECTIONS;
  if (kind === 'blank') {
    return [
      { key: 'language', title: 'Language Instructions Preview', subtitle: 'Write your own tone & style from scratch', icon: <BrainCircuit className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: LANG_TEXT, wide: true },
      { key: 'description', title: 'AI Description', subtitle: 'Tell the AI what it should do', icon: <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: '' },
      { key: 'rules', title: 'Rules & Guidelines', subtitle: 'Add any hard rules or boundaries', icon: <Settings className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: '' },
      { key: 'flow', title: 'Conversation Flow (first message + sequence)', subtitle: 'Write the step-by-step flow', icon: <MessageSquareText className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: '' },
      { key: 'company', title: 'Company Information', subtitle: 'Docs, FAQs, policies, links', icon: <Landmark className="w-4 h-4" style={{ color: 'var(--brand)' }} />, defaultText: '' },
    ];
  }
  return SALES_SECTIONS;
}

function assembleCompiledPrompt(p: SavedStep3) {
  return [
    `AI TYPE: ${p.kind.toUpperCase()}`,
    `INDUSTRY: ${p.industry || '—'}`,
    `LANGUAGE: ${p.language || 'English'}`,
    '',
    'DESCRIPTION:',
    p.description || '',
    '',
    'RULES AND GUIDELINES:',
    p.rules || '',
    '',
    'QUESTION FLOW:',
    p.flow || '',
    '',
    'COMPANY FAQ:',
    p.company || '',
    '',
    'LANGUAGE INSTRUCTIONS:',
    p.languageText || '',
  ].join('\n');
}

/** Convert any HTML-ish response to plain text (client fallback) */
function stripHtml(htmlOrText: string) {
  if (!htmlOrText) return '';
  const div = document.createElement('div');
  div.innerHTML = htmlOrText;
  const text = (div.textContent || div.innerText || '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  div.remove();
  return text.trim();
}

/* ───────────────────────── Component ───────────────────────── */

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

  const [loading, setLoading] = useState(true);

  const companyIdx = useMemo(() => defs.findIndex((d) => d.key === 'company'), [defs]);
  const validUrls = useMemo(() => urls.map((u) => st(u)).filter(Boolean), [urls]);

  /* Load from Step 1 + restore Step 3 */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const s1Raw = typeof window !== 'undefined' ? localStorage.getItem('builder:step1') : null;
        const s1 = s1Raw ? JSON.parse(s1Raw) : {};
        const detected: string = s1?.type ?? s1?.botType ?? s1?.mode ?? s1?.aiType ?? s1?.selectedType ?? 'sales';
        const t: AIKind = (['sales', 'support', 'blank'].includes(detected) ? detected : 'sales') as AIKind;

        const ind = st(s1?.industry);
        const lang = st(s1?.language);

        if (!mounted) return;
        setKind(t);
        setIndustry(ind);
        setLanguage(lang);

        const newDefs = buildSections(t, ind, lang);
        setDefs(newDefs);

        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();

        const savedScoped = await ss.getJSON<SavedStep3 | null>('builder:step3', null);
        const savedLocal =
          !savedScoped && typeof window !== 'undefined'
            ? (JSON.parse(localStorage.getItem('builder:step3') || 'null') as SavedStep3 | null)
            : null;

        const saved = savedScoped || savedLocal;

        if (!saved || saved.boundIndustry !== ind || saved.boundLanguage !== lang) {
          const nextVals = newDefs.map((s) => s.defaultText);
          if (!mounted) return;
          setValues(nextVals);

          const payload: SavedStep3 = {
            kind: t,
            industry: ind,
            language: lang,
            boundIndustry: ind,
            boundLanguage: lang,
            languageText: nextVals[0] ?? '',
            description: nextVals[1] ?? '',
            rules: nextVals[2] ?? '',
            flow: nextVals[3] ?? '',
            company: nextVals[4] ?? '',
          };

          await ss.setJSON('builder:step3', payload);
          if (typeof window !== 'undefined') localStorage.setItem('builder:step3', JSON.stringify(payload));

          const compiled = assembleCompiledPrompt(payload);
          await ss.setJSON('builder:compiledPrompt', compiled);
          if (typeof window !== 'undefined') localStorage.setItem('builder:compiledPrompt', JSON.stringify(compiled));
        } else {
          const nextVals = [
            saved.languageText ?? newDefs[0].defaultText,
            saved.description ?? newDefs[1].defaultText,
            saved.rules ?? newDefs[2].defaultText,
            saved.flow ?? newDefs[3].defaultText,
            saved.company ?? newDefs[4].defaultText,
          ];
          if (!mounted) return;
          setValues(nextVals);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setValue = (i: number, v: string) =>
    setValues((prev) => {
      const n = [...prev];
      n[i] = v;
      return n;
    });

  async function persistNow() {
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

    const ss = await scopedStorage();
    await ss.ensureOwnerGuard();
    await ss.setJSON('builder:step3', payload);
    if (typeof window !== 'undefined') localStorage.setItem('builder:step3', JSON.stringify(payload));

    const compiled = assembleCompiledPrompt(payload);
    await ss.setJSON('builder:compiledPrompt', compiled);
    if (typeof window !== 'undefined') localStorage.setItem('builder:compiledPrompt', JSON.stringify(compiled));
  }

  /* Import Websites (plain-text, safe caps) */
  async function importWebsites() {
    if (!validUrls.length || companyIdx < 0) return;

    const PER_SITE_CAP = 12_000;   // ~12k chars per site
    const TOTAL_CAP    = 32_000;   // cap added this import
    const FIELD_CAP    = 64_000;   // max size of Company field

    try {
      const chunks: string[] = [];

      for (let i = 0; i < validUrls.length; i++) {
        const url = validUrls[i];
        const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);

        // Handle JSON { text } or raw text
        let raw = '';
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const j = await res.json();
          raw = typeof j?.text === 'string' ? j.text : JSON.stringify(j);
        } else {
          raw = await res.text();
        }

        // Ensure plain text and cap
        let clean = stripHtml(raw);
        if (clean.length > PER_SITE_CAP) clean = clean.slice(0, PER_SITE_CAP) + '\n[…truncated]';
        if (!clean) continue;

        chunks.push(`From ${url}:\n${clean}`);
      }

      // Overall cap for this import
      let compiled = chunks.join('\n\n').trim();
      if (compiled.length > TOTAL_CAP) compiled = compiled.slice(0, TOTAL_CAP) + '\n[…overall import truncated]';

      const existing = values[companyIdx] || '';
      let nextCompany = [existing, compiled].filter(Boolean).join('\n\n').trim();
      if (nextCompany.length > FIELD_CAP) nextCompany = nextCompany.slice(0, FIELD_CAP) + '\n[…field truncated]';

      setValue(companyIdx, nextCompany);
      setImportOpen(false);
      setUrls(['']);
      setTimeout(() => void persistNow(), 0);
    } catch {
      alert('Import failed (CORS/blocked). Paste text manually.');
    }
  }

  const totalChars = useMemo(() => values.reduce((n, v) => n + (v ? v.length : 0), 0), [values]);

  const handleNext = async () => {
    await persistNow();
    onNext?.();
  };

  /* ───────────────────────── UI ───────────────────────── */

  return (
    <div className="min-h-screen w-full font-movatif" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 pt-10 pb-24">
        <StepProgress current={3} />

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Personality & Knowledge{industry ? ` — ${industry}` : ''}
            </h2>
            <div className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Define your AI’s behavior, rules, and knowledge base
            </div>
          </div>
          {!loading && (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Step 3 of 4
            </div>
          )}
        </div>

        {/* Frame matches Step 1: panel + orb + subtle grid */}
        <section className="relative p-6 md:p-7" style={FRAME_STYLE}>
          <Orb /><SubtleGrid />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(loading ? Array.from({ length: 4 }) : defs).map((d, i) => {
              if (loading) {
                return (
                  <div key={i} className="rounded-3xl p-6" style={CARD_STYLE}>
                    <div className="h-4 w-40 rounded mb-3" style={{ background: 'color-mix(in oklab, var(--text) 10%, transparent)' }} />
                    <div className="h-24 md:h-40 rounded-2xl" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }} />
                  </div>
                );
              }

              const isCompany = d.key === 'company';

              return (
                <div key={d.key} className={`${d.wide ? 'md:col-span-2' : ''} relative`} style={CARD_STYLE}>
                  {/* header */}
                  <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold flex items-center gap-2">
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
                        >
                          <Sparkles className="w-4 h-4" />
                          Add Company Information
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            onClick={() => setImportOpen(true)}
                            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm"
                            style={CARD_STYLE}
                          >
                            <Globe className="w-4 h-4" />
                            Import Website
                          </button>

                          <button
                            disabled
                            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm opacity-60 cursor-not-allowed"
                            style={CARD_STYLE}
                            title="Coming soon"
                          >
                            <CircleHelp className="w-4 h-4" />
                            Generate FAQ
                          </button>
                        </div>

                        {/* tiny preview */}
                        <div
                          className="text-sm max-h-[140px] overflow-y-auto whitespace-pre-wrap rounded-2xl px-3 py-2 mt-2"
                          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
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
                        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                      >
                        {values[i] || <span style={{ color: 'var(--text-muted)' }}>(Not set yet)</span>}
                      </div>
                    )}
                  </div>

                  {/* Modal editor */}
                  {editIdx === i && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.50)' }}>
                      <div className="relative w-full max-w-[980px] max-h-[88vh] flex flex-col" style={FRAME_STYLE}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={HEADER_BORDER}>
                          <div className="min-w-0">
                            <h4 className="text-lg font-semibold truncate">{d.title}</h4>
                            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{d.subtitle}</div>
                          </div>
                          <button onClick={() => setEditIdx(null)} className="p-2 rounded-full hover:opacity-75" aria-label="Close" title="Close">
                            <X className="w-5 h-5" />
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
                              <span>Character count: {(values[i] || '').length.toLocaleString()}</span>
                              <span>Total: {totalChars.toLocaleString()} / 32,000</span>
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop: '1px solid var(--border)', background: 'var(--card)' }}>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditIdx(null)}
                              className="px-5 py-2 rounded-[14px]"
                              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={async () => {
                                setEditIdx(null);
                                await persistNow();
                              }}
                              className="px-6 py-2 rounded-[18px] font-semibold"
                              style={{ background: BTN_GREEN, color: '#fff', boxShadow: '0 10px 24px rgba(16,185,129,.25)' }}
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
        </section>

        {/* Import Websites modal */}
        {importOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
            <div className="w-full max-w-3xl rounded-3xl p-6 font-movatif relative" style={FRAME_STYLE}>
              <Orb /><SubtleGrid />
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-lg font-semibold">Import Website Content</h4>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Import content from up to 10 websites to enrich your AI’s knowledge base
                  </p>
                </div>
                <button className="p-1 rounded-2xl border" style={{ borderColor: 'var(--border)' }} onClick={() => setImportOpen(false)}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* URLs */}
              <div className="flex items-center justify-between mt-6 mb-2">
                <label className="text-sm">Website URLs</label>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{Math.max(1, urls.length)} / 10 URLs</div>
              </div>

              <input
                value={urls[0] ?? ''}
                onChange={(e) => {
                  const arr = [...urls];
                  arr[0] = e.target.value;
                  setUrls(arr);
                }}
                placeholder="https://example.com"
                className="w-full rounded-2xl px-3 py-3 outline-none text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              />

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
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                />
              ))}

              {urls.length < 10 && (
                <button
                  onClick={() => setUrls((p) => [...p, ''])}
                  className="w-full mt-3 rounded-2xl px-3 py-3 text-sm flex items-center justify-center gap-2 border border-dashed"
                  style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
                >
                  <Plus className="w-4 h-4" /> Add Another URL
                </button>
              )}

              <p className="text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
                Content is auto-cleaned to plain text and size-capped to keep the page stable.
              </p>

              {/* Footer */}
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setImportOpen(false)}
                  className="px-5 py-2 text-sm rounded-2xl"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>

                <button
                  onClick={importWebsites}
                  disabled={!validUrls.length}
                  className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[18px] font-semibold select-none disabled:cursor-not-allowed"
                  style={{
                    background: validUrls.length ? BTN_GREEN : BTN_DISABLED,
                    color: '#ffffff',
                    boxShadow: validUrls.length ? '0 10px 24px rgba(16,185,129,.25)' : 'none',
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

        {/* Footer buttons */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[18px] px-4 py-2 text-sm transition"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          <button
            onClick={handleNext}
            className="inline-flex items-center gap-2 px-8 h-[42px] rounded-[18px] font-semibold select-none"
            style={{ background: BTN_GREEN, color: '#ffffff', boxShadow: '0 10px 24px rgba(16,185,129,.25)' }}
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
