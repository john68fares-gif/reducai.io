// pages/support.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { HelpCircle, Copy, Check, Share2, Trash2, MessageSquareText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SUPPORT_EMAIL = 'support@reduc.ai'; // change if needed

/* ===== Theme bits (same vibe as your app) ===== */
const UI = {
  frameBg: 'rgba(13,15,17,0.95)',
  cardBg: '#101314',
  borderThin: '1px solid rgba(255,255,255,0.30)',
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
  border: UI.borderThin,
  borderRadius: 20,
  boxShadow: 'inset 0 0 18px rgba(0,0,0,0.28), 0 14px 44px rgba(0,0,0,0.45)',
};
const fadeUp = {
  initial: { opacity: 0, y: 12, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.22 },
};

/* ===== Chat component ===== */
function SupportChat() {
  type Msg = { role: 'user' | 'assistant'; content: string };
  const initialGreeting: Msg = {
    role: 'assistant',
    content: 'Hi, please provide a detailed description of your issue.',
  };

  const [messages, setMessages] = useState<Msg[]>([initialGreeting]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const [model, setModel] = useState('gpt-4o-mini');
  const [system, setSystem] = useState(
    'You are a helpful website assistant for reduc.ai. Keep answers under 80 words; use bullets for steps.'
  );

  const boxRef = useRef<HTMLDivElement | null>(null);

  // Load the newest *text* build from localStorage (safe: after mount only)
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
    setMessages(m => [...m, { role: 'user', content }]);
    setBusy(true);

    try {
      const payload = {
        model,
        system,
        messages: messages.concat({ role: 'user', content }).map(m => ({ role: m.role, content: m.content })),
        temperature: 0.3,
        maxTokens: 400,
      };

      const r = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      const reply = j?.reply || j?.message || j?.text || 'Sorry—no response.';
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Temporary error. Please try again.' }]);
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

  function clearChat() {
    setMessages([initialGreeting]);
    setText('');
  }

  function copyShare() {
    try {
      navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch {}
  }

  const [shareCopied, setShareCopied] = useState(false);

  return (
    <motion.div {...fadeUp} style={CARD} className="relative p-0 overflow-hidden">
      {/* subtle glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[30%] -left-[30%] w-[70%] h-[70%] rounded-full"
        style={{ background: UI.glow, filter: 'blur(40px)' }}
      />

      {/* Header row inside the card */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/90 font-semibold">
          <MessageSquareText className="w-4 h-4 text-[#6af7d1]" />
          Demo
          <span className="text-white/50 text-xs ml-2">model: {model}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="inline-flex items-center gap-2 px-3 h-8 rounded-[10px] text-sm hover:bg-white/10 transition"
            title="Clear"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
          <button
            onClick={copyShare}
            className="inline-flex items-center gap-2 px-3 h-8 rounded-[10px] text-sm hover:bg-white/10 transition"
            title="Share"
          >
            {shareCopied ? <Check className="w-4 h-4 text-[#6af7d1]" /> : <Share2 className="w-4 h-4" />}
            {shareCopied ? 'Copied' : 'Share'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={boxRef}
        className="h-[560px] overflow-y-auto px-4 py-4 space-y-2"
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

      {/* Composer */}
      <div className="p-3 border-t border-white/10 bg-black/20 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your message..."
          className="flex-1 h-[44px] rounded-[12px] border border-white/20 bg-black/40 px-3 text-white outline-none focus:border-[#6af7d1]"
        />
        <button
          onClick={send}
          disabled={busy}
          className="inline-flex items-center gap-2 h-[44px] px-5 rounded-[12px] font-semibold shadow-sm transition"
          style={{ background: UI.green, color: '#0b0c10', opacity: busy ? 0.7 : 1 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = UI.greenHover)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = UI.green)}
        >
          Send
        </button>
      </div>
    </motion.div>
  );
}

/* ===== Page ===== */
export default function SupportPage() {
  const [copied, setCopied] = useState(false);
  function copyEmail() {
    navigator.clipboard.writeText(SUPPORT_EMAIL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <>
      <Head><title>Support Center • reduc.ai</title></Head>

      <main className="px-6 py-10" style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Top bar (email + copy) */}
        <motion.div {...fadeUp} className="mb-6 flex items-center justify-center">
          <div
            className="w-full rounded-[16px] px-4 py-3 text-sm flex items-center justify-center gap-2"
            style={{ ...FRAME, borderStyle: 'solid', borderWidth: 1 }}
          >
            <HelpCircle className="w-4 h-4 text-[#6af7d1]" />
            <span className="text-white/80">
              Ask our Support AI, or send us an email on:&nbsp;
              <span className="text-white">{SUPPORT_EMAIL}</span>
            </span>
            <button
              onClick={copyEmail}
              className="ml-2 inline-flex items-center gap-1 px-2 h-7 rounded-[10px] border border-white/15 hover:bg-white/10 transition"
              title="Copy email"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#6af7d1]" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </motion.div>

        {/* Centered wide chat panel (single card, no nested boxes) */}
        <motion.div {...fadeUp} className="mx-auto" style={{ maxWidth: 980 }}>
          <SupportChat />
        </motion.div>
      </main>

      <style jsx global>{`
        body { background:#0b0c10; }
      `}</style>
    </>
  );
}
