// components/builder/CustomizeModal.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { X, RefreshCw, Trash2 } from 'lucide-react';

const Bot3D = dynamic(() => import('../builder/Bot3D.client'), { ssr: false });

type HeadType  = 'round' | 'square' | 'helm';
type TorsoType = 'capsule' | 'box' | 'barrel';
type LimbType  = 'segment' | 'tube' | 'spring';
type EyeStyle  = 'visor' | 'dots' | 'off'; // 'off' will render as dots fallback

export type BotAppearance = {
  accent?: string;
  shellColor?: string;
  bodyColor?: string;
  trimColor?: string;
  faceColor?: string;
  head?: HeadType;
  torso?: TorsoType;
  arms?: LimbType;
  legs?: LimbType;
  eyes?: EyeStyle;
  antenna?: boolean;
  withBody?: boolean;
  idle?: boolean;
};

type Bot = { id: string; name: string; appearance?: BotAppearance };

type Props = {
  bot?: Bot;
  onApply?: (ap: BotAppearance) => void;
  onClose?: () => void;
  onReset?: () => void;
  onSaveDraft?: (name: string, ap: BotAppearance) => void; // optional external hook
};

const PRESETS = {
  silver: {
    accent: '#6af7d1',
    shellColor: '#f2f5f8',
    bodyColor:  '#cfd6de',
    trimColor:  '#aab4bd',
    faceColor:  '#0f1418',
    head: 'round' as HeadType,
    torso: 'capsule' as TorsoType,
    arms: 'segment' as LimbType,
    legs: 'segment' as LimbType,
    eyes: 'visor'  as EyeStyle,
    antenna: true,
    withBody: true,
    idle: true,
  },
} satisfies Record<string, Required<BotAppearance>>;

type Draft = { name: string; appearance: BotAppearance; ts: string };

export default function CustomizeModal({ bot, onApply, onClose, onReset, onSaveDraft }: Props) {
  const base = useMemo<BotAppearance>(() => ({ ...PRESETS.silver, ...(bot?.appearance ?? {}) }), [bot?.appearance]);
  const [ap, setAp] = useState<BotAppearance>(base);
  useEffect(() => setAp(base), [base]);

  // drafts state
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraftKey, setSelectedDraftKey] = useState<string>('new'); // 'new' or ts
  const [draftName, setDraftName] = useState<string>('');

  // palette
  const BORDER_WHITE = 'rgba(255,255,255,0.24)';
  const DASHED_GREEN = 'rgba(106,247,209,0.30)';
  const FOCUS_GREEN  = '#00ffc2';

  // frame (rounded + dashed outline like your style)
  const FRAME_STYLE: React.CSSProperties = {
    background: 'rgba(13,15,17,0.95)',
    border: `2px dashed ${DASHED_GREEN}`,
    boxShadow: '0 0 32px rgba(0,0,0,0.6)',
    borderRadius: 40,
  };
  const HEADER_BORDER = { borderBottom: `1px solid ${BORDER_WHITE}` };
  const FOOTER_BORDER = { borderTop: `1px solid ${BORDER_WHITE}`, background: '#101314' };
  const CARD_STYLE: React.CSSProperties = {
    background: '#101314',
    border: `1px solid ${BORDER_WHITE}`,
    borderRadius: 28,
  };

  // key per-bot
  const draftsKey = bot?.id ? `drafts:${bot.id}` : null;

  // load drafts for this bot
  useEffect(() => {
    if (!draftsKey) return;
    try {
      const arr: Draft[] = JSON.parse(localStorage.getItem(draftsKey) || '[]');
      if (Array.isArray(arr)) setDrafts(arr);
    } catch {}
  }, [draftsKey]);

  // helpers
  const saveDraftLocally = (d: Draft[]) => {
    if (!draftsKey) return;
    try {
      localStorage.setItem(draftsKey, JSON.stringify(d));
      setDrafts(d);
    } catch {}
  };

  const saveDraft = () => {
    if (!draftsKey) return;
    const name = draftName.trim();
    if (!name) return;

    const ts = new Date().toISOString();
    const withoutDupes = drafts.filter((x) => x.name !== name);
    const next = [{ name, appearance: ap, ts }, ...withoutDupes].slice(0, 20);
    saveDraftLocally(next);
    setSelectedDraftKey(ts);
    onSaveDraft?.(name, ap);
  };

  const deleteSelectedDraft = () => {
    if (!draftsKey || selectedDraftKey === 'new') return;
    const next = drafts.filter((d) => d.ts !== selectedDraftKey);
    saveDraftLocally(next);
    setSelectedDraftKey('new');
    setDraftName('');
  };

  const applyDraftByTs = (ts: string) => {
    const d = drafts.find((x) => x.ts === ts);
    if (!d) return;
    setAp(d.appearance);
    setDraftName(d.name);
  };

  // Bot3D supports 'visor' | 'dots'; treat 'off' as 'dots'
  const eyesValue = ap.eyes === 'off' ? 'dots' : (ap.eyes ?? 'visor');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="relative w-full max-w-[1280px] max-h-[88vh] flex flex-col text-white font-movatif" style={FRAME_STYLE}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[40px]" style={HEADER_BORDER}>
          <div className="min-w-0">
            <h2 className="text-white text-lg font-semibold truncate">Customize {bot?.name ? `“${bot.name}”` : ''}</h2>
            <div className="text-white/80 text-sm truncate">Robot appearance & preview</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close" title="Close">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Preview card */}
            <div style={CARD_STYLE} className="overflow-hidden">
              <div className="px-5 pt-4 pb-3">
                <div className="text-white text-base font-medium">Live Preview</div>
              </div>
              <div className="px-5 pb-5">
                {/* No inner border box */}
                <div className="h-[320px] rounded-3xl overflow-hidden">
                  {/* @ts-ignore */}
                  <Bot3D
                    className="h-full"
                    accent={ap.accent}
                    shellColor={ap.shellColor}
                    bodyColor={ap.bodyColor}
                    trimColor={ap.trimColor}
                    faceColor={ap.faceColor}
                    head={ap.head}
                    torso={ap.torso}
                    arms={ap.arms}
                    legs={ap.legs}
                    eyes={eyesValue as 'visor'|'dots'}
                    antenna={!!ap.antenna}
                    withBody={ap.withBody !== false}
                    idle={!!ap.idle}
                  />
                </div>
              </div>
            </div>

            {/* Controls card */}
            <div style={CARD_STYLE} className="overflow-hidden">
              <div className="px-5 pt-4 pb-3">
                <div className="text-white text-base font-medium">Controls</div>
              </div>
              <div className="px-5 pb-5 space-y-4">
                {/* Accent quick dots */}
                <div>
                  <div className="mb-2 text-sm text-white/70">Accent</div>
                  <div className="flex gap-2 flex-wrap">
                    {['#6af7d1','#7cc3ff','#b28bff','#ffd68a','#ff9db1','#ffffff','#0fffd7','#63f','#0f0','#f66'].map(c=>(
                      <button
                        key={c}
                        onClick={()=>setAp(a=>({...a,accent:c}))}
                        className="w-6 h-6 rounded-full border"
                        style={{ background: c, borderColor: BORDER_WHITE }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

                {/* Compact, consistent-width selects */}
                {([
                  ['Eyes','eyes',['visor','dots','off']],
                  ['Head','head',['round','square','helm']],
                  ['Torso','torso',['capsule','box','barrel']],
                  ['Arms','arms',['segment','tube','spring']],
                  ['Legs','legs',['segment','tube','spring']],
                ] as const).map(([label,key,opts])=>(
                  <div key={key} className="flex items-center gap-3">
                    <label className="w-28 text-sm text-white/70">{label}</label>
                    <select
                      value={(ap as any)[key] ?? (key==='eyes' ? 'visor' : undefined)}
                      onChange={e=>setAp(a=>({...a,[key]:e.target.value}))}
                      className="bg-[#101314] text-white text-sm rounded-2xl px-3 py-1.5 outline-none w-[120px]"
                      style={{ border: `1px dashed ${DASHED_GREEN}` }}
                      onFocus={(e)=> (e.currentTarget.style.borderColor = FOCUS_GREEN)}
                      onBlur={(e)=> (e.currentTarget.style.borderColor = DASHED_GREEN)}
                    >
                      {opts.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}

                {/* Circle checkboxes (true circles + white check) */}
                <div className="flex items-center gap-8 pt-2 text-sm">
                  {(['antenna','withBody','idle'] as const).map((flag) => (
                    <label key={flag} className="inline-flex items-center gap-2 cursor-pointer">
                      {/* custom circular checkbox */}
                      <span className="relative inline-flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="
                            peer appearance-none w-4 h-4 rounded-full
                            border border-white/40 bg-transparent outline-none transition
                            checked:bg-[#00ffc2] checked:border-[#00ffc2]
                            focus-visible:ring-2 focus-visible:ring-[#00ffc2]/40
                          "
                          checked={(ap as any)[flag] !== false}
                          onChange={(e) => setAp((a) => ({ ...a, [flag]: e.target.checked }))}
                        />
                        {/* white check mark */}
                        <span className="pointer-events-none absolute text-white text-[10px] leading-none opacity-0 peer-checked:opacity-100">
                          ✓
                        </span>
                      </span>
                      <span className="text-white/90">{flag[0].toUpperCase() + flag.slice(1)}</span>
                    </label>
                  ))}
                </div>

                {/* Drafts row: dropdown + name + save + delete */}
                <div className="flex items-center gap-3 pt-2">
                  {/* Dropdown (same pill/dashed style as your input in photo) */}
                  <select
                    value={selectedDraftKey}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedDraftKey(v);
                      if (v !== 'new') applyDraftByTs(v);
                      else { setDraftName(''); }
                    }}
                    className="h-10 bg-[#101314] text-white text-sm rounded-2xl px-3 outline-none w-[200px]"
                    style={{ border: `1px dashed ${DASHED_GREEN}` }}
                    title="Choose a saved draft or New draft…"
                    onFocus={(e)=> (e.currentTarget.style.borderColor = FOCUS_GREEN)}
                    onBlur={(e)=> (e.currentTarget.style.borderColor = DASHED_GREEN)}
                  >
                    <option value="new">New draft…</option>
                    {drafts.map((d) => (
                      <option key={d.ts} value={d.ts}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  {/* Name input (same height) */}
                  <input
                    value={draftName}
                    onChange={e=>setDraftName(e.target.value)}
                    placeholder={selectedDraftKey === 'new' ? 'Name this draft…' : 'Draft selected'}
                    className="h-10 flex-1 bg-[#101314] text-white text-sm rounded-2xl px-3 outline-none disabled:text-white/40"
                    style={{ border: `1px dashed ${DASHED_GREEN}` }}
                    disabled={selectedDraftKey !== 'new'}
                    onFocus={(e)=> (e.currentTarget.style.borderColor = FOCUS_GREEN)}
                    onBlur={(e)=> (e.currentTarget.style.borderColor = DASHED_GREEN)}
                  />

                  {/* Save draft (same height) */}
                  <button
                    onClick={saveDraft}
                    className="h-10 px-4 rounded-2xl text-sm hover:bg-white/10 disabled:opacity-40"
                    style={{ border: `1px dashed ${DASHED_GREEN}` }}
                    disabled={!bot?.id || selectedDraftKey !== 'new' || !draftName.trim()}
                    title={selectedDraftKey !== 'new' ? 'Switch to "New draft…" to save a new one' : 'Save draft'}
                  >
                    Save draft
                  </button>

                  {/* Delete selected draft */}
                  <button
                    onClick={deleteSelectedDraft}
                    className="h-10 px-3 rounded-2xl text-sm hover:bg-red-500/10 disabled:opacity-40 inline-flex items-center justify-center"
                    style={{ border: `1px dashed ${DASHED_GREEN}` }}
                    disabled={selectedDraftKey === 'new'}
                    title="Delete selected draft"
                  >
                    <Trash2 className="w-4 h-4 text-white/90" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 rounded-b-[40px] flex items-center justify-between" style={FOOTER_BORDER}>
          {/* Reset small with recycle icon */}
          <button
            onClick={() => { setAp(base); onReset?.(); }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-sm"
            style={{ border: `1px solid ${BORDER_WHITE}`, background: 'transparent' }}
            title="Reset"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <div className="flex gap-2">
            {/* Close button removed per request; only the X in header remains */}
            <button
              onClick={()=> onApply?.(ap)}
              className="px-6 py-2.5 rounded-2xl font-semibold"
              style={{ background:'#00ffc2', color:'#ffffff', boxShadow:'0 0 12px rgba(0,255,194,0.45)' }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
