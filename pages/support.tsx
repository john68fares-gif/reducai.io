// pages/support.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';

type Msg = { id: string; role: 'user' | 'assistant'; text: string };

const sanitize = (text: string) =>
  text
    .replace(/\*\*/g, '')
    .replace(/```[\s\S]*?```/g, '[redacted]')
    .replace(/`([^`]+)`/g, '$1');

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: "Hi, I’m Riley. How can I help you today?",
    },
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
      const r = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: value }),
      });
      const data = await r.json();
      const botText =
        (data?.ok && typeof data?.message === 'string' ? data.message : 'Sorry, I can’t comply with that request.');

      const assistantMsg: Msg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: sanitize(botText),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') send();
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.rileyDot} />
          <span>Riley Support</span>
        </div>

        <div ref={listRef} style={styles.list}>
          {messages.map(m => (
            <div key={m.id} style={m.role === 'user' ? styles.rowUser : styles.rowBot}>
              <div style={m.role === 'user' ? styles.bubbleUser : styles.bubbleBot}>
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <div style={styles.rowBot}>
              <div style={styles.bubbleBot}>
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        <div style={styles.inputRow}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask Riley…"
            style={styles.input}
          />
          <button onClick={send} disabled={loading || !input.trim()} style={styles.button}>
            Send
          </button>
        </div>

        <div style={styles.note}>
          Riley will never reveal or summarize code, file contents, or paths. If asked, Riley will refuse.
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={styles.dotsWrap} aria-label="Riley is thinking">
      <span style={{ ...styles.dot, animationDelay: '0ms' }} />
      <span style={{ ...styles.dot, animationDelay: '120ms' }} />
      <span style={{ ...styles.dot, animationDelay: '240ms' }} />
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    background: 'radial-gradient(1200px 600px at 20% -10%, rgba(0,255,194,0.12), transparent), #0b0c10',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 920,
    background: '#0d0f11',
    border: '1px dashed rgba(0,255,194,0.25)',
    boxShadow: '0 0 40px rgba(0,255,194,0.12)',
    borderRadius: 24,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 18,
    color: '#e6fff7',
  },
  rileyDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: 'rgba(0,255,194,0.9)',
    boxShadow: '0 0 12px rgba(0,255,194,0.8)',
  },
  list: {
    flex: 1,
    minHeight: 360,
    maxHeight: '60vh',
    overflowY: 'auto',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  rowUser: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  rowBot: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  bubbleUser: {
    background: 'linear-gradient(180deg, rgba(0,255,194,0.25), rgba(0,255,194,0.12))',
    border: '1px solid rgba(0,255,194,0.35)',
    color: '#dffef6',
    padding: '10px 12px',
    borderRadius: 14,
    maxWidth: '80%',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  bubbleBot: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e5f9f3',
    padding: '10px 12px',
    borderRadius: 14,
    maxWidth: '80%',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    paddingTop: 6,
  },
  input: {
    flex: 1,
    background: '#0b0c10',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e6fff7',
    padding: '12px 14px',
    borderRadius: 12,
    outline: 'none',
  },
  button: {
    background: 'rgba(0,255,194,0.15)',
    border: '1px solid rgba(0,255,194,0.4)',
    color: '#dffef6',
    padding: '12px 16px',
    borderRadius: 12,
    cursor: 'pointer',
  },
  note: {
    fontSize: 12,
    opacity: 0.65,
    textAlign: 'center',
    paddingTop: 4,
    color: '#c7efe6',
  },
  dotsWrap: {
    display: 'inline-flex',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: 'rgba(230,255,247,0.95)',
    display: 'inline-block',
    animation: 'riley-bounce 900ms infinite ease-in-out',
  } as React.CSSProperties,
};

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('riley-bounce-style')) {
  const style = document.createElement('style');
  style.id = 'riley-bounce-style';
  style.innerHTML = `
  @keyframes riley-bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: .5; }
    40% { transform: translateY(-6px); opacity: 1; }
  }`;
  document.head.appendChild(style);
}
