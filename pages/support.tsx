// pages/support.tsx
'use client';

import Head from 'next/head';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Trash2, Share2, Copy, Send as SendIcon } from 'lucide-react';

/** ------- Palette + shared boxes (matches your builder style) ------- */
const CARD_OUTER: React.CSSProperties = {
  background: 'rgba(13,15,17,0.96)',
  border: '1px solid rgba(106,247,209,0.16)',
  borderRadius: 18,                  // less rounded (you asked)
  boxShadow:
    '0 18px 60px rgba(0,0,0,0.55), 0 0 34px rgba(0,255,194,0.08)', // OUTSIDE shadow only
};

const HEADER_STRIP: React.CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(0,255,194,0.10) 0%, rgba(0,255,194,0.06) 100%)',
  borderBottom: '1px solid rgba(106,247,209,0.18)',
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
};

const BTN_GREEN = '#00b894';       // same vibe as your “Next” buttons
const BTN_GREEN_HOVER = '#00a183';

/** ------- Minimal message shape ------- */
type Msg = { role: 'user' | 'assistant'; content: string };

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'Hi — I’m Riley. I can help you create a chatbot build, connect your API key, test it, or fix errors. What would you like to do?',
    },
  ]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to newest
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function sendMessage() {
    const content = text.trim();
    if (!content || busy) return;
    setText('');
    const next = [...messages, { role: 'user', content } as Msg];
    setMessages(next);
    setBusy(true);

    try {
      const r = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const j = await r.json();
      const reply: string =
        j?.reply || j?.message || j?.text || 'Hmm, I could not reach the server.';
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Network error. Please try again in a moment.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    setMessages([
      {
        role: 'assistant',
        content:
          'Hi — I’m Riley. I can help you create a chatbot build, connect your API key, test it, or fix errors. What would you like to do?',
      },
    ]);
  }

  return (
    <>
      <Head>
        <title>Support Center • reduc.ai</title>
      </Head>

      <main className="min-h-screen bg-[#0b0c10] px-6 py-8">
        {/* Page title (like your other pages) */}
        <div className="max-w-[1160px] mx-auto mb-6">
          <div className="flex items-end gap-2">
            <div className="text-[22px] md:text-[26px] font-movatif text-white/90 tracking-tight">
              Support Center
            </div>
            <span className="text-white/40 text-sm md:text-base">Help & FAQ</span>
          </div>
        </div>

        {/* Chat card */}
        <section className="max-w-[1160px] mx-auto" style={CARD_OUTER}>
          {/* Card header strip with “Riley — Support” and icon */}
          <div className="flex items-center justify-between px-4 md:px-5 py-3" style={HEADER_STRIP}>
            <div className="flex items-center gap-3">
              {/* Squircle badge like your app icon */}
              <div
                className="w-8 h-8 md:w-9 md:h-9 rounded-[14px] flex items-center justify-center"
                style={{
                  background: 'rgba(0,255,194,0.08)',
                  border: '1px solid rgba(0,255,194,0.22)',
                  boxShadow: 'inset 0 0 14px rgba(0,0,0,0.35)',
                }}
                aria-hidden
              >
                <MessageSquare className="w-4 h-4 text-[#6af7d1]" />
              </div>

              {/* Not bold; bigger; site font */}
              <div className="font-movatif">
                <div className="text-white/95 text-[18px] md:text-[20px] leading-none">
                  Riley <span className="text-white/50">— Support</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearChat}
                className="px-2.5 h-[32px] rounded-[10px] text-xs text-white/85 border border-white/10 hover:bg-white/5"
                title="Clear"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </span>
              </button>
              <button
                className="px-2.5 h-[32px] rounded-[10px] text-xs text-white/85 border border-white/10 hover:bg-white/5"
                title="Share (coming soon)"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5" /> Share
                </span>
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div
            ref={scrollRef}
            className="px-4 md:px-6 py-5 h-[64vh] md:h-[66vh] overflow-y-auto"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div className="space-y-4">
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} text={m.content} />
              ))}
            </div>
          </div>

          {/* Composer: single row, rounded input, Send pill on the right */}
          <div className="px-4 md:px-5 pb-4">
            <div
              className="w-full flex items-center gap-3 p-1.5 rounded-[16px]"
              style={{
                border: '1px solid rgba(255,255,255,0.10)',
                background: '#0e1113', // solid, not transparent
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Type your message..."
                className="flex-1 h-[44px] px-4 rounded-[14px] bg-[#0c0f10] text-white outline-none border border-white/10 focus:border-[#6af7d1]"
              />
              <button
                onClick={sendMessage}
                disabled={busy || !text.trim()}
                className="inline-flex items-center gap-2 h-[44px] px-5 rounded-[22px] font-semibold select-none disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: BTN_GREEN, color: '#07120f', boxShadow: '0 4px 14px rgba(0,255,194,0.22)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
              >
                <SendIcon className="w-4 h-4 text-white" />
                Send
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

/** --------- Solid bubbles with thin borders (assistant vs user) --------- */
function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const isUser = role === 'user';
  const wrapStyle: React.CSSProperties = {
    maxWidth: 'min(980px, 92%)',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.12)', // thin lines
  };

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-start'}`}>
      <div
        className={`px-4 py-2 text-[14px] leading-relaxed ${
          isUser ? 'text-[#d9fff5]' : 'text-white/92'
        }`}
        style={{
          ...wrapStyle,
          background: isUser ? '#0e3e35' : '#0f1416', // SOLID, not transparent
          boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
        }}
      >
        {text}
      </div>
    </div>
  );
}
