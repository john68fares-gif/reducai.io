'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Check, X, Loader2 } from 'lucide-react';

/* =============================================================================
   Theme (auto light/dark via tokens used in your other steps)
============================================================================= */
const SCOPE = 'prompt-step-scope';

/* =============================================================================
   Base prompt (used when user types only “assistant”, etc.)
   — this is the default scaffold and is ALWAYS present
============================================================================= */
const BASE_PROMPT = `[Identity]  
You are an intelligent and responsive assistant designed to help users with a wide range of inquiries and tasks.  

[Style]  
- Maintain a professional and approachable demeanor.  
- Use clear and concise language, avoiding overly technical jargon.  

[Response Guidelines]  
- Keep responses short and focused on the user's immediate query.  
- Verify user-provided information before proceeding with further steps.  

[Task & Goals]  
1. Greet the user warmly and inquire about how you can assist them today.  
2. Listen carefully to the user's request or question.  
3. Provide relevant and accurate information based on the user's needs.  
<wait for user response>  
4. If a query requires further action, guide the user through step-by-step instructions.  

[Error Handling / Fallback]  
- If a user's request is unclear or you encounter difficulty understanding, ask for clarification politely.  
- If a task cannot be completed, inform the user empathetically and suggest alternative solutions or resources.`;

/* =============================================================================
   Small helper: typewriter effect into a textarea
============================================================================= */
function typeInto(
  textarea: HTMLTextAreaElement,
  next: string,
  setPrompt: (s: string) => void,
  { cps = 120 }: { cps?: number } = {}
) {
  const current = '';
  let i = 0;
  const total = next.length;
  let raf = 0;

  const step = () => {
    i = Math.min(total, i + Math.max(1, Math.round(cps / 30)));
    const slice = next.slice(0, i);
    setPrompt(slice);
    if (textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
    if (i < total) {
      raf = window.requestAnimationFrame(step);
    }
  };

  if (raf) cancelAnimationFrame(raf);
  step();
}

/* =============================================================================
   Local fallback “editor”: if you don’t wire a backend yet, this tries to
   blend the edit instruction into the scaffold without breaking structure.
   (Very simple rules so you always get *something*.)
============================================================================= */
function applyInstructionLocally(current: string, instruction: string): string {
  const ins = instruction.trim();
  if (!ins) return current;

  const add = (heading: string, content: string) =>
    current.replace(
      new RegExp(`(\\[${heading}\\][\\s\\S]*?)(?=\\n\\[|$)`),
      (_m, grp) => `${grp}\n${content.trim()}\n`
    );

  let next = current;

  // Simple intent detection
  if (/identity|purpose|you are|become|act as/i.test(ins)) {
    next = add('Identity', `- ${ins}`);
  } else if (/style|tone|voice|formal|friendly|concise|empath/i.test(ins)) {
    next = add('Style', `- ${ins}`);
  } else if (/guideline|response|format|keep|verify|confirm/i.test(ins)) {
    next = add('Response Guidelines', `- ${ins}`);
  } else if (/ask|collect|flow|steps|goal|greet|question/i.test(ins)) {
    // put under Task & Goals
    // transform sentences to bullets or numbered hints
    const lines = ins
      .split(/[.;]\s*/g)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `- ${l}`)
      .join('\n');
    next = add('Task & Goals', lines);
  } else if (/error|fallback|if.*cannot|unclear|apolog/i.test(ins)) {
    next = add('Error Handling / Fallback', `- ${ins}`);
  } else {
    // Unknown → append as a note under Response Guidelines
    next = add('Response Guidelines', `- ${ins}`);
  }

  return next;
}

/* =============================================================================
   Component
============================================================================= */
export default function StepV3Prompt({
  onNext,
  onBack,
  editEndpoint = '/api/prompt/edit', // optional: your server endpoint (POST)
}: {
  onNext?: () => void;
  onBack?: () => void;
  /** POST {prompt, instruction} -> {prompt: string}  */
  editEndpoint?: string;
}) {
  const [prompt, setPrompt] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('voicebuilder:step3:prompt');
      return saved ? JSON.parse(saved) : BASE_PROMPT;
    } catch {
      return BASE_PROMPT;
    }
  });

  const [editOpen, setEditOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem('voicebuilder:step3:prompt', JSON.stringify(prompt));
    } catch {}
  }, [prompt]);

  async function submitEdit() {
    const instr = instruction.trim();
    if (!instr) {
      setEditOpen(false);
      return;
    }
    setBusy(true);

    // Try backend first
    try {
      const res = await fetch(editEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, instruction: instr }),
      });

      if (res.ok) {
        const data = await res.json();
        const next = (data?.prompt || '').trim();
        if (next) {
          // typing animation
          if (taRef.current) {
            typeInto(taRef.current, next, setPrompt, { cps: 180 });
          } else {
            setPrompt(next);
          }
          setInstruction('');
          setEditOpen(false);
          setBusy(false);
          return;
        }
      }
    } catch {
      // fall through to local
    }

    // Local fallback merge
    const next = applyInstructionLocally(prompt, instr);
    if (taRef.current) {
      typeInto(taRef.current, next, setPrompt, { cps: 180 });
    } else {
      setPrompt(next);
    }
    setInstruction('');
    setEditOpen(false);
    setBusy(false);
  }

  return (
    <section className={`${SCOPE} font-movatif`}>
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--text)' }}>
            System Prompt
          </h2>

          {/* Edit Prompt chip (like screenshot) */}
          <div
            className="relative"
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-soft)',
              borderRadius: 14,
              padding: 10,
              minWidth: 320,
            }}
          >
            <div className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
              Edit Prompt
            </div>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Describe how you'd like to edit the prompt"
              className="w-full text-sm rounded-[10px] px-3 py-2 outline-none"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />

            <div className="mt-2 flex items-center gap-2 justify-end">
              <button
                disabled={busy}
                onClick={() => {
                  setInstruction('');
                }}
                className="px-3 py-2 rounded-[10px] text-sm"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={submitEdit}
                className="px-3 py-2 rounded-[10px] text-sm inline-flex items-center gap-2"
                style={{
                  background: 'var(--brand)',
                  border: '1px solid color-mix(in oklab, var(--brand) 60%, black)',
                  color: '#0c1213',
                }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Submit Edit
              </button>
            </div>
          </div>
        </div>

        {/* Generate (like the green + button in the screenshot) */}
        <div className="mb-3">
          <button
            onClick={() => setEditOpen((v) => !v)}
            className="inline-flex items-center gap-2 text-sm rounded-[20px] px-3 py-1.5"
            style={{
              background: 'color-mix(in oklab, var(--brand) 14%, var(--card))',
              border: '1px solid color-mix(in oklab, var(--brand) 30%, var(--border))',
              color: 'var(--text)',
            }}
            title="Generate"
          >
            <Plus className="w-4 h-4" />
            Generate
          </button>
        </div>

        {/* System Prompt textarea */}
        <div>
          <textarea
            ref={taRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full min-h-[540px] rounded-[14px] p-3 text-sm leading-6 outline-none"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              boxShadow: 'var(--shadow-card)',
              resize: 'vertical',
            }}
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Tip: type what you want above, then “Submit Edit”.
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(prompt).catch(() => {});
                }}
                className="px-3 py-2 rounded-[10px] text-sm"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                Copy
              </button>
              <button
                onClick={() => {
                  setPrompt(BASE_PROMPT);
                }}
                className="px-3 py-2 rounded-[10px] text-sm inline-flex items-center gap-2"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
                title="Reset to base scaffold"
              >
                <X className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-[12px] text-sm"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            Back
          </button>
          <button
            onClick={onNext}
            className="px-5 py-2 rounded-[12px] text-sm"
            style={{
              background: 'var(--brand)',
              border: '1px solid color-mix(in oklab, var(--brand) 60%, black)',
              color: '#0c1213',
              boxShadow: '0 10px 24px rgba(0,0,0,.18)',
            }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Scoped light/dark tokens so the surface matches your other steps */}
      <style jsx global>{`
        .${SCOPE}{
          --bg: #ffffff;
          --text: #0e1213;
          --text-muted: rgba(0,0,0,.60);
          --panel: #ffffff;
          --card: #ffffff;
          --border: rgba(0,0,0,.12);
          --shadow-soft: 0 10px 26px rgba(0,0,0,.06);
          --shadow-card: inset 0 1px 0 rgba(255,255,255,.8), 0 10px 22px rgba(0,0,0,.06);
          --brand: #59d9b3;
        }
        [data-theme="dark"] .${SCOPE}{
          --bg: #0b0c10;
          --text: #e8f1ef;
          --text-muted: rgba(255,255,255,.65);
          --panel: rgba(13,15,17,0.92);
          --card: rgba(255,255,255,.02);
          --border: rgba(255,255,255,.14);
          --shadow-soft: 0 14px 34px rgba(0,0,0,.45);
          --shadow-card: inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.38);
          --brand: #59d9b3;
        }
      `}</style>
    </section>
  );
}
