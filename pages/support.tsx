// pages/support.tsx (visuals aligned to API Keys page)
'use client';

import React, { useEffect, useRef, useState } from 'react';
import ContentWrapper from '@/components/layout/ContentWrapper';
import { MessageSquareText, Shield } from 'lucide-react';

type Msg = { id: string; role: 'user' | 'assistant'; text: string };

const sanitize = (text: string) =>
  text.replace(/\*\*/g, '').replace(/```[\s\S]*?```/g, '[redacted]').replace(/`([^`]+)`/g, '$1');

/* ------------------------------- Look & feel -------------------------------- */
const FRAME: React.CSSProperties = {
  background: 'var(--frame-bg, var(--panel))',
  border: '1px solid var(--border)',
  boxShadow: 'var(--frame-shadow, var(--shadow-soft))',
  borderRadius: 30,
};
const CARD: React.CSSProperties = {
  background: 'var(--card-bg, var(--card))',
  border: '1px solid var(--border)',
  boxShadow: 'var(--card-shadow, var(--shadow-card))',
  borderRadius: 20,
};
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: crypto.randomUUID(), role: 'assistant', text: "Hi, I’m Riley. How can I help you today?" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const value = input.trim();
    if (!value || loading) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', text: value };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const r = await fetch('/api/support/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: value }),
      });
      const data = await r.json();
      const botText = (data?.ok && typeof data?.message === 'string')
        ? data.message
        : 'Sorry, I can’t comply with that request.';

      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: sanitize(botText) }]);
    } catch {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') send();
  };

  return (
    <ContentWrapper>
      {/* small section label above the panel (same as API Keys page) */}
      <div className="mx-auto w-full max-w-[980px] mb-3">
        <div className="text-xs font-semibold tracking-[.12em] opacity-70" style={{ color: 'var(--text-muted)' }}>
          SUPPORT
        </div>
      </div>

      <div className="mx-auto w-full max-w-[980px] support-panel">
        <div className="relative" style={FRAME}>
          {/* header */}
          <div className="flex items-start justify-between px-6 lg:px-8 py-6" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Riley Support</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Ask questions about the builder, voice agent, deployments, and more
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                 style={{ background: 'var(--brand-weak)', boxShadow: 'var(--chip-shadow, none)' }}>
              <MessageSquareText className="w-5 h-5" style={{ color: 'var(--brand)' }} />
            </div>
          </div>

          {/* body */}
          <div className="px-6 lg:px-8 pb-7 space-y-5">
            {/* messages card */}
            <div style={CARD} className="p-4">
              <div
                ref={listRef}
                className="flex-1 min-h-[360px] max-h-[60vh] overflow-y-auto p-2 flex flex-col gap-2"
              >
                {messages.map(m => (
                  <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className="px-3 py-2 rounded-lg max-w-[80%] whitespace-pre-wrap break-words text-sm"
                      style={{
                        background: m.role === 'user' ? 'var(--brand-weak)' : 'var(--card)',
                        border: `1px solid var(--border)`,
                        color: 'var(--text)',
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div
                      className="px-3 py-2 rounded-lg max-w-[80%] text-sm"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    >
                      <TypingDots />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* input card */}
            <div style={CARD} className="p-4">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Ask Riley…"
                  className="flex-1 rounded-[14px] px-3 h-[46px] text-sm outline-none"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                />
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="px-5 h-[46px] rounded-[18px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: BTN_GREEN, color: '#fff' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
                >
                  Send
                </button>
              </div>
              <div className="text-xs text-center pt-3 flex items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <Shield className="w-3.5 h-3.5 opacity-80" />
                Riley will never reveal or summarize code, file contents, or paths. If asked, Riley will refuse.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* page-scoped cosmetics to match API Keys panel */}
      <style jsx global>{`
        [data-theme="dark"] .support-panel {
          --frame-bg: radial-gradient(120% 180% at 50% -40%, rgba(0,255,194,.06) 0%, rgba(12,16,18,1) 42%)
                       , linear-gradient(180deg, #0e1213 0%, #0c1012 100%);
          --frame-shadow:
            0 26px 70px rgba(0,0,0,.60),
            0 8px 24px rgba(0,0,0,.45),
            0 0 0 1px rgba(0,255,194,.06);
          --chip-shadow: 0 4px 14px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05);
        }
        [data-theme="dark"] .support-panel .card,
        [data-theme="dark"] .support-panel .p-4 {
          --card-bg: linear-gradient(180deg, rgba(24,32,31,.86) 0%, rgba(16,22,21,.86) 100%);
          --card-shadow:
            0 16px 36px rgba(0,0,0,.55),
            0 2px 8px rgba(0,0,0,.35),
            inset 0 1px 0 rgba(255,255,255,.07),
            0 0 0 1px rgba(0,255,194,.05);
        }
      `}</style>
    </ContentWrapper>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center">
      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--text-muted)' }} />
      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '120ms' }} />
      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '240ms' }} />
    </span>
  );
}
