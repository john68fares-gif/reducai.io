// components/voice/AssistantRail.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Plus, Check, Trash2, Edit3,
  PanelLeft, Bot, ChevronLeft, ChevronRight as ChevronRightIcon,
  Folder, FolderOpen
} from 'lucide-react';

const SCOPE = 'va-scope';

/* Vapi-like rail sizes */
const RAIL_OPEN_W = 320;         // expanded width
const RAIL_COLLAPSED_W = 72;     // collapsed mini-rail (stays visible)
const RAIL_BORDER = '1px solid var(--va-border)';

/* === Keep the app-sidebar width in sync (if your app has a main sidebar) === */
function useAppSidebarWidth(scopeRef: React.RefObject<HTMLDivElement>, fallbackCollapsed: boolean) {
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    const setVar = (w: number) => scope.style.setProperty('--app-sidebar-w', `${Math.round(w)}px`);

    const findSidebar = () =>
      (document.querySelector('[data-app-sidebar]') as HTMLElement) ||
      (document.querySelector('#app-sidebar') as HTMLElement) ||
      (document.querySelector('.app-sidebar') as HTMLElement) ||
      (document.querySelector('aside.sidebar') as HTMLElement) ||
      null;

    let target = findSidebar();
    if (!target) { setVar(fallbackCollapsed ? 72 : 248); return; }

    const getW = () => target.getBoundingClientRect().width;
    setVar(getW());

    const ro = new ResizeObserver(() => setVar(getW()));
    ro.observe(target);

    const mo = new MutationObserver(() => setVar(getW()));
    mo.observe(target, { attributes: true, attributeFilter: ['class', 'style'] });

    const onTransitionEnd = () => setVar(getW());
    target.addEventListener('transitionend', onTransitionEnd);

    return () => {
      ro.disconnect();
      mo.disconnect();
      target.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [scopeRef, fallbackCollapsed]);
}

/** Keep --va-rail-w synced to the <aside> width so the lane expands/shrinks live */
function useRailWidthSync(asideRef: React.RefObject<HTMLElement>, railCollapsed: boolean) {
  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const root = document.documentElement;

    const apply = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      root.style.setProperty('--va-rail-w', `${w}px`);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => { ro.disconnect(); window.removeEventListener('resize', apply); };
  }, [asideRef, railCollapsed]);
}

/* === Types (lite) === */
export type AssistantLite = { id: string; name: string; folder?: string; updatedAt: number };

type Props = {
  assistants: AssistantLite[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  defaultCollapsed?: boolean;
};

export default function AssistantRail({
  assistants, activeId, onSelect, onCreate, onRename, onDelete, defaultCollapsed = false,
}: Props) {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const [sbCollapsed, setSbCollapsed] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.body.getAttribute('data-sb-collapsed') === 'true';
  });

  useEffect(() => {
    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (typeof detail.collapsed === 'boolean') setSbCollapsed(!!detail.collapsed);
    };
    window.addEventListener('layout:sidebar', onEvt as EventListener);

    const mo = new MutationObserver(() => {
      setSbCollapsed(document.body.getAttribute('data-sb-collapsed') === 'true');
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-sb-collapsed', 'class'] });

    return () => { window.removeEventListener('layout:sidebar', onEvt as EventListener); mo.disconnect(); };
  }, []);

  useAppSidebarWidth(scopeRef, sbCollapsed);

  const [railCollapsed, setRailCollapsed] = useState(defaultCollapsed);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  // notify layout when toggling (for pages that listen)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('voice:layout:ping'));
  }, [railCollapsed]);

  const asideRef = useRef<HTMLElement | null>(null);
  useRailWidthSync(asideRef, railCollapsed);

  const visible = useMemo(
    () => assistants.filter(a => a.name.toLowerCase().includes(query.trim().toLowerCase())),
    [assistants, query]
  );

  const beginRename = (a: AssistantLite) => { setEditingId(a.id); setTempName(a.name); };
  const saveRename = (a: AssistantLite) => { onRename(a.id, (tempName || '').trim() || 'Untitled'); setEditingId(null); };

  return (
    <div ref={scopeRef} className={SCOPE}>
      <aside
        ref={asideRef as any}
        data-va-rail
        data-va-collapsed={railCollapsed ? 'true' : 'false'}
        className="hidden lg:flex flex-col"
        style={{
          position:'fixed',
          left:'calc(var(--app-sidebar-w, 248px) - 1px)',
          top:'var(--app-header-h, 64px)',
          width: railCollapsed ? `${RAIL_COLLAPSED_W}px` : `${RAIL_OPEN_W}px`,
          height:'calc(100vh - var(--app-header-h, 64px))',
          borderRight: RAIL_BORDER,
          background:'var(--va-sidebar)',
          boxShadow: 'var(--va-shadow-side)',
          zIndex: 10,
          overflow:'hidden'
        }}
      >
        {/* Sticky header */}
        <div className="px-3 py-3 flex items-center justify-between sticky top-0 z-10"
             style={{ borderBottom: RAIL_BORDER, background:'var(--va-sidebar)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PanelLeft className="w-4 h-4 icon" />
            {!railCollapsed && <span>Assistants</span>}
          </div>
          <div className="flex items-center gap-2">
            {!railCollapsed && (
              <button onClick={onCreate} className="btn btn--green va-topbtn">
                <Plus className="w-4 h-4 text-white" />
                <span className="text-white">Create</span>
              </button>
            )}
            <button
              title={railCollapsed ? 'Expand assistants' : 'Collapse assistants'}
              className="btn btn--ghost va-topbtn"
              onClick={() => setRailCollapsed(v => !v)}
            >
              {railCollapsed ? <ChevronRightIcon className="w-4 h-4 icon" /> : <ChevronLeft className="w-4 h-4 icon" />}
            </button>
          </div>
        </div>

        <div className="p-3 min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth:'thin' }}>
          {!railCollapsed && (
            <>
              <label
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 mb-2"
                style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}
              >
                <Search className="w-4 h-4 icon" />
                <input
                  value={query}
                  onChange={(e)=> setQuery(e.target.value)}
                  placeholder="Search assistants"
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color:'var(--text)' }}
                />
              </label>

              <div className="text-xs font-semibold flex items-center gap-2 mt-3 mb-1" style={{ color:'var(--text-muted)' }}>
                <Folder className="w-3.5 h-3.5 icon" /> Folders
              </div>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5">
                <FolderOpen className="w-4 h-4 icon" /> All
              </button>
            </>
          )}

          <div className="mt-4 space-y-2">
            {visible.map(a => {
              const isActive = a.id === activeId;
              const isEdit = editingId === a.id;

              if (railCollapsed) {
                return (
                  <button
                    key={a.id}
                    onClick={()=> onSelect(a.id)}
                    className="w-full rounded-xl p-3 grid place-items-center"
                    style={{
                      background: isActive ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'var(--va-card)',
                      border: `1px solid ${isActive ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))' : 'var(--va-border)'}`,
                      boxShadow:'var(--va-shadow-sm)'
                    }}
                    title={a.name}
                  >
                    <Bot className="w-4 h-4 icon" />
                  </button>
                );
              }

              return (
                <div
                  key={a.id}
                  className="w-full rounded-xl p-3"
                  style={{
                    background: isActive ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'var(--va-card)',
                    border: `1px solid ${isActive ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))' : 'var(--va-border)'}`,
                    boxShadow:'var(--va-shadow-sm)'
                  }}
                >
                  <button className="w-full text-left flex items-center justify-between"
                          onClick={()=> onSelect(a.id)}>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        <Bot className="w-4 h-4 icon" />
                        {!isEdit ? (
                          <span className="truncate">{a.name}</span>
                        ) : (
                          <input
                            autoFocus
                            value={tempName}
                            onChange={(e)=> setTempName(e.target.value)}
                            onKeyDown={(e)=> { if (e.key==='Enter') saveRename(a); if (e.key==='Escape') setEditingId(null); }}
                            className="bg-transparent rounded-md px-2 py-1 outline-none w-full"
                            style={{ border:'1px solid var(--va-input-border)', color:'var(--text)' }}
                          />
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5 opacity-70 truncate">
                        {a.folder || 'Unfiled'} • {new Date(a.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    {isActive ? <Check className="w-4 h-4 icon" /> : null}
                  </button>

                  <div className="mt-2 flex items-center gap-2">
                    {!isEdit ? (
                      <>
                        <button onClick={(e)=> { e.stopPropagation(); beginRename(a); }} className="btn btn--ghost text-xs"><Edit3 className="w-3.5 h-3.5 icon" /> Rename</button>
                        <button onClick={(e)=> { e.stopPropagation(); onDelete(a.id); }} className="btn btn--danger text-xs"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e)=> { e.stopPropagation(); saveRename(a); }} className="btn btn--green text-xs"><Check className="w-3.5 h-3.5 text-white" /><span className="text-white">Save</span></button>
                        <button onClick={(e)=> { e.stopPropagation(); setEditingId(null); }} className="btn btn--ghost text-xs">Cancel</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
