// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import {
  Settings as Cog,
  Mic,
  MessageSquareText as TranscriberIcon,
  Wrench as ToolsIcon,
  Activity as AnalysisIcon,
  SlidersHorizontal as AdvancedIcon,
  Globe as WidgetIcon,
  Wand2,
  Save as SaveIcon,
  RefreshCw,
  ChevronDown,
  Search as SearchIcon,
  Phone as PhoneIcon,
  Link as LinkIcon,
  Rocket,
} from 'lucide-react';

/* ---------- look & feel ---------- */
const FRAME: React.CSSProperties = {
  background: 'rgba(13,15,17,0.95)',
  border: '2px dashed rgba(106,247,209,0.30)',
  boxShadow: '0 0 40px rgba(0,0,0,0.7)',
  borderRadius: 30,
};
const CARD: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.30)',
  borderRadius: 20,
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
};
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

/* ---------- types ---------- */
type Settings = {
  systemPrompt: string;
  ttsVoice: string;
  language: string;
  fromE164: string;
  assistantId?: string;
  publicKey?: string;
};
type NumberItem = { id: string; e164?: string; label?: string; provider?: string; status?: string };
type Bot = { id: string; name: string; industry?: string; language?: string; prompt?: string };
type Option = { value: string; label: string };

const LS_SETTINGS_KEY = 'voice:settings:backup';
const CHATBOTS_KEY = 'chatbots';

/* ---------- helpers ---------- */
async function getJSON<T = any>(url: string): Promise<T> {
  const r = await fetch(url);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('Non-JSON response');
  const j = await r.json();
  if (j?.ok === false) throw new Error(j?.error || 'Request failed');
  return (j?.ok ? j.data : j) as T;
}
function loadLocalSettings(): Partial<Settings> | null {
  try { const raw = localStorage.getItem(LS_SETTINGS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveLocalSettings(v: Partial<Settings>) { try { localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(v)); } catch {} }
function buildRawFromBot(b: Bot): string {
  const head = [b?.name, b?.industry, b?.language].filter(Boolean).join('\n');
  const step3 = b?.prompt ?? '';
  if (head && step3) return `${head}\n\n${step3}`;
  return head || step3 || '';
}

/* ---------- tiny atoms ---------- */
function Pill({ active, onClick, icon, label }:{
  active: boolean; onClick: () => void; icon: JSX.Element; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-sm flex items-center gap-2 transition-all ${
        active ? 'text-black bg-[#00ffc2]' : 'text-white/90 bg-transparent'
      }`}
      style={{
        boxShadow: active ? '0 0 16px rgba(106,247,209,0.25)' : 'none',
        border: active ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.25)',
      }}
    >
      {icon} {label}
    </button>
  );
}
function Section({ title, icon, open, onToggle, children }:{
  title: string; icon: JSX.Element; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={CARD} className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition-colors"
        style={{ borderBottom: open ? '1px solid rgba(255,255,255,0.16)' : 'none' }}
      >
        <div className="w-5 h-5">{icon}</div>
        <div className="flex-1 text-white font-semibold">{title}</div>
        <ChevronDown className="w-5 h-5 text-white/80 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>
      {open && <div className="p-5 animate-[fadeIn_.25s_ease]">{children}</div>}
    </div>
  );
}
function Field({ label, children }:{ label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-xs text-white/70">{label}</label>
      {children}
    </div>
  );
}
function GreenButton({ children, onClick, disabled, className }:{
  children: React.ReactNode; onClick?: ()=>void; disabled?: boolean; className?: string;
}) {
  const isDisabled = !!disabled;
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 px-4 h-[42px] rounded-[14px] font-semibold select-none transition-colors disabled:cursor-not-allowed ${className || ''}`}
      style={{
        background: isDisabled ? BTN_DISABLED : BTN_GREEN,
        color: '#ffffff',
        boxShadow: isDisabled ? 'none' : '0 1px 0 rgba(0,0,0,0.18)',
        filter: isDisabled ? 'saturate(85%) opacity(0.9)' : 'none',
      }}
      onMouseEnter={(e) => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER; }}
      onMouseLeave={(e) => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN; }}
    >
      {children}
    </button>
  );
}

/* ---------- InlineSelect (compact dropdown) ---------- */
function InlineSelect({ id, value, onChange, options, placeholder = 'Select…', width = 320, searchable = true }:{
  id?: string; value: string; onChange: (val: string) => void; options: Option[]; placeholder?: string; width?: number; searchable?: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const selected = useMemo(() => options.find(o => o.value === value) || null, [options, value]);
  const filtered = useMemo(() => !query.trim() ? options : options.filter(o => o.label.toLowerCase().includes(query.toLowerCase())), [options, query]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect(); if (!r) return;
      const vh = window.innerHeight; const openUp = r.bottom + 320 > vh;
      setRect({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp });
    };
    update();
    const h = () => update();
    window.addEventListener('resize', h); window.addEventListener('scroll', h, true);
    return () => { window.removeEventListener('resize', h); window.removeEventListener('scroll', h, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return; setActiveIdx(0);
    setTimeout(() => { if (searchable) searchRef.current?.focus(); listRef.current?.scrollTo({ top: 0 }); }, 0);
  }, [open, query, searchable]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const selectAt = (i: number) => { const o = filtered[i]; if (!o) return; onChange(o.value); setQuery(''); setOpen(false); btnRef.current?.focus(); };

  return (
    <div className="relative" style={{ width }}>
      <button
        ref={btnRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 h-[42px] rounded-[14px] text-sm outline-none transition"
        style={{ background: 'rgba(0,0,0,0.30)', border: '1px solid rgba(255,255,255,0.20)', color: 'white' }}
      >
        <span className="truncate">{selected?.label || <span className="text-white/60">{placeholder}</span>}</span>
        <ChevronDown className="w-4 h-4 opacity-80" />
      </button>

      {open && rect && (
        <div
          ref={portalRef}
          role="listbox"
          tabIndex={-1}
          className="fixed z-[9999] p-3"
          style={{ ...CARD, top: rect.openUp ? rect.top - 8 : rect.top + 8, left: rect.left, width: rect.width, transform: rect.openUp ? 'translateY(-100%)' : 'none' }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(filtered.length - 1, i + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); selectAt(activeIdx); }
            else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
          }}
        >
          {searchable && (
            <div className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[12px]" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <SearchIcon className="w-4 h-4 text-white/70" />
              <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to filter…" className="w-full bg-transparent outline-none text-sm text-white placeholder:text-white/60" />
            </div>
          )}
          <div ref={listRef} className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {filtered.map((o, i) => {
              const active = i === activeIdx; const selectedRow = o.value === value;
              return (
                <button key={o.value} role="option" aria-selected={selectedRow} onMouseEnter={() => setActiveIdx(i)} onClick={() => selectAt(i)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left transition text-white"
                        style={{ background: active ? 'rgba(0,255,194,0.10)' : 'transparent', border: active ? '1px solid rgba(0,255,194,0.35)' : '1px solid transparent' }}>
                  <span className="flex-1 truncate">{o.label}</span>
                </button>
              );
            })}
            {filtered.length === 0 && <div className="px-3 py-6 text-sm text-white/70">No matches.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- main ---------- */
export default function VoiceAgentSection() {
  const [activeTab, setActiveTab] = useState<'model'|'voice'|'transcriber'|'tools'|'analysis'|'advanced'|'widget'>('model');

  const [nums, setNums] = useState<NumberItem[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [settings, setSettings] = useState<Settings>({ systemPrompt: '', ttsVoice: 'Polly.Joanna', language: 'en-US', fromE164: '', assistantId: '', publicKey: '' });

  // NEW: user-supplied Twilio creds (no env vars needed)
  const [twSid, setTwSid] = useState('');
  const [twToken, setTwToken] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [openModelA, setOpenModelA] = useState(true);
  const [openModelB, setOpenModelB] = useState(false);
  const [openVoiceA, setOpenVoiceA] = useState(true);
  const [openVoiceB, setOpenVoiceB] = useState(true);
  const [openWidgetA, setOpenWidgetA] = useState(true);

  const mountedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        try {
          const s = await getJSON<Settings>('/api/voice-agent');
          setSettings((prev) => ({ ...prev, ...s })); saveLocalSettings(s);
        } catch {
          const local = loadLocalSettings(); if (local) setSettings((prev) => ({ ...prev, ...local }));
        }
        try {
          const list = await getJSON<NumberItem[]>('/api/telephony/phone-numbers');
          setNums(Array.isArray(list) ? list : []);
        } catch { setNums([]); }
        try {
          const raw = localStorage.getItem(CHATBOTS_KEY);
          const arr: Bot[] = raw ? JSON.parse(raw) : [];
          if (Array.isArray(arr)) {
            setBots(arr);
            if (arr[0]?.id) { setSelectedBotId(arr[0].id); setSettings((p) => ({ ...p, systemPrompt: buildRawFromBot(arr[0]) })); }
          }
        } catch {}
      } finally { setLoading(false); }
    })();
  }, []);

  async function refreshNumbers() {
    try { const list = await getJSON<NumberItem[]>('/api/telephony/phone-numbers'); setNums(Array.isArray(list) ? list : []); setMsg('Numbers refreshed.'); }
    catch { setMsg('Could not refresh numbers (API).'); }
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch('/api/voice-agent', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      const ct = r.headers.get('content-type') || ''; if (!ct.includes('application/json')) throw new Error('Saved locally (server non-JSON).');
      const j = await r.json(); if (j?.ok === false) throw new Error(j?.error || 'Failed to save.');
      saveLocalSettings(settings); setMsg('Settings saved.');
    } catch (e: any) { saveLocalSettings(settings); setMsg(e?.message || 'Saved locally (API not available).'); }
    finally { setSaving(false); }
  }

  function onPickBot(id: string) {
    setSelectedBotId(id);
    const bot = bots.find(b => b.id === id);
    if (bot) { const prompt = buildRawFromBot(bot); setSettings((p) => ({ ...p, systemPrompt: prompt })); setMsg(`Imported prompt from “${bot.name}”.`); setActiveTab('model'); setOpenModelB(true); }
  }

  async function improveForVoice() {
    try {
      const company = bots.find(b => b.id === selectedBotId)?.name || 'the company';
      const r = await fetch('/api/voice/improve-prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: settings.systemPrompt || '', company, language: settings.language || 'en-US' }) });
      const ct = r.headers.get('content-type') || ''; if (!ct.includes('application/json')) throw new Error('Improve failed (non-JSON).');
      const j = await r.json(); if (!j?.ok) throw new Error(j?.error || 'Improve failed');
      setSettings((p) => ({ ...p, systemPrompt: j.data?.prompt || p.systemPrompt })); setOpenModelB(true); setMsg('Prompt re-shaped for a voice agent.');
    } catch (e: any) { setMsg(e?.message || 'Could not improve prompt.'); }
  }

  async function createAgent() {
    setCreating(true); setMsg(null);
    try {
      const body = { agentId: selectedBotId || undefined, fromNumber: settings.fromE164 || undefined, voice: settings.ttsVoice, language: settings.language, prompt: (settings.systemPrompt || '').trim() };
      const r = await fetch('/api/voice/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const ct = r.headers.get('content-type') || ''; if (!ct.includes('application/json')) throw new Error('Server did not return JSON.');
      const j = await r.json(); if (!j?.ok) throw new Error(j?.error || 'Create failed');
      const id = j.agentId || selectedBotId || '(agent)'; setMsg(`Agent created: ${id}${settings.fromE164 ? ` — live at ${settings.fromE164}` : ''}`);
    } catch (e:any) { setMsg(e?.message || 'Create failed.'); } finally { setCreating(false); }
  }

  async function onAttachClick() {
    setMsg(null);
    if (!selectedBotId) { setMsg('Select a Build first to use as agentId.'); return; }
    if (!settings.fromE164) { setMsg('Pick a number in “From Number” first.'); return; }
    if (!/^AC[a-zA-Z0-9]{32}$/.test(twSid) || !twToken) { setMsg('Enter a valid Twilio SID + Auth Token.'); return; }

    try {
      setAttaching(true);
      const r = await fetch('/api/telephony/attach-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid: twSid,
          authToken: twToken,
          phoneNumber: settings.fromE164,  // +1555...
          agentId: selectedBotId,
          baseUrl: window.location.origin, // ensure correct host on Vercel
        }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) throw new Error(j?.error || 'Attach failed');
      setMsg(`Agent live at ${settings.fromE164}`);
    } catch (e: any) { setMsg(e?.message || 'Attach failed.'); }
    finally { setAttaching(false); }
  }

  function mountWidget() {
    if (mountedRef.current) return;
    if (!settings.assistantId || !settings.publicKey) { setMsg('Enter assistant id and public key first.'); return; }
    const scId = 'vapi-widget-script';
    if (!document.getElementById(scId)) {
      const sc = document.createElement('script');
      sc.id = scId; sc.src = 'https://unpkg.com/@vapi-ai/client-sdk-react/dist/embed/widget.umd.js'; sc.async = true; sc.type = 'text/javascript';
      document.body.appendChild(sc);
    }
    const slot = document.getElementById('widget-slot');
    if (slot && slot.childElementCount === 0) {
      const el = document.createElement('vapi-widget');
      el.setAttribute('assistant-id', settings.assistantId!);
      el.setAttribute('public-key', settings.publicKey!);
      slot.appendChild(el);
      mountedRef.current = true; setMsg('Widget mounted. Click the floating button to talk.');
    }
  }

  const numberOptions: Option[] = useMemo(
    () => nums.map((n) => ({ value: n.e164 || '', label: (n.e164 ? n.e164 : n.id) + (n.label ? ` — ${n.label}` : '') })),
    [nums]
  );
  const botOptions: Option[] = useMemo(() => bots.map((b) => ({ value: b.id, label: b.name || b.id })), [bots]);

  if (loading) return (<div className="relative p-8" style={{ ...FRAME, overflow: 'visible', maxWidth: 860, margin: '0 auto' }}><div className="text-white/80">Loading…</div></div>);

  return (
    <div className="relative p-6 md:p-8" style={{ ...FRAME, overflow: 'visible', maxWidth: 860, margin: '0 auto' }}>
      {/* header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-white"><PhoneIcon className="h-6 w-6 text-[#6af7d1]" />Voice Agent</h2>
          <div className="text-white/80 text-xs md:text-sm">Create the agent, attach a number, and test — all from here.</div>
        </div>
        <div className="flex items-center gap-3">
          <GreenButton onClick={createAgent} disabled={creating || !settings.systemPrompt}><Rocket className="w-4 h-4 text-white" />{creating ? 'Creating…' : 'Create Agent'}</GreenButton>
          <GreenButton onClick={save} disabled={saving}><SaveIcon className="w-4 h-4 text-white" />{saving ? 'Saving…' : 'Save'}</GreenButton>
        </div>
      </div>

      {/* tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Pill active={activeTab==='model'} onClick={()=>setActiveTab('model')} icon={<Cog className="w-4 h-4" />} label="Model" />
        <Pill active={activeTab==='voice'} onClick={()=>setActiveTab('voice')} icon={<Mic className="w-4 h-4" />} label="Voice" />
        <Pill active={activeTab==='transcriber'} onClick={()=>setActiveTab('transcriber')} icon={<TranscriberIcon className="w-4 h-4" />} label="Transcriber" />
        <Pill active={activeTab==='tools'} onClick={()=>setActiveTab('tools')} icon={<ToolsIcon className="w-4 h-4" />} label="Tools" />
        <Pill active={activeTab==='analysis'} onClick={()=>setActiveTab('analysis')} icon={<AnalysisIcon className="w-4 h-4" />} label="Analysis" />
        <Pill active={activeTab==='advanced'} onClick={()=>setActiveTab('advanced')} icon={<AdvancedIcon className="w-4 h-4" />} label="Advanced" />
        <Pill active={activeTab==='widget'} onClick={()=>setActiveTab('widget')} icon={<WidgetIcon className="w-4 h-4" />} label="Widget" />
      </div>

      {/* MODEL */}
      {activeTab === 'model' && (
        <div className="grid grid-cols-1 gap-6">
          <Section title="Import from Build" icon={<Cog className="w-5 h-5 text-[#6af7d1]" />} open={openModelA} onToggle={() => setOpenModelA(v=>!v)}>
            <div className="flex flex-wrap items-center gap-3">
              <Field label="Build (from Builder)">
                <InlineSelect id="build-select" value={selectedBotId} onChange={onPickBot} options={botOptions} width={320} />
                <p className="text-xs text-white/60 mt-2">Imports <b>Step 1 + Step 3</b> from your selected build.</p>
              </Field>
              <div className="flex items-center gap-2 ml-auto">
                <GreenButton className="w-[190px]" onClick={improveForVoice}><Wand2 className="w-4 h-4 text-white" />Improve for Voice</GreenButton>
                <GreenButton className="w-[150px]" onClick={()=>setOpenModelB(true)}>Preview / Edit</GreenButton>
              </div>
            </div>
          </Section>
          <Section title="Prompt Preview & Editor" icon={<AdvancedIcon className="w-5 h-5 text-[#6af7d1]" />} open={openModelB} onToggle={() => setOpenModelB(v=>!v)}>
            <textarea rows={14} value={settings.systemPrompt} onChange={(e)=>setSettings({...settings, systemPrompt: e.target.value })}
                      className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#6af7d1] text-white" placeholder="Your assistant prompt…" style={{ minHeight: 220 }} />
          </Section>
        </div>
      )}

      {/* VOICE */}
      {activeTab === 'voice' && (
        <div className="grid grid-cols-1 gap-6">
          <Section title="Voice & Language" icon={<Mic className="w-5 h-5 text-[#6af7d1]" />} open={openVoiceA} onToggle={() => setOpenVoiceA(v=>!v)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="TTS Voice (Twilio)">
                <input value={settings.ttsVoice} onChange={(e)=>setSettings({...settings, ttsVoice: e.target.value})}
                       placeholder='Polly.Joanna (or "alice")' className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 h-[42px] text-sm outline-none focus:border-[#6af7d1] text-white" />
              </Field>
              <Field label="ASR Language">
                <input value={settings.language} onChange={(e)=>setSettings({...settings, language: e.target.value})}
                       placeholder="en-US" className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 h-[42px] text-sm outline-none focus:border-[#6af7d1] text-white" />
              </Field>
            </div>
          </Section>

          <Section title="Assigned Number (imported only)" icon={<PhoneIcon className="w-5 h-5 text-[#6af7d1]" />} open={openVoiceB} onToggle={() => setOpenVoiceB(v=>!v)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="From Number">
                <InlineSelect id="from-number" value={settings.fromE164} onChange={(val) => setSettings({ ...settings, fromE164: val })}
                              options={numberOptions} width={320} placeholder={nums.length ? '— Choose —' : 'No numbers imported'} />
              </Field>

              {/* NEW: Twilio creds from the user (required for Attach) */}
              <Field label="Twilio Account SID">
                <input value={twSid} onChange={(e)=>setTwSid(e.target.value)} placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                       className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 h-[42px] text-sm outline-none focus:border-[#6af7d1] text-white" />
              </Field>
              <Field label="Twilio Auth Token">
                <input type="password" value={twToken} onChange={(e)=>setTwToken(e.target.value)} placeholder="••••••••••••••••"
                       className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 h-[42px] text-sm outline-none focus:border-[#6af7d1] text-white" />
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <GreenButton className="ml-auto w-[220px]" onClick={refreshNumbers}><RefreshCw className="w-4 h-4 text-white" />Refresh Imported Numbers</GreenButton>
              <GreenButton className="w-[220px]" onClick={onAttachClick} disabled={!selectedBotId || !settings.fromE164 || attaching}>
                <LinkIcon className="w-4 h-4 text-white" />{attaching ? 'Attaching…' : 'Attach Number to Agent'}
              </GreenButton>
            </div>
            <p className="text-xs text-white/60 mt-2">No env needed: we use the <b>SID + Token</b> you enter above to set the Twilio Voice URL for this number.</p>
          </Section>
        </div>
      )}

      {/* other tabs minimal */}
      {activeTab === 'transcriber' && (<div className="grid grid-cols-1 gap-6"><div style={CARD} className="p-5 text-white/80">More transcriber options later.</div></div>)}
      {activeTab === 'tools' && (<div className="grid grid-cols-1 gap-6"><div style={CARD} className="p-5 text-white/80">Add integrations later.</div></div>)}
      {activeTab === 'analysis' && (<div className="grid grid-cols-1 gap-6"><div style={CARD} className="p-5 text-white/80">Analytics coming soon.</div></div>)}
      {activeTab === 'advanced' && (<div className="grid grid-cols-1 gap-6"><div style={CARD} className="p-5 text-white/80">Advanced options later.</div></div>)}

      {/* WIDGET */}
      {activeTab === 'widget' && (
        <div className="grid grid-cols-1 gap-6">
          <Section title="Browser Test (no phone)" icon={<WidgetIcon className="w-5 h-5 text-[#6af7d1]" />} open={openWidgetA} onToggle={() => setOpenWidgetA(v=>!v)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Assistant ID"><input value={settings.assistantId || ''} onChange={(e)=>setSettings({...settings, assistantId: e.target.value })}
                placeholder="assistant-id" className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 h-[42px] text-sm outline-none focus:border-[#6af7d1] text-white" /></Field>
              <Field label="Public Key"><input value={settings.publicKey || ''} onChange={(e)=>setSettings({...settings, publicKey: e.target.value })}
                placeholder="public-key" className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 h-[42px] text-sm outline-none focus:border-[#6af7d1] text-white" /></Field>
            </div>
            <div className="mt-3 flex gap-2"><GreenButton onClick={mountWidget}>Show Widget</GreenButton><GreenButton onClick={save}><SaveIcon className="w-4 h-4 text-white" /> Save</GreenButton></div>
            <div id="widget-slot" className="mt-3" />
            <p className="mt-2 text-xs text-white/60">Loads a virtual call widget — click its floating button to start talking.</p>
          </Section>
        </div>
      )}

      {msg && (
        <div className="mt-6 rounded-[14px] px-4 py-3 text-sm" style={{ ...CARD, border: '1px solid rgba(255,193,7,0.35)', background: 'rgba(255,193,7,0.10)' }}>
          <span className="text-amber-200">{msg}</span>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from {opacity:0; transform: translateY(2px);} to {opacity:1; transform: translateY(0);} }`}</style>
    </div>
  );
}
