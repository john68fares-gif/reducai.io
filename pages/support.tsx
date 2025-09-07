// pages/support.tsx — Theme-aware (dark + light), Movatif scoped to chat, same logic
'use client';

import React, { useEffect, useRef, useState } from 'react';
import ContentWrapper from '@/components/layout/ContentWrapper';
import { Send, MessageSquareText, Copy, Share2, RotateCcw } from 'lucide-react';

type Msg = { id: string; role: 'user' | 'assistant'; text: string };

// keep your sanitization policy
const sanitize = (text: string) =>
  text.replace(/\*\*/g, '').replace(/```[\s\S]*?```/g, '[redacted]').replace(/`([^`]+)`/g, '$1');

// brand green like API Keys
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

  // ---------- logic unchanged ----------
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

  // mini helpers
  function flashToast(t: string) { setToast(t); setTimeout(() => setToast(null), 1600); }
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
    if ((navigator as any).share) { try { await (navigator as any).share({ title: 'Riley Support', text: txt }); } catch {} }
    else { try { await navigator.clipboard.writeText(txt); flashToast('Copied conversation'); } catch { flashToast('Share not available'); } }
  }

  return (
    <ContentWrapper>
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[1140px] px-4 support-scope">
          {/* Title + actions */}
          <div className="flex items-center justify-between mt-4 mb-4">
            <h2 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Demo</h2>
            <div className="flex items-center gap-2">
              <GreenBtn onClick={copyTranscript} icon={<Copy className="w-4 h-4" />}>Copy</GreenBtn>
              <GreenBtn onClick={clearChat} icon={<RotateCcw className="w-4 h-4" />}>Clear</GreenBtn>
              <GreenBtn onClick={shareTranscript} icon={<Share2 className="w-4 h-4" />}>Share</GreenBtn>
            </div>
          </div>

          {/* CHAT BOX — Movatif only here; theme via CSS vars below */}
          <div className="support-card rounded-[20px] mx-auto animate-[fadeIn_180ms_ease] font-movatif" style={{ maxWidth: 1040 }}>
            <div className="rounded-[20px] support-inner">
              <div className="p-4 sm:p-6">
                {/* messages */}
                <div ref={listRef} className="min-h-[520px] max-h-[62vh] overflow-y-auto custom-scroll">
                  {messages.map((m) => {
                    const isUser = m.role === 'user';
                    return (
                      <div key={m.id} className={`mb-3 ${isUser ? 'flex justify-end' : 'flex items-start gap-2'}`}>
                        {!isUser && (
                          <div className="mt-0.5 w-7 h-7 rounded-full grid place-items-center shrink-0 assistant-avatar">
                            <MessageSquareText className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div
                          className={`px-3 py-2 rounded-lg max-w-[80%] text-sm whitespace-pre-wrap break-words animate-[popIn_140ms_ease] ${isUser ? 'user-bubble' : 'assistant-bubble'}`}
                          style={{ fontFamily: 'inherit' }}
                        >
                          {m.text}
                        </div>
                      </div>
                    );
                  })}

                  {loading && (
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 w-7 h-7 rounded-full grid place-items-center shrink-0 assistant-avatar">
                        <MessageSquareText className="w-3.5 h-3.5" />
                      </div>
                      <div className="px-3 py-2 rounded-lg max-w-[80%] text-sm assistant-bubble" style={{ fontFamily: 'inherit' }}>
                        <TypingDots />
                      </div>
                    </div>
                  )}
                </div>

                {/* input */}
                <div className="pt-5">
                  <div className="flex items-center gap-2 rounded-full pl-4 pr-2 h-[50px] border input-bar transition-shadow" style={{ fontFamily: 'inherit' }}>
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onKey}
                      placeholder="Type your message..."
                      className="flex-1 bg-transparent outline-none text-sm"
                      style={{ color: 'var(--text)', fontFamily: 'inherit' }}
                      onFocus={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.boxShadow = 'var(--input-focus-shadow)')}
                      onBlur={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.boxShadow = 'var(--input-shadow)')}
                    />
                    <button
                      onClick={send}
                      disabled={loading || !input.trim()}
                      className="w-10 h-10 rounded-full grid place-items-center disabled:opacity-50 transition will-change-transform send-btn"
                      style={{ color: '#fff', fontFamily: 'inherit', background: BTN_GREEN }}
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
              <div className="pointer-events-auto px-4 py-2 rounded-full text-sm animate-[popIn_140ms_ease] toast-pill">
                {toast}
              </div>
            </div>
          )}

          {/* THEME VARS + animations (scoped) */}
          <style jsx global>{`
            /* Animations */
            @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes popIn { 0% { opacity: 0; transform: scale(.98); } 100% { opacity: 1; transform: scale(1); } }
            .custom-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
            .custom-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 999px; }
            .custom-scroll::-webkit-scrollbar-track { background: transparent; }

            /* Default (light mode) variables for the support chat scope */
            .support-scope {
              --chat-bg: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
              --chat-ring: rgba(0, 255, 194, 0.10);
              --chat-border: rgba(0, 0, 0, 0.08);
              --chat-shadow: 0 24px 70px rgba(0,0,0,.08), 0 6px 20px rgba(0,0,0,.06), 0 0 0 1px var(--chat-ring);
              --inner-ring: inset 0 0 0 1px rgba(0,0,0,0.04);

              --assistant-bubble-bg: rgba(0,0,0,0.035);
              --assistant-bubble-border: rgba(0,0,0,0.08);

              --user-bubble-bg: rgba(16, 185, 129, 0.10); /* green tint */
              --user-bubble-border: rgba(16, 185, 129, 0.25);

              --avatar-bg: rgba(0, 255, 194, 0.10);
              --avatar-border: rgba(0, 255, 194, 0.22);

              --input-bg: #fff;
              --input-border: rgba(0,0,0,0.10);
              --input-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
              --input-focus-shadow: 0 0 0 2px rgba(16,185,129,0.20);

              --toast-bg: rgba(0,0,0,.75);
              --toast-border: rgba(255,255,255,.18);
            }

            /* Dark mode overrides */
            [data-theme="dark"] .support-scope {
              --chat-bg: radial-gradient(120% 180% at 50% -40%, rgba(0,255,194,.05) 0%, rgba(11,14,15,.96) 42%), linear-gradient(180deg, #0c1012 0%, #0a0d0f 100%);
              --chat-ring: rgba(0, 255, 194, 0.06);
              --chat-border: rgba(0,255,194,.18);
              --chat-shadow: 0 28px 80px rgba(0,0,0,.55), 0 10px 26px rgba(0,0,0,.45), 0 0 0 1px var(--chat-ring);
              --inner-ring: inset 0 0 0 1px rgba(0,255,194,.08);

              --assistant-bubble-bg: rgba(255,255,255,0.035);
              --assistant-bubble-border: rgba(255,255,255,0.08);

              --user-bubble-bg: rgba(0,255,194,0.10);
              --user-bubble-border: rgba(0,255,194,0.22);

              --avatar-bg: rgba(0, 255, 194, 0.08);
              --avatar-border: rgba(0, 255, 194, 0.18);

              --input-bg: rgba(255,255,255,0.02);
              --input-border: rgba(0,255,194,0.18);
              --input-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.28);
              --input-focus-shadow: 0 0 0 2px rgba(0,255,194,0.28);

              --toast-bg: rgba(0,0,0,.65);
              --toast-border: rgba(255,255,255,.14);
            }

            /* Apply the variables */
            .support-card {
              background: var(--chat-bg);
              border: 1px solid var(--chat-border);
              box-shadow: var(--chat-shadow);
            }
            .support-inner { box-shadow: var(--inner-ring); }

            .assistant-avatar {
              background: var(--avatar-bg);
              border: 1px solid var(--avatar-border);
            }
            .assistant-avatar svg { color: var(--brand); }

            .assistant-bubble {
              background: var(--assistant-bubble-bg);
              border: 1px solid var(--assistant-bubble-border);
              color: var(--text);
              box-shadow: var(--shadow-soft);
            }
            .user-bubble {
              background: var(--user-bubble-bg);
              border: 1px solid var(--user-bubble-border);
              color: var(--text);
              box-shadow: var(--shadow-soft);
            }

            .input-bar {
              background: var(--input-bg);
              border-color: var(--input-border);
              box-shadow: var(--input-shadow);
            }

            .toast-pill {
              background: var(--toast-bg);
              border: 1px solid var(--toast-border);
              color: #fff;
            }
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

/* small green button used for Copy / Clear / Share */
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
