// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, History, Send, Sparkles, Save, RotateCcw, Copy, Trash2,
  ChevronDown, ChevronUp, X, Check, Wand2, Plus
} from 'lucide-react';

/* =========================================================
   THEME HELPERS
   ========================================================= */
const BRAND = '#00ffc2';
const card = 'bg-[rgba(13,15,17,0.92)] border border-[rgba(0,255,194,0.18)] shadow-[inset_0_0_22px_rgba(0,0,0,0.28),0_10px_30px_rgba(0,255,194,0.06)] rounded-2xl';
const btn = 'px-3.5 h-9 rounded-xl font-medium hover:brightness-110 active:scale-[.99] transition';
const btnGreen = `${btn} bg-[${BRAND}] text-black`;
const btnGhost = `${btn} bg-white/5 text-white border border-white/10`;
const label = 'text-xs uppercase tracking-wider text-white/60';

/* =========================================================
   TYPES
   ========================================================= */
type Version = {
  id: string;
  title: string;
  createdAt: number;
  prompt: string;
};

type ChatMsg = { role: 'user'|'assistant'|'system'; content: string };

/* =========================================================
   STORAGE KEYS (scoped)
   ========================================================= */
const K_SCOPE           = 'improve';
const K_VERSIONS        = `${K_SCOPE}:versions.v1`;
const K_ACTIVE_VERSION  = `${K_SCOPE}:activeVersionId.v1`;
const K_CHAT            = `${K_SCOPE}:chat.v1`;

/* =========================================================
   UTILS
   ========================================================= */
// Remove stray ** from markdown-y prompts
function cleanPrompt(p: string) {
  return p.replace(/\*\*/g, '');
}
function nowId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

// Heuristic title if no AI route available
function inferTitleFromPrompt(prompt: string) {
  const firstLine = prompt.split('\n').map(s => s.trim()).find(Boolean) || '';
  const tags = [];
  if (/sales|convert|lead/i.test(prompt)) tags.push('Sales');
  if (/support|help|faq/i.test(prompt)) tags.push('Support');
  if (/neutral|template|versatile/i.test(prompt)) tags.push('Template');
  const head = firstLine.replace(/[\[\]]/g,'').slice(0,40);
  const tagStr = tags.length ? ` • ${tags.join(' / ')}` : '';
  return (head || 'Updated Prompt') + tagStr;
}

// Try your API first, fallback to heuristic
async function nameWithAI(prompt: string): Promise<string> {
  try {
    const r = await fetch('/api/ai/name', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ prompt })
    });
    if (r.ok) {
      const j = await r.json();
      const t = (j?.title || '').toString().trim();
      if (t) return t;
    }
  } catch {}
  return inferTitleFromPrompt(prompt);
}

/* =========================================================
   DEFAULT BASE PROMPT (from your spec)
   ========================================================= */
function buildBasePrompt(name: string, goal: string) {
  return cleanPrompt(
`[Identity]
You are ${name || 'a blank template AI assistant'} with minimal default settings, designed to be easily customizable for various use cases.

[Style]
- Maintain a neutral and adaptable tone suitable for a wide range of contexts.
- Use clear and concise language to ensure effective communication.

[Response Guidelines]
- Avoid using any specific jargon or domain-specific language unless the user explicitly asks.
- Keep responses straightforward and focused on the task at hand.

[Task & Goals]
1. ${goal || 'Serve as a versatile agent ready to be tailored for different roles based on user instructions.'}
2. Allow users to modify model parameters (temperature, messages, and other settings) as needed.
3. Reflect adjustments in real time to adapt to the current context.

[Error Handling / Fallback]
- Ask for clarification when inputs are vague or unclear.
`);
}

/* =========================================================
   HOOKS: persisted state
   ========================================================= */
function useLocalJSON<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal] as const;
}

/* =========================================================
   MAIN
   ========================================================= */
export default function ImprovePage() {
  // Layout: full-viewport workspace that doesn't scroll the page
  // Panels themselves handle scroll (overflow-auto)
  const [versions, setVersions] = useLocalJSON<Version[]>(K_VERSIONS, []);
  const [activeId, setActiveId] = useLocalJSON<string | null>(K_ACTIVE_VERSION, null);
  const active = useMemo(() => versions.find(v => v.id === activeId) || null, [versions, activeId]);

  const [chat, setChat] = useLocalJSON<ChatMsg[]>(K_CHAT, []);
  const [userText, setUserText] = useState('');

  // Modal for Generate AI
  const [showGenerate, setShowGenerate] = useState(false);
  const [genName, setGenName] = useState('');
  const [genGoal, setGenGoal] = useState('');

  // Editor state
  const [draft, setDraft] = useState<string>(active?.prompt || '');

  // Keep editor in sync when switching versions
  useEffect(() => { setDraft(active?.prompt || ''); }, [activeId]);

  // Seed first version if none exists
  useEffect(() => {
    if (!versions.length) {
      const id = nowId();
      const v: Version = {
        id,
        title: 'Initial Template',
        createdAt: Date.now(),
        prompt: buildBasePrompt('a blank template AI assistant', '')
      };
      setVersions([v]);
      setActiveId(id);
      setDraft(v.prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveNewVersion = async () => {
    const cleaned = cleanPrompt(draft || '');
    const title = await nameWithAI(cleaned);
    const v: Version = {
      id: nowId(),
      title,
      createdAt: Date.now(),
      prompt: cleaned
    };
    setVersions(prev => [v, ...prev]);
    setActiveId(v.id);
  };

  const rollbackTo = (id: string) => {
    const v = versions.find(x => x.id === id);
    if (!v) return;
    setActiveId(v.id);
    setDraft(v.prompt);
  };

  const deleteVersion = (id: string) => {
    setVersions(prev => prev.filter(v => v.id !== id));
    if (activeId === id) {
      const next = versions.find(v => v.id !== id) || null;
      setActiveId(next?.id || null);
      setDraft(next?.prompt || '');
    }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(draft || '');
    } catch {}
  };

  const sendUser = () => {
    const t = userText.trim();
    if (!t) return;
    const next = [...chat, { role:'user', content:t } as ChatMsg];

    // Simple local echo assistant; replace with your real /api/chat if you want
    const reply = emulateAssistantReply(draft, t);
    const next2 = [...next, { role:'assistant', content: reply } as ChatMsg];

    setChat(next2);
    setUserText('');
  };

  const headerBorder = 'border-b border-white/[.06] bg-[rgba(8,10,12,0.75)] backdrop-blur';

  return (
    <div className="fixed inset-0 grid" style={{ gridTemplateRows: '56px 1fr', background: 'radial-gradient(1200px 600px at 20% -10%, rgba(0,255,194,.06), transparent), #0b0c10' }}>
      {/* Header */}
      <header className={`${headerBorder} flex items-center px-4 gap-2`}>
        <div className="flex items-center gap-2 text-white/80">
          <Bot size={18} className="opacity-80" />
          <span className="font-medium">Improve Studio</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className={btnGhost} onClick={() => setShowGenerate(true)}>
            <Sparkles size={16} className="mr-2" /> Generate AI
          </button>
          <button className={btnGreen} onClick={saveNewVersion}>
            <Save size={16} className="mr-2" /> Save as Version
          </button>
        </div>
      </header>

      {/* Workspace: left rail (versions), center (prompt editor), right (chat test, largest) */}
      <div className="grid h-full gap-3 p-3 overflow-hidden" style={{ gridTemplateColumns: '280px 520px 1fr' }}>
        {/* Versions Rail */}
        <section className={`${card} overflow-hidden flex flex-col`}>
          <div className="p-3 pb-2"><div className={label}>Versions</div></div>
          <div className="px-3 pb-3">
            <button className={`${btnGreen} w-full`} onClick={async () => {
              const v: Version = {
                id: nowId(),
                title: 'New Draft',
                createdAt: Date.now(),
                prompt: buildBasePrompt('', '')
              };
              setVersions(prev => [v, ...prev]);
              setActiveId(v.id);
              setDraft(v.prompt);
            }}>
              <Plus size={16} className="mr-2" /> New Draft
            </button>
          </div>
          <div className="flex-1 overflow-auto px-2 pb-2 space-y-2">
            {versions.map(v => {
              const active = v.id === activeId;
              return (
                <div
                  key={v.id}
                  className={`p-3 ${active ? 'border-[2px] border-[rgba(0,255,194,0.55)]' : 'border border-white/10'} rounded-xl bg-white/5 hover:bg-white/[.07] transition`}
                >
                  <div className="text-sm font-medium line-clamp-1">{v.title}</div>
                  <div className="text-[11px] text-white/50">{fmtDate(v.createdAt)}</div>
                  <div className="mt-2 flex gap-1.5">
                    <button className={`${btnGhost} h-8`} onClick={() => { setActiveId(v.id); setDraft(v.prompt); }}>
                      <History size={14} className="mr-1.5" /> Open
                    </button>
                    <button className={`${btnGhost} h-8`} onClick={() => rollbackTo(v.id)}>
                      <RotateCcw size={14} className="mr-1.5" /> Rollback
                    </button>
                    <button className="h-8 px-2 rounded-lg bg-white/5 text-white/70 border border-white/10 hover:bg-red-500/10 hover:text-red-300"
                            onClick={() => deleteVersion(v.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {!versions.length && (
              <div className="text-xs text-white/50 px-2">No versions yet. Click <b>New Draft</b> to begin.</div>
            )}
          </div>
        </section>

        {/* Prompt Editor (scrolls inside) */}
        <section className={`${card} overflow-hidden flex flex-col`}>
          <div className="p-3 pb-2"><div className={label}>Prompt</div></div>
          <div className="flex-1 overflow-auto p-3">
            <textarea
              className="w-full h-[calc(100%-0px)] min-h-[420px] resize-none bg-black/30 border border-white/10 rounded-xl p-3 text-sm leading-6 text-white/90 outline-none focus:border-[rgba(0,255,194,0.6)]"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="[Identity] ..."
            />
          </div>
          <div className="p-3 border-t border-white/10 flex items-center gap-2">
            <button className={btnGhost} onClick={copyPrompt}><Copy size={16} className="mr-2" /> Copy</button>
            <button className={btnGreen} onClick={saveNewVersion}><Save size={16} className="mr-2" /> Save Version</button>
          </div>
        </section>

        {/* Test Chat (largest) */}
        <section className={`${card} overflow-hidden flex flex-col`}>
          <div className="p-3 pb-2 flex items-center justify-between">
            <div>
              <div className={label}>Test the AI</div>
              <div className="text-[11.5px] text-white/60">Uses your current prompt preview (cleaned of **)</div>
            </div>
            <div className="flex items-center gap-2">
              <button className={btnGhost} onClick={() => setChat([])}><RotateCcw size={14} className="mr-2" /> Reset</button>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-3 pb-3 space-y-8">
            {chat.length === 0 && (
              <div className="text-white/50 text-sm px-1">Start chatting with your agent to validate tone and behavior.</div>
            )}
            {chat.map((m, i) => (
              <div key={i} className={`max-w-[88%] ${m.role === 'user' ? 'ml-auto' : ''}`}>
                <div className={`px-3 py-2 rounded-xl border text-sm leading-6 ${
                  m.role === 'user'
                    ? 'bg-[rgba(0,255,194,0.1)] border-[rgba(0,255,194,0.25)]'
                    : 'bg-white/5 border-white/10'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <input
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                onKeyDown={(e) => (e.key === 'Enter' && !e.shiftKey ? (e.preventDefault(), sendUser()) : null)}
                placeholder="Ask something…"
                className="flex-1 h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm outline-none focus:border-[rgba(0,255,194,0.6)]"
              />
              <button className={btnGreen} onClick={sendUser}><Send size={16} className="mr-2" /> Send</button>
            </div>
          </div>
        </section>
      </div>

      {/* Generate AI overlay */}
      {showGenerate && (
        <div className="fixed inset-0 grid place-items-center z-50" style={{ background:'rgba(0,0,0,.6)' }}>
          <div className={`${card} p-4 w-[520px]`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Generate Base Prompt</div>
              <button className="p-1.5 rounded-lg hover:bg-white/10" onClick={() => setShowGenerate(false)}>
                <X size={16} className="text-white/70" />
              </button>
            </div>
            <div className="grid gap-3">
              <div>
                <div className={label}>Agent Name</div>
                <input
                  className="mt-1 w-full h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm outline-none focus:border-[rgba(0,255,194,0.6)]"
                  value={genName} onChange={e=>setGenName(e.target.value)} placeholder="e.g., Neutral Assistant"
                />
              </div>
              <div>
                <div className={label}>Primary Goal</div>
                <input
                  className="mt-1 w-full h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm outline-none focus:border-[rgba(0,255,194,0.6)]"
                  value={genGoal} onChange={e=>setGenGoal(e.target.value)} placeholder="e.g., Answer questions clearly and concisely"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button className={btnGhost} onClick={()=>setShowGenerate(false)}>Cancel</button>
              <button
                className={btnGreen}
                onClick={()=>{
                  const base = buildBasePrompt(genName, genGoal);
                  setDraft(base);
                  setShowGenerate(false);
                }}
              >
                <Sparkles size={16} className="mr-2" /> Use Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SIMPLE LOCAL ASSISTANT (replace with your real API)
   ========================================================= */
function emulateAssistantReply(prompt: string, user: string) {
  const cleaned = cleanPrompt(prompt);
  // Tiny behavior: mirror guidance from the prompt
  if (/neutral|concise|clear/i.test(cleaned)) {
    return summarize(user);
  }
  return `Based on current rules, here's a direct response:\n${summarize(user)}`;
}

function summarize(text: string) {
  // very small heuristic "make it concise"
  let t = text.trim();
  t = t.replace(/\s+/g, ' ');
  if (t.length > 220) t = t.slice(0, 200) + '…';
  return t;
}
