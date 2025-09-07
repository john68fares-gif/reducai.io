// pages/support.tsx — visuals matched to Step1 (cards, glows, shadows, animations)
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MessageSquareText, Shield, Sparkles, Wrench, Rocket } from 'lucide-react';

type Msg = { id: string; role: 'user' | 'assistant'; text: string };

const sanitize = (text: string) =>
  text.replace(/\*\*/g, '').replace(/```[\s\S]*?```/g, '[redacted]').replace(/`([^`]+)`/g, '$1');

/* --- Same visual tokens used in Step1 --- */
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
  borderRadius: 20,
};

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
      const botText =
        data?.ok && typeof data?.message === 'string'
          ? data.message
          : 'Sorry, I can’t comply with that request.';

      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: sanitize(botText) },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') send();
  };

  return (
    <main className="min-h-screen w-full font-movatif" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        {/* HERO — mirrors Step1 hero (radial glow + grid overlay + chips) */}
        <section className="relative overflow-hidden p-6 md:p-7 mb-8 animate-[fadeIn_180ms_ease]" style={CARD}>
          {/* soft brand glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
            style={{
              background:
                'radial-gradient(circle, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)',
              filter: 'blur(38px)',
            }}
          />
          {/* faint grid mask like Step1 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[.10]"
            style={{
              background:
                'linear-gradient(transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px), linear-gradient(90deg, transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px)',
              backgroundSize: '32px 32px',
              maskImage: 'radial-gradient(circle at 30% 20%, black, transparent 70%)',
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center relative">
            <div>
              <div className="text-xl font-semibold mb-2">Riley Support</div>
              <p className="opacity-80 mb-5" style={{ color: 'var(--text-muted)' }}>
                Fast help for your Builder, Voice Agent, deployments, and storage wiring.
              </p>

              <div className="flex flex-wrap gap-2">
                {[
                  ['Builder & Steps', <Sparkles key="s" className="w-3.5 h-3.5" />],
                  ['Fix & Debug', <Wrench key="w" className="w-3.5 h-3.5" />],
                  ['Deploy & Launch', <Rocket key="r" className="w-3.5 h-3.5" />],
                ].map(([t, icon]) => (
                  <span
                    key={String(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-2xl border transition hover:-translate-y-[1px]"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--panel)',
                      boxShadow: 'var(--shadow-soft)',
                      color: 'var(--text)',
                    }}
                  >
                    {icon}
                    {t as string}
                  </span>
                ))}
              </div>
            </div>

            <div className="justify-self-end">
              <div
                className="w-44 h-44 rounded-3xl grid place-items-center"
                style={{
                  background: 'radial-gradient(circle at 50% 20%, rgba(0,0,0,0.18), rgba(0,0,0,0.06))',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-soft)',
                }}
              >
                <MessageSquareText className="w-11 h-11" style={{ color: 'var(--brand)' }} />
              </div>
            </div>
          </div>
        </section>

        {/* CHAT PANEL — card look & subtle animations like Step1 form */}
        <section className="relative p-6 sm:p-7 space-y-5 animate-[fadeIn_220ms_ease]" style={CARD}>
          {/* soft brand glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
            style={{
              background:
                'radial-gradient(circle, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)',
              filter: 'blur(38px)',
            }}
          />

          {/* Messages area */}
          <div
            ref={listRef}
            className="min-h-[360px] max-h-[60vh] overflow-y-auto p-2 flex flex-col gap-2 rounded-xl"
            style={{ background: 'transparent' }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className="px-3 py-2 rounded-lg max-w-[80%] whitespace-pre-wrap break-words text-sm animate-[popIn_140ms_ease]"
                  style={{
                    background: m.role === 'user' ? 'var(--brand-weak)' : 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    boxShadow: 'var(--shadow-soft)',
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
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    boxShadow: 'var(--shadow-soft)',
                  }}
                >
                  <TypingDots />
                </div>
              </div>
            )}
          </div>

          {/* Input row */}
          <div className="flex gap-2 pt-1">
            <div
              className="flex items-center gap-2 rounded-2xl px-4 h-[46px] border flex-1 transition-shadow"
              style={{ borderColor: 'var(--border)', background: 'var(--panel)', boxShadow: 'var(--shadow-soft)' }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask Riley…"
                className="w-full bg-transparent outline-none text-[15px]"
                style={{ color: 'var(--text)' }}
                onFocus={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--brand)')}
                onBlur={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--border)')}
              />
            </div>

            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 h-[46px] rounded-[18px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition will-change-transform"
              style={{ background: BTN_GREEN, color: '#fff' }}
              onMouseEnter={(e) => {
                if (loading || !input.trim()) return;
                (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
              }}
              onMouseLeave={(e) => {
                if (loading || !input.trim()) return;
                (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
              }}
            >
              Send
            </button>
          </div>

          <div
            className="text-xs text-center pt-2 flex items-center justify-center gap-2 opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            <Shield className="w-3.5 h-3.5 opacity-80" />
            Riley will never reveal or summarize code, file contents, or paths. If asked, Riley will refuse.
          </div>
        </section>
      </div>

      {/* tiny animations used above */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.98); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </main>
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
