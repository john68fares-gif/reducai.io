// pages/support.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { MessageSquare, Trash2, Send as SendIcon, Image as ImageIcon } from 'lucide-react';

type Msg = {
  id: string;
  role: 'assistant' | 'user';
  text?: string;
  // optional image preview url (data url) for UI
  imageDataUrl?: string;
};

const UI = {
  cardBg: 'rgba(13,15,17,0.92)',
  cardBorder: '1px solid rgba(106,247,209,0.18)',
  outerGlow:
    'inset 0 0 16px rgba(0,0,0,0.35), 0 0 22px rgba(106,247,209,0.10), 0 10px 40px rgba(0,0,0,0.40)',
  // bubbles
  aBg: '#0f1314',
  aBorder: '1px solid rgba(255,255,255,0.18)',
  uBg: '#0f3f36',
  uBorder: '1px solid rgba(0,255,194,0.20)',
  // controls
  primary: '#00ffc2',
  primaryHover: '#00eab3',
};

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [attachedImg, setAttachedImg] = useState<string | null>(null); // data URL
  const viewRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // One friendly first message (support + setup)
  useEffect(() => {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text:
          "Hi — I’m Riley. I can help you create a chatbot build, connect your API key, test it, or fix errors. What would you like to do?",
      },
    ]);
  }, []);

  useEffect(() => {
    viewRef.current?.scrollTo({ top: viewRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy]);

  function clearChat() {
    setMessages((m) => m.slice(0, 1)); // keep the greeting
    setAttachedImg(null);
    setText('');
  }

  async function send() {
    const content = text.trim();
    if (!content && !attachedImg) return;
    if (busy) return;

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: 'user',
      text: content || undefined,
      imageDataUrl: attachedImg || undefined,
    };
    setMessages((m) => [...m, userMsg]);
    setText('');
    setAttachedImg(null);
    setBusy(true);

    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // send entire history so the server can keep context
          history: messages.concat(userMsg).map((m) => ({
            role: m.role,
            text: m.text || '',
            imageDataUrl: m.imageDataUrl || null,
          })),
        }),
      });

      let reply = 'Hmm, I could not reach the server. Try again.';
      if (res.ok) {
        const j = await res.json();
        if (j?.reply) reply = j.reply as string;
      }
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: 'assistant', text: reply },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: 'assistant', text: 'Request failed. Please try again.' },
      ]);
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

  function handlePickFile() {
    fileRef.current?.click();
  }
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
    if (!ok) return;
    const reader = new FileReader();
    reader.onload = () => setAttachedImg(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <>
      <Head>
        <title>Support • reduc.ai</title>
      </Head>

      <main className="px-6 py-8 font-movatif">
        {/* Page title (like your other screens) */}
        <div className="max-w-[1320px] mx-auto mb-6">
          <h1 className="text-[28px] md:text-[32px] tracking-tight text-white/90">
            Support Center
          </h1>
          <p className="text-white/60 text-sm mt-1">
            Ask questions, share screenshots of issues, or get step-by-step setup help.
          </p>
        </div>

        {/* Chat card */}
        <div
          className="w-full max-w-[1320px] mx-auto rounded-[20px] overflow-hidden"
          style={{ background: UI.cardBg, border: UI.cardBorder, boxShadow: UI.outerGlow }}
        >
          {/* Header row inside card */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: 'rgba(0,255,194,0.08)',
                  border: '1px solid rgba(0,255,194,0.24)',
                }}
                title="Riley"
              >
                <MessageSquare className="w-4.5 h-4.5 text-[#6af7d1]" />
              </div>
              <div className="leading-tight">
                <div className="text-[18px] md:text-[20px] text-white">
                  Riley <span className="text-white/60">— Support</span>
                </div>
              </div>
            </div>

            <button
              onClick={clearChat}
              className="inline-flex items-center gap-2 h-[34px] px-3 rounded-[12px] text-sm text-white/85 hover:bg-white/5 transition"
              title="Clear conversation"
              style={{ border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>

          {/* Messages viewport */}
          <div
            ref={viewRef}
            className="h-[62vh] min-h-[440px] overflow-y-auto px-5 py-5"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div className="max-w-[980px]">
              {messages.map((m) => (
                <Bubble key={m.id} role={m.role} text={m.text} imageDataUrl={m.imageDataUrl} />
              ))}
              {busy && (
                <Bubble
                  role="assistant"
                  text="Thinking…"
                />
              )}
            </div>
          </div>

          {/* Composer */}
          <div
            className="px-4 py-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}
          >
            <div
              className="flex items-center gap-3 px-3 py-2 rounded-[22px]"
              style={{
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.16)',
              }}
            >
              <button
                onClick={handlePickFile}
                title="Attach screenshot"
                className="shrink-0 w-[40px] h-[40px] rounded-full flex items-center justify-center hover:bg-white/10 transition"
                style={{ border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <ImageIcon className="w-4.5 h-4.5 text-white/85" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFile}
              />

              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type your message…"
                className="flex-1 h-[44px] rounded-[18px] bg-[#0d1011] text-white px-4 outline-none"
                style={{ border: '1px solid rgba(255,255,255,0.12)' }}
              />

              <button
                onClick={send}
                disabled={busy || (!text.trim() && !attachedImg)}
                className="shrink-0 inline-flex items-center gap-2 h-[44px] px-5 rounded-[22px] font-semibold disabled:opacity-50"
                style={{
                  background: UI.primary,
                  color: '#0b0c10',
                  boxShadow: '0 0 10px rgba(106,247,209,0.30)',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = UI.primaryHover)
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = UI.primary)
                }
              >
                <SendIcon className="w-4.5 h-4.5 text-white" />
                Send
              </button>
            </div>

            {/* small preview chip for an attached image */}
            {attachedImg && (
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={attachedImg}
                  alt="attachment"
                  className="w-10 h-10 rounded-md object-cover border border-white/10"
                />
                <div className="text-xs text-white/70">Image attached — will be analyzed.</div>
              </div>
            )}
          </div>
        </div>
      </main>

      <style jsx global>{`
        body { background: #0b0c10; }
      `}</style>
    </>
  );
}

function Bubble({
  role,
  text,
  imageDataUrl,
}: {
  role: 'assistant' | 'user';
  text?: string;
  imageDataUrl?: string | null;
}) {
  const isUser = role === 'user';
  return (
    <div className={`w-full flex ${isUser ? 'justify-start' : 'justify-start'} mb-3`}>
      <div
        className="px-4 py-2 rounded-[16px] max-w-[880px] text-[14px] leading-relaxed"
        style={{
          background: isUser ? UI.uBg : UI.aBg,
          border: isUser ? UI.uBorder : UI.aBorder,
          color: 'rgba(255,255,255,0.92)',
        }}
      >
        {imageDataUrl && (
          <div className="mb-2">
            <img
              src={imageDataUrl}
              alt="attached"
              className="max-h-[220px] rounded-md border border-white/10"
            />
          </div>
        )}
        {text}
      </div>
    </div>
  );
}
