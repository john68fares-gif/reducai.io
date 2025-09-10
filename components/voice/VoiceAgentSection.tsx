'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, KeyRound, ChevronDown, Phone, FileText, Headphones } from 'lucide-react';
import WebCallButton from './WebCallButton';

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

const DEFAULT_PROMPT = `[Identity]
You are a versatile AI assistant equipped to handle a wide range of tasks, offering helpful and intelligent support to users.

[Style]
- Maintain a professional and polite tone.
- Use clear and concise language.
- Be adaptable to different conversational styles as required.

[Response Guidelines]
- Provide responses that are direct and relevant to the user's inquiry.
- Limit responses to essential information to maintain engagement.
- Format dates as Month Day, Year (e.g., January 15, 2024) if needed.

[Task & Goals]
1. Engage with the user by acknowledging their message.
2. Assess the request or question to understand the user’s needs.
3. Provide accurate and relevant information or assistance.
4. Wait for user confirmation or further queries before proceeding.
5. Offer additional assistance if the task is incomplete or the user requests more help.

[Error Handling / Fallback]
- Politely ask for clarification if the user’s input is unclear.
- Provide a gentle apology and request for repetition in case of errors.
- If an error occurs, inform the user and guide them back to a previous step or suggest alternative actions.`;

export default function VoiceAgent() {
  const [model, setModel] = useState('gpt-4o-mini');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);
  const [greet, setGreet] = useState('Hello. How may I help you today?');
  const [voiceLabel, setVoiceLabel] = useState('Alloy');
  const [key, setKey] = useState<string>('');
  const [openKeyMenu, setOpenKeyMenu] = useState(false);
  const [turns, setTurns] = useState<{role:'user'|'assistant'; text:string; ts:number}[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('voice:openaiKey') || '';
    setKey(saved);
  }, []);

  const last4 = key ? key.slice(-4) : '';

  function importKey(k: string) {
    const v = (k || '').trim();
    if (!v) return;
    localStorage.setItem('voice:openaiKey', v);
    setKey(v);
    setOpenKeyMenu(false);
  }
  function clearKey() {
    localStorage.removeItem('voice:openaiKey');
    setKey('');
    setOpenKeyMenu(false);
  }

  function onTurn(role:'user'|'assistant', text:string) {
    setTurns(t => [...t, { role, text, ts: Date.now() }]);
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 bg-[rgba(255,255,255,.03)] dark:bg-neutral-900 rounded-xl border border-neutral-200/60 dark:border-white/10 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Headphones className="w-4 h-4 text-emerald-500" />
          <span className="font-medium">Voice Agent</span>
        </div>

        <div className="relative">
          <button
            onClick={()=> setOpenKeyMenu(v=>!v)}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200/60 dark:border-white/10 px-3 py-1.5 text-sm bg-white dark:bg-neutral-950 hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            <KeyRound className="w-4 h-4 text-emerald-500" />
            {key ? <>OpenAI Key ••••{last4}</> : 'Import OpenAI Key'}
            <ChevronDown className="w-4 h-4 opacity-70" />
          </button>

          {openKeyMenu && (
            <div
              className="absolute right-0 mt-2 w-72 rounded-lg border border-neutral-200/60 dark:border-white/10 bg-white dark:bg-neutral-950 shadow-xl p-3 z-10"
            >
              <div className="text-xs mb-1 opacity-70">Paste your key (starts with <code>sk-</code>)</div>
              <input
                type="password"
                placeholder="sk-..."
                className="w-full rounded-md border border-neutral-200/60 dark:border-white/10 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm outline-none"
                onKeyDown={(e)=> {
                  if (e.key==='Enter') importKey((e.target as HTMLInputElement).value);
                }}
              />
              <div className="mt-2 flex items-center gap-2 justify-end">
                {key && (
                  <button onClick={clearKey} className="text-xs px-2 py-1 rounded-md border border-red-300/40 text-red-500 hover:bg-red-50/50">
                    Remove Saved Key
                  </button>
                )}
                <button
                  onClick={()=>{
                    const v = (document.activeElement as HTMLInputElement)?.value || '';
                    importKey(v);
                  }}
                  className="text-xs px-2 py-1 rounded-md bg-emerald-500 text-white"
                >
                  Save Key
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-200/60 dark:border-white/10 p-3 bg-white dark:bg-neutral-950">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <FileText className="w-4 h-4 text-emerald-500" /> System Prompt
          </div>
          <textarea
            rows={14}
            value={systemPrompt}
            onChange={(e)=> setSystemPrompt(e.target.value)}
            className="w-full text-sm rounded-lg border border-neutral-200/60 dark:border-white/10 bg-white dark:bg-neutral-900 p-2 outline-none"
          />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <div className="text-xs mb-1 opacity-70">Model</div>
              <select
                value={model}
                onChange={(e)=> setModel(e.target.value)}
                className="w-full text-sm rounded-lg border border-neutral-200/60 dark:border-white/10 bg-white dark:bg-neutral-900 p-2 outline-none"
              >
                {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs mb-1 opacity-70">First Message</div>
              <input
                value={greet}
                onChange={(e)=> setGreet(e.target.value)}
                className="w-full text-sm rounded-lg border border-neutral-200/60 dark:border-white/10 bg-white dark:bg-neutral-900 p-2 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200/60 dark:border-white/10 p-3 bg-white dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Phone className="w-4 h-4 text-emerald-500" /> Web Call (mic + TTS)
            </div>
            <div className="text-xs opacity-70">{key ? 'Key connected' : 'No key — local fallback replies only'}</div>
          </div>

          <div className="mt-2">
            <WebCallButton
              greet={greet}
              voiceLabel={'Alloy'}
              model={model}
              systemPrompt={systemPrompt}
              onTurn={onTurn}
            />
          </div>

          <div className="mt-3 h-[280px] overflow-auto rounded-lg border border-neutral-200/60 dark:border-white/10 bg-white dark:bg-neutral-900 p-2 space-y-2">
            {turns.length === 0 && <div className="text-sm opacity-60">No transcript yet.</div>}
            {turns.map((t, i) => (
              <div key={i} className="text-sm">
                <span className="px-2 py-0.5 mr-2 rounded-full border border-neutral-200/60 dark:border-white/10 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {t.role === 'assistant' ? 'AI' : 'You'}
                </span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tiny footer actions */}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={()=> setSystemPrompt(DEFAULT_PROMPT)}
          className="inline-flex items-center gap-2 text-sm rounded-lg border border-neutral-200/60 dark:border-white/10 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-900"
        >
          <Sparkles className="w-4 h-4 text-emerald-500" /> Reset Prompt
        </button>
      </div>
    </div>
  );
}
