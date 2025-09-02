// pages/support.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { HelpCircle, ChevronDown } from 'lucide-react';

/* ---------- Simple styles to fit your dark / glow UI ---------- */
const FRAME: React.CSSProperties = {
  background: 'rgba(13,15,17,0.95)',
  border: '2px dashed rgba(106,247,209,0.30)',
  boxShadow: '0 0 40px rgba(0,0,0,0.7)',
  borderRadius: 24,
};
const CARD: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.30)',
  borderRadius: 18,
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 10px 40px rgba(0,0,0,0.35)',
};

/* ---------- Tiny Accordion (no localStorage here) ---------- */
function AccordionItem({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={CARD} className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2 text-white font-semibold">{title}</div>
        <ChevronDown className={`w-5 h-5 text-white/80 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          display: 'grid',
          transition: 'grid-template-rows 240ms ease',
        }}
      >
        <div className="min-h-0">
          <div className="px-5 pb-5 pt-1 text-white/85 text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* --------------------- Support Chat (uses server route) --------------------- */
/** Pulls newest text build from localStorage *after mount* and uses its prompt as system */
function SupportChat() {
  type Msg = { role: 'user' | 'assistant'; content: string };

  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Hi — ask me anything about the platform. I answer short and clearly.' },
  ]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const [model, setModel] = useState('gpt-4o-mini');
  const [system, setSystem] = useState(
    'You are a helpful website assistant for reduc.ai. Keep answers under 80 words; use bullets for steps.'
  );

  const boxRef = useRef<HTMLDivElement | null>(null);

  // Load newest text build (if any) and use its prompt + model
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('chatbots') : null;
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr) && arr.length) {
        const sorted = arr
          .slice()
          .sort(
            (a: any, b: any) =>
              Date.parse(b?.updatedAt || b?.createdAt || '0') -
              Date.parse(a?.updatedAt || a?.createdAt || '0')
          );

        // prefer non-voice; else take first
        const chosen = sorted.find((b: any) => (b?.type || 'text') !== 'voice') || sorted[0];
        if (chosen?.prompt) setSystem(String(chosen.prompt));
        if (chosen?.model) setModel(String(chosen.model));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    setText('');
    setMessages((m) => [...m, { role: 'user', content }]);
    setBusy(true);

    try {
      const payload = {
        model,
        system, // system prompt from newest build
        messages: messages.concat({ role: 'user', content }).map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.3,
        maxTokens: 400,
      };

      const r = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      const reply = j?.reply || j?.message || j?.text || '(no response)';
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Temporary error. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={CARD} className="p-0 rounded-xl overflow-hidden">
      <div className="px-3 py-2 text-xs text-white/60 border-b border-white/10">
        Support chatbot · model <span className="text-white/90">{model}</span>
      </div>

      <div ref={boxRef} className="h-[360px] overflow-y-auto px-3 py-3 space-y-2" style={{ scrollbarWidth: 'thin' }}>
        {messages.map((m, i) => (
          <div key={i} className="flex">
            <div
              className={`max-w-[86%] text-sm px-3 py-2 rounded-lg ${
                m.role === 'user'
                  ? 'bg-[#0f4136] text-[#d9fff5]'
                  : 'bg-[#0f1314] text-white/90 border border-white/10'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="p-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your message…"
          className="flex-1 h-[40px] rounded-[12px] border border-white/20 bg-black/40 px-3 text-white outline-none focus:border-[#6af7d1]"
        />
        <button
          onClick={send}
          disabled={busy}
          className="inline-flex items-center gap-2 h-[40px] px-3 rounded-[12px]"
          style={{ background: '#59d9b3', color: '#0b0c10', opacity: busy ? 0.7 : 1 }}
          title="Send"
        >
          Send
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- Page -------------------------------- */
export default function SupportPage() {
  return (
    <>
      <Head><title>Support • reduc.ai</title></Head>

      <main className="px-6 py-10" style={{ maxWidth: 980, margin: '0 auto' }}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
          <HelpCircle className="w-6 h-6 text-[#6af7d1]" /> Support
        </h1>

        <div style={FRAME} className="p-5 space-y-4">
          <AccordionItem title="AI Helpline (chat with our site assistant)" defaultOpen>
            <SupportChat />
            <div className="text-xs text-white/60 mt-2">
              Tip: The bot uses your latest text build’s prompt. Generate a new build to update behavior.
            </div>
          </AccordionItem>

          <AccordionItem title="Quick Guide">
            <ol className="list-decimal list-inside space-y-2 text-sm text-white/85">
              <li>Builder → create a **Text Build** (fill Description, Rules, Flow, Company Info).</li>
              <li>Step 2: choose a model (e.g., <code>gpt-4o-mini</code>), temperature ~0.3.</li>
              <li>Step 4: click **Generate** to save it. That becomes the Support bot’s brain.</li>
              <li>Return here to test. Keep replies short and clear.</li>
            </ol>
          </AccordionItem>

          <AccordionItem title="FAQ">
            <div className="text-sm text-white/80">
              Add real FAQs later; the bot already has company info from your build prompt.
            </div>
          </AccordionItem>
        </div>
      </main>

      <style jsx global>{` body { background:#0b0c10; } `}</style>
    </>
  );
}
