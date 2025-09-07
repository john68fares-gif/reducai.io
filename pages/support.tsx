// pages/support.tsx — Chat box with Movatif font (scoped), green buttons, shadows, animations
'use client';

import React, { useEffect, useRef, useState } from 'react';
import ContentWrapper from '@/components/layout/ContentWrapper';
import { Send, MessageSquareText, Copy, Share2, RotateCcw } from 'lucide-react';

type Msg = { id: string; role: 'user' | 'assistant'; text: string };

/** Keep your sanitize behavior */
const sanitize = (text: string) =>
  text.replace(/\*\*/g, '').replace(/```[\s\S]*?```/g, '[redacted]').replace(/`([^`]+)`/g, '$1');

/** Same brand greens used elsewhere */
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: crypto.randomUUID(), role: 'assistant', text: 'Hi, please provide a detailed description of your issue' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  /** --- Logic unchanged --- */
  const send = async () => {
    const value = input.trim();
    if (!value || loading) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', text: value };
    setMessages((prev) => [...prev, userMsg]);
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
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: sanitize(botText) },
      ]);
    } catch {
      setMessages((prev) => [
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

  /** UI helpers */
  function flashToast(t: string) {
    setToast(t);
    setTimeout(() => setToast(null), 1600);
  }
  async function copyTranscript() {
    const txt = messages.map((m) => `${m.role === 'user' ? 'You' : 'Riley'}: ${m.text}`).join('\n');
    try { await navigator.clipboard.writeText(txt); flashToast('Copied conversation'); }
    catch { flashToast('Copy failed'); }
  }
  function clearChat() {
    setMessages([{ id: crypto.randomUUID(), role: 'assistant', text: 'Hi, please provide a detailed description of your issue' }]);
  }
  async function shareTranscript() {
    const txt = messages.map((m) => `${m.role === 'user' ? 'You' : 'Riley'}: ${m.text}`).join('\n');
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: 'Riley Support', text: txt }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(txt); flashToast('Copied conversation'); }
      catch { flashToast('Share not available'); }
    }
  }

  return (
    <ContentWrapper>
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[1140px] px-4">
          {/* Title + actions */}
          <div className="flex items-center justify-between mt-4 mb-4">
            <h2 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Demo</h2>
            <div className="flex items-center gap-2">
              <GreenBtn onClick={copyTranscript} icon={<Copy className="w-4 h-4" />}>Copy</GreenBtn>
              <GreenBtn onClick={clearChat} icon={<RotateCcw className="w-4 h-4" />}>Clear</GreenBtn>
              <GreenBtn onClick={shareTranscript} icon={<Share2 className="w-4 h-4" />}>Share</GreenBtn>
            </div>
          </div>

          {/* CHAT BOX — Movatif-scoped wrapper */}
          <div
            className="rounded-[20px] mx-auto animate-[fadeIn_180ms_ease] font-movatif"
            style={{
              maxWidth: 1040,
              background:
                'radial-gradient(120% 180% at 50% -40%, rgba(0,255,194,.05) 0%, rgba(11,14,15,.96) 42%), linear-gradient(180deg, #0c1012 0%, #0a0d0f 100%)',
              border: '1px solid rgba(0,255,194,.18)',
              boxShadow:
                '0 28px 80px rgba(0,0,0,.55), 0 10px 26px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.06)',
            }}
          >
            {/* inner ring */}
            <div className="rounded-[20px]" style={{ boxShadow: 'inset 0 0 0 1px rgba(0,255,194,.08)' }}>
              <div className="p-4 sm:p-6">
                {/* messages area (bigger) */}
                <div ref={listRef} className="min-h-[520px] max-h-[62vh] overflow-y-auto custom-scroll">
                  {messages.map((m) => {
                    const isUser = m.role === 'user';
                    return (
                      <div key={m.id} className={`mb-3 ${isUser ? 'flex justify-end' : 'flex items-start gap-2'}`}>
                        {!isUser && (
                          <div
                            className="mt-0.5 w-7 h-7 rounded-full grid place-items-center shrink-0"
                            style={{ background: 'rgba(0,255,194,0.08)', border: '1px solid rgba(0,255,194,0.18)' }}
                          >
                            <MessageSquareText className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} />
                          </div>
                        )}
                        <div
                          className="px-3 py-2 rounded-lg max-w-[80%] text-sm whitespace-pre-wrap break-words animate-[popIn_140ms_ease]"
                          style={{
                            background: isUser ? 'rgba(0,255,194,0.10)' : 'rgba(255,255,255,0.035)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: 'var(--text)',
                            boxShadow: 'var(--shadow-soft)',
                            fontFamily: 'inherit',
                          }}
                        >
                          {m.text}
                        </div>
                      </div>
                    );
                  })}

                  {loading && (
                    <div className="flex items-start gap-2">
                      <div
                        className="mt-0.5 w-7 h-7 rounded-full grid place-items-center shrink-0"
                        style={{ background: 'rgba(0,255,194,0.08)', border: '1px solid rgba(0,255,194,0.18)' }}
                      >
                        <MessageSquareText className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} />
                      </div>
                      <div
                        className="px-3 py-2 rounded-lg max-w-[80%] text-sm"
                        style={{
                          background: 'rgba(255,255,255,0.035)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'var(--text)',
                          fontFamily: 'inherit',
                        }}
                      >
                        <TypingDots />
                      </div>
                    </div>
                  )}
                </div>

                {/* Input bar */}
                <div className="pt-5">
                  <div
                    className="flex items-center gap-2 rounded-full pl-4 pr-2 h-[50px] border transition-shadow"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderColor: 'rgba(0,255,194,0.18)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.28)',
                      fontFamily: 'inherit',
                    }}
                  >
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onKey}
                      placeholder="Type your message..."
                      className="flex-1 bg-transparent outline-none text-sm"
                      style={{ color: 'var(--text)', fontFamily: 'inherit' }}
                      onFocus={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'rgba(0,255,194,0.36)')}
                      onBlur={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'rgba(0,255,194,0.18)')}
                    />
                    <button
                      onClick={send}
                      disabled={loading || !input.trim()}
                      className="w-10 h-10 rounded-full grid place-items-center disabled:opacity-50 transition will-change-transform"
                      style={{ background: BTN_GREEN, color: '#fff', fontFamily: 'inherit' }}
                      onMouseEnter={(e) => {
                        if (loading || !input.trim()) return;
                        (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
                      }}
                      onMouseLeave={(e) => {
                        if (loading || !input.trim()) return;
                        (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
                      }}
                      aria-label="Send"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-[11px] text-center opacity-70 mt-3" style={{ color: 'var(--text-muted)', fontFamily: 'inherit' }}>
                    Riley will never reveal or summarize code, file contents, or paths. If asked, Riley will refuse.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* toast */}
          {toast && (
            <div className="fixed inset-0 z-[9997] pointer-events-none flex items-end justify-center pb-8">
              <div
                className="pointer-events-auto px-4 py-2 rounded-full text-sm animate-[popIn_140ms_ease]"
                style={{ background: 'rgba(0,0,0,.65)', color: '#fff', border: '1px solid rgba(255,255,255,.14)', boxShadow: '0 16px 36px rgba(0,0,0,.45)', fontFamily: 'inherit' }}
              >
                {toast}
              </div>
            </div>
          )}

          {/* animations + scrollbar */}
          <style jsx global>{`
            @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes popIn { 0% { opacity: 0; transform: scale(.98); } 100% { opacity: 1; transform: scale(1); } }
            .custom-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
            .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.10); border-radius: 999px; }
            .custom-scroll::-webkit-scrollbar-track { background: transparent; }
          `}</style>
        </div>
      </div>
    </ContentWrapper>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center" style={{ fontFamily: 'inherit' }}>
      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--text-muted)' }} />
      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '120ms' }} />
      <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '240ms' }} />
    </span>
  );
}

/** Small filled green button (inherits Movatif from wrapper) */
function GreenBtn({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 h-[36px] rounded-[14px] font-semibold text-sm transition will-change-transform"
      style={{ background: BTN_GREEN, color: '#fff', fontFamily: 'inherit' }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
    >
      {icon}
      {children}
    </button>
  );
}
