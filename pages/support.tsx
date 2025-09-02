// pages/support.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import {
  HelpCircle, ChevronDown, MessageSquareText, BookOpen, FileText, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ====== Theme bits to match your other screens ====== */
const UI = {
  frameBg: 'rgba(13,15,17,0.95)',
  cardBg: '#101314',
  thinBorder: '1px solid rgba(255,255,255,0.30)',
  dashed: '2px dashed rgba(106,247,209,0.30)',
  glow: 'radial-gradient(circle, rgba(106,247,209,0.12) 0%, transparent 70%)',
  green: '#59d9b3',
  greenHover: '#54cfa9',
};
const FRAME: React.CSSProperties = {
  background: UI.frameBg,
  border: UI.dashed,
  borderRadius: 28,
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.30), 0 0 22px rgba(0,255,194,0.06)',
};
const CARD: React.CSSProperties = {
  background: UI.cardBg,
  border: UI.thinBorder,
  borderRadius: 20,
  boxShadow: 'inset 0 0 18px rgba(0,0,0,0.28), 0 10px 36px rgba(0,0,0,0.35)',
};
const fadeUp = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.22 },
};

/* ====== Accordion (collapsible sections) ====== */
function AccordionItem({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.div {...fadeUp} style={CARD} className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2 text-white font-semibold">
          {icon} <span>{title}</span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-white/80 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.20 }}
          >
            <div className="px-5 pb-5 pt-1 text-white/85 text-sm">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ====== Support Chat (uses newest text build prompt after mount) ====== */
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

  // Load newest text build (no SSR access)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('chatbots');
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr) && arr.length) {
        const sorted = arr
          .slice()
          .sort(
            (a: any, b: any) =>
              Date.parse(b?.updatedAt || b?.createdAt || '0') -
              Date.parse(a?.updatedAt || a?.createdAt || '0')
          );
        const chosen = sorted.find((b: any) => (b?.type || 'text') !== 'voice') || sorted[0];
        if (chosen?.prompt) setSystem(String(chosen.prompt));
        if (chosen?.model) setModel(String(chosen.model));
      }
    } catch {}
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
        system,
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
    <motion.div {...fadeUp} style={CARD} className="rounded-xl overflow-hidden p-0 relative">
      {/* Soft glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[30%] -left-[30%] w-[70%] h-[70%] rounded-full"
        style={{ background: UI.glow, filter: 'blur(38px)' }}
      />
      <div className="px-3 py-2 text-xs text-white/70 border-b border-white/10 flex items-center gap-2">
        <MessageSquareText className="w-4 h-4 text-[#6af7d1]" />
        Support chatbot · model <span className="text-white/90">{model}</span>
      </div>

      <div
        ref={boxRef}
        className="h-[380px] overflow-y-auto px-3 py-3 space-y-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex"
            >
              <div
                className={`max-w-[86%] text-sm px-3 py-2 rounded-lg ${
                  m.role === 'user'
                    ? 'bg-[#0f4136] text-[#d9fff5]'
                    : 'bg-[#0f1314] text-white/90 border border-white/10'
                }`}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="p-2 flex gap-2 border-t border-white/10 bg-black/20">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your message…"
          className="flex-1 h-[42px] rounded-[12px] border border-white/20 bg-black/40 px-3 text-white outline-none focus:border-[#6af7d1]"
        />
        <button
          onClick={send}
          disabled={busy}
          className="inline-flex items-center gap-2 h-[42px] px-4 rounded-[12px] font-semibold transition"
          style={{ background: UI.green, color: '#0b0c10', opacity: busy ? 0.7 : 1 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = UI.greenHover)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = UI.green)}
          title="Send"
        >
          Send
        </button>
      </div>
    </motion.div>
  );
}

/* ====== Page ====== */
export default function SupportPage() {
  return (
    <>
      <Head><title>Support & Help • reduc.ai</title></Head>

      <main className="px-6 py-12" style={{ maxWidth: 1080, margin: '0 auto' }}>
        {/* Page Title */}
        <motion.div {...fadeUp} className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(0,255,194,0.12)', border: '1px solid rgba(0,255,194,0.22)' }}
            >
              <HelpCircle className="w-5 h-5 text-[#6af7d1]" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
                Support & Help
              </h1>
              <div className="text-white/70 text-sm mt-1">
                Chat with the assistant, read the guide, or check FAQs.
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-white/70 text-sm">
            <Sparkles className="w-4 h-4 text-[#6af7d1]" />
            <span>Powered by your latest Build</span>
          </div>
        </motion.div>

        {/* Frame wrapper with glow */}
        <motion.div {...fadeUp} style={FRAME} className="p-5 space-y-4 relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[20%] -right-[28%] w-[55%] h-[55%] rounded-full"
            style={{ background: UI.glow, filter: 'blur(42px)' }}
          />

          {/* Chat */}
          <AccordionItem
            title="AI Helpline (chat with our site assistant)"
            icon={<MessageSquareText className="w-5 h-5 text-[#6af7d1]" />}
            defaultOpen
          >
            <SupportChat />
            <div className="text-xs text-white/60 mt-2">
              Tip: The bot uses your newest text build’s prompt. Generate a new build to update behavior.
            </div>
          </AccordionItem>

          {/* Guide */}
          <AccordionItem
            title="Quick Guide (how it works)"
            icon={<BookOpen className="w-5 h-5 text-[#6af7d1]" />}
          >
            <div style={CARD} className="p-4 rounded-xl text-sm text-white/85">
              <ol className="list-decimal list-inside space-y-2">
                <li>Builder → create a <b>Text Build</b> with Description, Rules, Flow, Company Info.</li>
                <li>Step 2: choose a model (e.g., <code>gpt-4o-mini</code>), temperature ~0.3.</li>
                <li>Step 4: click <b>Generate</b> to save it (the Support bot will use it).</li>
                <li>Return here to test. Keep replies short and clear.</li>
              </ol>
            </div>
          </AccordionItem>

          {/* FAQ placeholder */}
          <AccordionItem
            title="FAQ"
            icon={<FileText className="w-5 h-5 text-[#6af7d1]" />}
          >
            <div style={CARD} className="p-4 rounded-xl text-sm text-white/80">
              Add real FAQs later; your build’s Company Info already gives the bot reusable facts.
            </div>
          </AccordionItem>
        </motion.div>
      </main>

      <style jsx global>{`
        body { background:#0b0c10; }
      `}</style>
    </>
  );
}
