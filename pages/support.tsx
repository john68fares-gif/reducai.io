// pages/support.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import {
  HelpCircle, BookOpen, MessageSquare, ChevronDown, FileText, Video, Shield, Send, CornerDownLeft,
} from 'lucide-react';

/* ---------- utils ---------- */
const isBrowser = typeof window !== 'undefined';
const cn = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

/* ---------- Simple styles to fit your dark / glow UI ---------- */
const FRAME: React.CSSProperties = {
  background: 'rgba(13,15,17,0.95)',
  border: '2px dashed rgba(106,247,209,0.30)',
  boxShadow: '0 0 40px rgba(0,0,0,0.7)',
  borderRadius: 24,
};
const CARD: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.30)',
  borderRadius: 18,
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 10px 40px rgba(0,0,0,0.35)',
};

/* ---------- Tiny Accordion ---------- */
function AccordionItem({
  title, icon, children, defaultOpen = false,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement | null>(null);

  return (
    <div style={CARD} className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2 text-white font-semibold">
          {icon} <span>{title}</span>
        </div>
        <ChevronDown
          className={cn('w-5 h-5 text-white/80 transition-transform', open && 'rotate-180')}
        />
      </button>
      <div
        ref={contentRef}
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          display: 'grid',
          transition: 'grid-template-rows 240ms ease',
        }}
      >
        <div className="min-h-0">
          <div className="px-5 pb-5 pt-1 text-white/85 text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Local storage readers (safe)
   =========================== */

type StoredKey = { id: string; name: string; key: string; createdAt: number };
type Chatbot = {
  id: string;
  name?: string;
  description?: string;
  provider?: 'openai'|'anthropic'|'google'|string;
  model?: string;
};

function loadApiKeys(): StoredKey[] {
  if (!isBrowser) return [];
  try { return JSON.parse(localStorage.getItem('apiKeys.v1') || '[]') || []; } catch { return []; }
}
function getSelectedKeyId(): string | null {
  if (!isBrowser) return null;
  try { return localStorage.getItem('apiKeys.selectedId'); } catch { return null; }
}
function resolveApiKey(): StoredKey | null {
  const list = loadApiKeys();
  if (!list.length) return null;
  const sel = getSelectedKeyId();
  if (sel) {
    const found = list.find(k => k.id === sel);
    if (found) return found;
  }
  return [...list].sort((a,b) => b.createdAt - a.createdAt)[0] ?? null;
}
function readAllChatbots(): Chatbot[] {
  if (!isBrowser) return [];
  try {
    const bots = JSON.parse(localStorage.getItem('chatbots') || '[]');
    return Array.isArray(bots) ? bots : [];
  } catch { return []; }
}
function readPublishedIds(): string[] {
  if (!isBrowser) return [];
  try {
    const raw = localStorage.getItem('support:publishedAgentIds') || '';
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  } catch { return []; }
}

/* ===========================
   Helpdesk assistants block
   =========================== */

function useSupportAgents() {
  const [agents, setAgents] = useState<Chatbot[]>([]);
  const [published, setPublished] = useState<string[]>([]);

  useEffect(() => {
    // load once on client
    setAgents(readAllChatbots());
    setPublished(readPublishedIds());
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'chatbots') setAgents(readAllChatbots());
      if (e.key === 'support:publishedAgentIds') setPublished(readPublishedIds());
    };
    if (isBrowser) {
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
  }, []);

  const list = useMemo(() => {
    if (!published.length) return agents; // show all until curated
    const allow = new Set(published);
    return agents.filter(a => a.id && allow.has(a.id));
  }, [agents, published]);

  return list;
}

/** Minimal chat UI that calls YOUR backend. Backend should read server-side key or use the selected local key if you choose to pass it. */
function LocalAgentChat({ agent }: { agent: Chatbot }) {
  type Msg = { role: 'user' | 'assistant' | 'system'; content: string };
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Hi — ask me anything about the platform. I answer short and clearly.' }
  ]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyInfo, setKeyInfo] = useState<StoredKey | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const provider = agent.provider || 'openai';
  const model = agent.model || 'gpt-4o-mini';

  useEffect(() => {
    // safe on client
    setKeyInfo(resolveApiKey());
  }, []);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    setText('');
    const next = [...messages, { role: 'user', content } as Msg];
    setMessages(next);
    setBusy(true);

    const payload: any = {
      agentId: agent.id,
      provider,
      model,
      messages: next,
    };

    // If you want to test with the locally stored key (client-side only), uncomment:
    // if (keyInfo?.key) payload._clientKey = keyInfo.key;

    let reply: string | null = null;

    // Try /api/agents/chat
    try {
      const r1 = await fetch('/api/agents/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (r1.ok) {
        const j = await r1.json();
        reply = j?.reply || j?.message || j?.text || null;
      }
    } catch {}

    // Fallback /api/agents
    try {
      if (!reply) {
        const r2 = await fetch('/api/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (r2.ok) {
          const j = await r2.json();
          reply = j?.reply || j?.message || j?.text || null;
        }
      }
    } catch {}

    if (!reply) {
      reply = keyInfo
        ? 'Backend not wired yet. Point this UI to /api/agents/chat and read the key server-side.'
        : 'No API key found. Add one on the API Keys page.';
    }

    setMessages(m => [...m, { role: 'assistant', content: reply! }]);
    setBusy(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="rounded-xl border border-white/15 bg-black/20">
      {!keyInfo && (
        <div className="px-3 py-2 text-xs text-yellow-300/80 border-b border-white/10">
          No API key found. Add one on <a href="/apikeys" className="underline">API Keys</a>.
        </div>
      )}
      <div
        ref={boxRef}
        className="h-[360px] overflow-y-auto px-3 py-3 space-y-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {messages.map((m, i) => (
          <div key={i} className="flex">
            <div
              className={cn(
                'max-w-[86%] text-sm px-3 py-2 rounded-lg',
                m.role === 'user'
                  ? 'bg-[#0f4136] text-[#d9fff5]'
                  : 'bg-[#0f1314] text-white/90 border border-white/10'
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="p-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your message…"
          className="flex-1 h-[40px] rounded-[12px] border border-white/20 bg-black/40 px-3 text-white outline-none focus:border-[#6af7d1]"
        />
        <button
          onClick={send}
          disabled={busy}
          className="inline-flex items-center gap-2 h-[40px] px-3 rounded-[12px]"
          style={{ background: '#59d9b3', color: '#0b0c10', opacity: busy ? 0.7 : 1 }}
          title="Send"
        >
          <CornerDownLeft className="w-4 h-4" />
          Send
        </button>
      </div>
    </div>
  );
}

function HelpdeskAssistantsBlock() {
  const agents = useSupportAgents();
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (!agents.length) return;
    setSelectedId(prev => prev || agents[agents.length - 1].id);
  }, [agents.length]);

  const current = useMemo(
    () => agents.find(a => a.id === selectedId) || null,
    [agents, selectedId]
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <label className="text-white/80 text-sm">Choose an Assistant</label>
        <select
          value={selectedId}
          onChange={(e)=>setSelectedId(e.target.value)}
          className="w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-white outline-none focus:border-[#6af7d1]"
        >
          {agents.length ? (
            agents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || `Agent ${p.id.slice(0, 6)}`}
              </option>
            ))
          ) : (
            <option value="">No assistants found (create one in Builder)</option>
          )}
        </select>
        <div className="text-xs text-white/60">
          Admin tip: to curate which agents show here, set
          {' '}
          <code className="text-white/80">localStorage.support:publishedAgentIds</code>
          {' '}
          to a comma-separated list of agent ids.
        </div>
      </div>

      {current ? (
        <LocalAgentChat agent={current} />
      ) : (
        <div className="rounded-xl border border-white/15 bg-black/20 p-3 text-white/70">
          Pick an assistant to start chatting.
        </div>
      )}

      <div className="mt-3 text-white/70 text-sm">
        Still stuck? Email: <span className="italic">add this later</span>
      </div>
    </div>
  );
}

/* ---------- Support Page (client-only) ---------- */
function SupportPageInner() {
  const [hfEmail, setHfEmail] = useState('');
  const [hfSubject, setHfSubject] = useState('');
  const [hfMsg, setHfMsg] = useState('');
  const [hfSaved, setHfSaved] = useState('');

  function saveHelpForm() {
    if (!isBrowser) return;
    const rec = {
      at: new Date().toISOString(),
      email: hfEmail.trim(),
      subject: hfSubject.trim(),
      message: hfMsg.trim(),
    };
    const key = 'support:helpFormDrafts';
    let arr: any[] = [];
    try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
    arr.unshift(rec);
    localStorage.setItem(key, JSON.stringify(arr.slice(0, 50)));
    setHfSaved('Saved locally. (Add backend/email later.)');
    setTimeout(() => setHfSaved(''), 1800);
    setHfMsg('');
  }

  return (
    <>
      <Head><title>Support • reduc.ai</title></Head>

      <main className="px-6 py-10" style={{ maxWidth: 980, margin: '0 auto' }}>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
          <HelpCircle className="w-6 h-6 text-[#6af7d1]" /> Support
        </h1>

        <div style={FRAME} className="p-5 space-y-4">
          {/* GUIDE */}
          <AccordionItem
            title="Guide (how the site works)"
            icon={<BookOpen className="w-5 h-5 text-[#6af7d1]" />}
            defaultOpen
          >
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li><b>Builder</b>: create your AI (Sales / Support / Blank). Fill Personality & Knowledge.</li>
              <li><b>Voice Agent</b>: choose a build → add Twilio SID/Token → select/attach number.</li>
              <li><b>Improve</b>: edit the prompt, keep replies short, ask one question at a time.</li>
              <li><b>Test</b>: use Quick Tests or the widget to try real queries.</li>
              <li><b>Launch</b>: share the link / connect to your calls.</li>
            </ol>
            <div className="mt-3 text-white/70 text-sm italic">add this later</div>
          </AccordionItem>

          {/* HELP DESK ASSISTANTS */}
          <AccordionItem
            title="AI Helpline (chat with our site assistant)"
            icon={<MessageSquare className="w-5 h-5 text-[#6af7d1]" />}
          >
            <HelpdeskAssistantsBlock />
          </AccordionItem>

          {/* FAQ */}
          <AccordionItem
            title="FAQ"
            icon={<FileText className="w-5 h-5 text-[#6af7d1]" />}
          >
            <div className="space-y-2 text-sm">
              <p className="text-white/70 italic">add this later</p>
            </div>
          </AccordionItem>

          {/* HELP FORM */}
          <AccordionItem
            title="Help form (quick message to us)"
            icon={<Send className="w-5 h-5 text-[#6af7d1]" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <input
                value={hfEmail}
                onChange={(e)=>setHfEmail(e.target.value)}
                placeholder="your email (optional)"
                className="w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-white outline-none focus:border-[#6af7d1]"
              />
              <input
                value={hfSubject}
                onChange={(e)=>setHfSubject(e.target.value)}
                placeholder="subject"
                className="w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-white outline-none focus:border-[#6af7d1]"
              />
              <textarea
                value={hfMsg}
                onChange={(e)=>setHfMsg(e.target.value)}
                placeholder="describe the issue (short & clear)"
                rows={5}
                className="md:col-span-2 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 py-2 text-white outline-none focus:border-[#6af7d1] resize-y"
              />
              <div className="md:col-span-2 flex items-center gap-3">
                <button
                  onClick={saveHelpForm}
                  className="inline-flex items-center justify-center gap-2 px-4 h-[38px] rounded-[12px] text-sm"
                  style={{ background:'#59d9b3', color:'#fff' }}
                >
                  Save (local for now)
                </button>
                {!!hfSaved && <span className="text-xs text-white/60">{hfSaved}</span>}
                <span className="text-xs text-white/50 ml-auto">
                  (Hook this to email/DB later.)
                </span>
              </div>
            </div>
          </AccordionItem>

          {/* VIDEO */}
          <AccordionItem
            title="Video tutorial"
            icon={<Video className="w-5 h-5 text-[#6af7d1]" />}
          >
            <div className="text-sm text-white/80">
              <div className="rounded-xl border border-white/15 bg-black/20 p-4">
                <div className="text-white/70 italic">add this later</div>
              </div>
            </div>
          </AccordionItem>

          {/* POLICY */}
          <AccordionItem
            title="Policy"
            icon={<Shield className="w-5 h-5 text-[#6af7d1]" />}
          >
            <div className="text-sm text-white/80">
              <p className="text-white/70 italic">add this later</p>
            </div>
          </AccordionItem>
        </div>
      </main>

      <style jsx global>{`
        body { background:#0b0c10; }
      `}</style>
    </>
  );
}

/* Export the page with SSR disabled so localStorage is safe at build time */
export default dynamic(() => Promise.resolve(SupportPageInner), { ssr: false });
