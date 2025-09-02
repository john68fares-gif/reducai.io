// pages/support.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Share2, Check, Trash2, Copy, MessageSquareText } from 'lucide-react';

const SUPPORT_EMAIL = 'support@reduc.ai';

/* ===== Theme (thin borders, opaque fills) ===== */
const UI = {
  green: '#59d9b3',
  greenHover: '#54cfa9',
  cardBg: '#0f1213',           // solid
  frameBg: 'rgba(13,15,17,0.96)',
  borderThin: '1px solid rgba(255,255,255,0.12)', // thinner
  dashThin: '1px dashed rgba(106,247,209,0.22)',
  glow: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)',
};

const FRAME: React.CSSProperties = {
  background: UI.frameBg,
  border: UI.dashThin,
  borderRadius: 28,
  boxShadow: 'inset 0 0 18px rgba(0,0,0,0.28), 0 0 20px rgba(0,255,194,0.05)',
};

const CARD: React.CSSProperties = {
  background: UI.cardBg,
  border: UI.borderThin,
  borderRadius: 26,
  boxShadow: 'inset 0 0 14px rgba(0,0,0,0.28), 0 10px 34px rgba(0,0,0,0.34)',
};

const fadeUp = {
  initial: { opacity: 0, y: 12, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.22 },
};

/* ===== Chat component ===== */
function SupportChat() {
  type Msg = { role: 'user' | 'assistant'; content: string };

  const [agentName, setAgentName] = useState('Riley'); // fallback
  const [model, setModel] = useState('gpt-4o-mini');   // internal only
  const [system, setSystem] = useState(
    'You are a helpful website assistant for reduc.ai. Keep answers under 80 words; use bullets for steps.'
  );

  // Hydrate from latest non-voice build
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
        if (chosen?.name) setAgentName(String(chosen.name));
        if (chosen?.prompt) setSystem(String(chosen.prompt));
        if (chosen?.model) setModel(String(chosen.model));
      }
    } catch {}
  }, []);

  const initialGreeting: Msg = {
    role: 'assistant',
    content: `Hi — I’m ${agentName}. I can help you create a chatbot build, connect your API key, test it, or fix errors. What would you like to do?`,
  };

  const [messages, setMessages] = useState<Msg[]>([initialGreeting]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

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
        temperature: 0.3,
        maxTokens: 400,
        messages: messages.concat({ role: 'user', content }).map(m => ({ role: m.role, content: m.content })),
      };
      const r = await fetch('/api/support/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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

  const [shareCopied, setShareCopied] = useState(false);
  function copyShare() {
    try {
      navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1200);
    } catch {}
  }

  return (
    <motion.div {...fadeUp} style={CARD} className="relative overflow-hidden w-full">
      {/* Soft glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[30%] -left-[30%] w-[70%] h-[70%] rounded-full"
        style={{ background: UI.glow, filter: 'blur(42px)' }}
      />

      {/* Chat header (thin lines, not bold) */}
      <div className="px-6 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.10)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/90 font-normal">
            <MessageSquareText className="w-4 h-4 text-[#6af7d1]" />
            <span className="tracking-tight">{agentName} — Support</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearChat}
              className="inline-flex items-center gap-2 px-3 h-8 rounded-[12px] text-sm hover:bg-white/8 transition"
              title="Clear"
              style={{ border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
            <button
              onClick={copyShare}
              className="inline-flex items-center gap-2 px-3 h-8 rounded-[12px] text-sm hover:bg-white/8 transition"
              title="Share"
              style={{ border: '1px solid rgba(255,255,255,0.10)' }}
            >
              {shareCopied ? <Check className="w-4 h-4 text-[#6af7d1]" /> : <Share2 className="w-4 h-4" />}
              {shareCopied ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>
      </div>

      {/* Messages (opaque bubbles) */}
      <div
        ref={boxRef}
        className="px-6 py-5 space-y-3"
        style={{ height: 720, scrollbarWidth: 'thin' }}
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
                className={`max-w-[90%] text-sm px-4 py-2.5 rounded-[18px] ${
                  m.role === 'user'
                    ? 'text-[#dbfff6]'
                    : 'text-white/90'
                }`}
                style={{
                  background: m.role === 'user' ? '#0e4036' : '#121718', // solid
                  border: m.role === 'user'
                    ? '1px solid rgba(0,255,194,0.18)'
                    : '1px solid rgba(255,255,255,0.10)',
                }}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Composer (solid bar + pill input + green pill button) */}
      <div
        className="p-3 flex gap-3 items-center border-t"
        style={{ borderColor: 'rgba(255,255,255,0.10)', background: '#0b0e10' }} // solid
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your message…"
          className="flex-1 h-[52px] rounded-[999px] px-5 text-white outline-none"
          style={{
            background: '#0d1112',
            border: '1px solid rgba(255,255,255,0.14)',
          }}
        />
        <button
          onClick={send}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 h-[52px] px-7 rounded-[999px] font-semibold text-black shadow-sm transition disabled:opacity-70"
          style={{ background: UI.green }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = UI.greenHover)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = UI.green)}
        >
          Send
        </button>
      </div>
    </motion.div>
  );
}

/* ===== Page wrapper ===== */
export default function SupportPage() {
  const [copied, setCopied] = useState(false);
  function copyEmail() {
    navigator.clipboard.writeText(SUPPORT_EMAIL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1100);
    });
  }

  return (
    <>
      <Head><title>Support • reduc.ai</title></Head>

      <main
        className="px-6 py-10 font-movatif"
        style={{ maxWidth: 1520, margin: '0 auto' }}   // wider page
      >
        {/* Title (bigger, not bold, same font) */}
        <motion.div {...fadeUp} className="mb-6">
          <h1 className="text-white/95 font-normal tracking-tight"
              style={{ fontSize: '32px' /* ~text-3xl */, lineHeight: 1.1 }}>
            Riley — Support
          </h1>
        </motion.div>

        {/* Slim info bar (thin lines) */}
        <motion.div {...fadeUp} className="mb-8">
          <div
            className="w-full rounded-[16px] px-5 py-3 text-sm flex items-center justify-center gap-2"
            style={{ ...FRAME, borderStyle: 'solid', borderWidth: 1 }}
          >
            <HelpCircle className="w-4 h-4 text-[#6af7d1]" />
            <span className="text-white/80">
              Ask our Support AI or email&nbsp;
              <span className="text-white">{SUPPORT_EMAIL}</span>
            </span>
            <button
              onClick={copyEmail}
              className="ml-2 inline-flex items-center gap-1 px-2 h-7 rounded-[10px] hover:bg-white/8 transition"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
              title="Copy email"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#6af7d1]" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </motion.div>

        {/* Wider chat card */}
        <motion.div {...fadeUp} className="mx-auto w-full" style={{ maxWidth: 1280 }}>
          <SupportChat />
        </motion.div>
      </main>

      <style jsx global>{`
        body { background:#0b0c10; }
        .hover\\:bg-white\\/8:hover { background: rgba(255,255,255,0.08); }
      `}</style>
    </>
  );
}
