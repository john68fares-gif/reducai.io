// components/builder/CustomizeModal.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { X, RefreshCw, Trash2 } from 'lucide-react';

const Bot3D = dynamic(() => import('../builder/Bot3D.client'), { ssr: false });

type HeadType  = 'round' | 'square' | 'helm';
type TorsoType = 'capsule' | 'box' | 'barrel';
type LimbType  = 'segment' | 'tube' | 'spring';
type EyeStyle  = 'visor' | 'dots' | 'off'; // 'off' -> render as dots

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
  onSaveDraft?: (name: string, ap: BotAppearance) => void;
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

  // key per-bot
  const draftsKey = bot?.id ? `drafts:${bot.id}` : null;

  useEffect(() => {
    if (!draftsKey) return;
    try {
      const arr: Draft[] = JSON.parse(localStorage.getItem(draftsKey) || '[]');
      if (Array.isArray(arr)) setDrafts(arr);
    } catch {}
  }, [draftsKey]);

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

  // styles now use theme-scoped CSS vars (see <style> at bottom)
  const FRAME_STYLE: React.CSSProperties = {
    background: 'var(--cm-frame-bg)',
    border: '2px dashed var(--cm-dashed)',
    boxShadow: 'var(--cm-frame-shadow)',
    borderRadius: 40,
    color: 'var(--cm-text)',
  };
  const HEADER_BORDER = { borderBottom: '1px solid var(--cm-hairline)' };
  const FOOTER_BORDER = { borderTop: '1px solid var(--cm-hairline)', background: 'var(--cm-footer-bg)' };
  const CARD_STYLE: React.CSSProperties = {
    background: 'var(--cm-card-bg)',
    border: '1px solid var(--cm-card-border)',
    borderRadius: 28,
    boxShadow: 'var(--cm-card-shadow)',
    color: 'var(--cm-text)',
  };
  const fieldBorder = 'var(--cm-input-border)';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="relative w-full max-w-[1280px] max-h-[88vh] flex flex-col font-movatif customize-modal-scope" style={FRAME_STYLE}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[40px]" style={HEADER_BORDER}>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate" style={{ color: 'var(--cm-text)' }}>
              Customize {bot?.name ? `“${bot.name}”` : ''}
            </h2>
            <div className="text-sm truncate" style={{ color: 'var(--cm-muted)' }}>
              Robot appearance & preview
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:opacity-80" aria-label="Close" title="Close" style={{ color: 'var(--cm-text)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Preview card */}
            <div style={CARD_STYLE} className="overflow-hidden glow-spot">
              <div className="px-5 pt-4 pb-3">
                <div className="text-base font-medium" style={{ color: 'var(--cm-text)' }}>Live Preview</div>
              </div>
              <div className="px-5 pb-5">
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
                <div className="text-base font-medium" style={{ color: 'var(--cm-text)' }}>Controls</div>
              </div>
              <div className="px-5 pb-5 space-y-4">
                {/* Accent quick dots */}
                <div>
                  <div className="mb-2 text-sm" style={{ color: 'var(--cm-muted)' }}>Accent</div>
                  <div className="flex gap-2 flex-wrap">
                    {['#6af7d1','#7cc3ff','#b28bff','#ffd68a','#ff9db1','#ffffff','#0fffd7','#6633ff','#00ff00','#ff6666'].map(c=>(
                      <button
                        key={c}
                        onClick={()=>setAp(a=>({...a,accent:c}))}
                        className="w-6 h-6 rounded-full border"
                        style={{ background: c, borderColor: 'var(--cm-hairline)' }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

                {/* Compact selects */}
                {([
                  ['Eyes','eyes',['visor','dots','off']],
                  ['Head','head',['round','square','helm']],
                  ['Torso','torso',['capsule','box','barrel']],
                  ['Arms','arms',['segment','tube','spring']],
                  ['Legs','legs',['segment','tube','spring']],
                ] as const).map(([label,key,opts])=>(
                  <div key={key} className="flex items-center gap-3">
                    <label className="w-28 text-sm" style={{ color: 'var(--cm-muted)' }}>{label}</label>
                    <select
                      value={(ap as any)[key] ?? (key==='eyes' ? 'visor' : undefined)}
                      onChange={e=>setAp(a=>({...a,[key]:e.target.value}))}
                      className="text-sm rounded-2xl px-3 py-1.5 outline-none w-[140px]"
                      style={{
                        background: 'var(--cm-input-bg)',
                        color: 'var(--cm-text)',
                        border: `1px dashed ${fieldBorder}`,
                        boxShadow: 'var(--cm-input-shadow)',
                      }}
                      onFocus={(e)=> (e.currentTarget.style.borderColor = 'var(--cm-focus)')}
                      onBlur={(e)=> (e.currentTarget.style.borderColor = fieldBorder)}
                    >
                      {opts.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}

                {/* Circle checkboxes */}
                <div className="flex items-center gap-8 pt-2 text-sm">
                  {(['antenna','withBody','idle'] as const).map((flag) => (
                    <label key={flag} className="inline-flex items-center gap-2 cursor-pointer" style={{ color: 'var(--cm-text)' }}>
                      <span className="relative inline-flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="peer appearance-none w-4 h-4 rounded-full outline-none transition"
                          style={{
                            border: `1px solid var(--cm-input-border)`,
                            background: 'transparent',
                          }}
                          checked={(ap as any)[flag] !== false}
                          onChange={(e) => setAp((a) => ({ ...a, [flag]: e.target.checked }))}
/* focus ring */
                          onFocus={(e)=> (e.currentTarget.style.boxShadow = '0 0 0 3px var(--cm-ring)')}
                          onBlur={(e)=> (e.currentTarget.style.boxShadow = 'none')}
                        />
                        <span className="pointer-events-none absolute text-[10px] leading-none opacity-0 peer-checked:opacity-100" style={{ color: '#fff' }}>
                          ✓
                        </span>
                      </span>
                      <span style={{ color: 'var(--cm-text)' }}>{flag[0].toUpperCase() + flag.slice(1)}</span>
                    </label>
                  ))}
                </div>

                {/* Drafts row */}
                <div className="flex items-center gap-3 pt-2">
                  <select
                    value={selectedDraftKey}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedDraftKey(v);
                      if (v !== 'new') applyDraftByTs(v);
                      else setDraftName('');
                    }}
                    className="h-10 text-sm rounded-2xl px-3 outline-none w-[220px]"
                    style={{
                      background: 'var(--cm-input-bg)',
                      color: 'var(--cm-text)',
                      border: `1px dashed ${fieldBorder}`,
                      boxShadow: 'var(--cm-input-shadow)',
                    }}
                    onFocus={(e)=> (e.currentTarget.style.borderColor = 'var(--cm-focus)')}
                    onBlur={(e)=> (e.currentTarget.style.borderColor = fieldBorder)}
                    title="Choose a saved draft or New draft…"
                  >
                    <option value="new">New draft…</option>
                    {drafts.map((d) => (
                      <option key={d.ts} value={d.ts}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <input
                    value={draftName}
                    onChange={e=>setDraftName(e.target.value)}
                    placeholder={selectedDraftKey === 'new' ? 'Name this draft…' : 'Draft selected'}
                    className="h-10 flex-1 text-sm rounded-2xl px-3 outline-none disabled:opacity-60"
                    style={{
                      background: 'var(--cm-input-bg)',
                      color: 'var(--cm-text)',
                      border: `1px dashed ${fieldBorder}`,
                      boxShadow: 'var(--cm-input-shadow)',
                    }}
                    disabled={selectedDraftKey !== 'new'}
                    onFocus={(e)=> (e.currentTarget.style.borderColor = 'var(--cm-focus)')}
                    onBlur={(e)=> (e.currentTarget.style.borderColor = fieldBorder)}
                  />

                  <button
                    onClick={saveDraft}
                    className="h-10 px-4 rounded-2xl text-sm hover:translate-y-[-1px] transition"
                    style={{
                      background: 'var(--cm-chip)',
                      color: 'var(--cm-text)',
                      border: `1px solid var(--cm-input-border)`,
                      boxShadow: 'var(--cm-card-shadow)',
                    }}
                    disabled={!bot?.id || selectedDraftKey !== 'new' || !draftName.trim()}
                    title={selectedDraftKey !== 'new' ? 'Switch to "New draft…" to save a new one' : 'Save draft'}
                  >
                    Save draft
                  </button>

                  <button
                    onClick={deleteSelectedDraft}
                    className="h-10 px-3 rounded-2xl text-sm hover:bg-red-500/10 disabled:opacity-40 inline-flex items-center justify-center"
                    style={{ border: `1px dashed ${fieldBorder}`, color: 'var(--cm-text)' }}
                    disabled={selectedDraftKey === 'new'}
                    title="Delete selected draft"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 rounded-b-[40px] flex items-center justify-between" style={FOOTER_BORDER}>
          <button
            onClick={() => { setAp(base); onReset?.(); }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-sm hover:translate-y-[-1px] transition"
            style={{ border: '1px solid var(--cm-input-border)', background: 'transparent', color: 'var(--cm-text)' }}
            title="Reset"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={()=> onApply?.(ap)}
              className="px-6 py-2.5 rounded-2xl font-semibold"
              style={{ background:'#00ffc2', color:'#111', boxShadow:'0 18px 40px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.04)' }}
            >
              Save
            </button>
          </div>
        </div>

        {/* Theme-scoped vars + subtle glow/shadow */}
        <style jsx global>{`
          .customize-modal-scope{
            /* LIGHT */
            --cm-text: #0b0c10;
            --cm-muted: rgba(11,12,16,.65);

            --cm-frame-bg:
              radial-gradient(140% 180% at 0% -20%, rgba(0,255,194,.08) 0%, rgba(255,255,255,1) 46%),
              #ffffff;
            --cm-dashed: rgba(0,255,194,.35);
            --cm-hairline: rgba(0,0,0,.12);
            --cm-footer-bg: #fafbfc;

            --cm-frame-shadow: 0 28px 80px rgba(0,0,0,.14), 0 12px 28px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.02);

            --cm-card-bg: #ffffff;
            --cm-card-border: rgba(0,0,0,.10);
            --cm-card-shadow: 0 1px 0 rgba(0,0,0,.04), 0 12px 28px rgba(0,0,0,.08);

            --cm-input-bg: #ffffff;
            --cm-input-border: rgba(0,0,0,.14);
            --cm-input-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 10px 22px rgba(0,0,0,.06);

            --cm-ring: rgba(0,0,0,.06);
            --cm-focus: #00ffc2;

            --cm-chip: rgba(0,255,194,.08);
          }

          [data-theme="dark"] .customize-modal-scope{
            /* DARK */
            --cm-text: #ffffff;
            --cm-muted: rgba(255,255,255,.72);

            --cm-frame-bg:
              radial-gradient(120% 180% at 50% -40%, rgba(0,255,194,.06) 0%, rgba(12,16,18,1) 42%),
              linear-gradient(180deg, #0e1213 0%, #0c1012 100%);
            --cm-dashed: rgba(106,247,209,.30);
            --cm-hairline: rgba(255,255,255,.16);
            --cm-footer-bg: #101314;

            --cm-frame-shadow: 0 36px 90px rgba(0,0,0,.60), 0 14px 34px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.08);

            --cm-card-bg: #101314;
            --cm-card-border: rgba(255,255,255,.14);
            --cm-card-shadow: inset 0 0 22px rgba(0,0,0,.28), 0 0 20px rgba(0,255,194,.06);

            --cm-input-bg: rgba(255,255,255,.02);
            --cm-input-border: rgba(255,255,255,.18);
            --cm-input-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.38);

            --cm-ring: rgba(0,255,194,.14);
            --cm-focus: #00ffc2;

            --cm-chip: rgba(0,255,194,.10);
          }
        `}</style>
      </div>
    </div>
  );
}
