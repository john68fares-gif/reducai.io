// components/voice/AssistantRail.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Plus, Check, Trash2, Edit3,
  PanelLeft, Bot, ChevronLeft, ChevronRight as ChevronRightIcon,
  Folder, FolderOpen
} from 'lucide-react';

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

const SCOPE = 'va-scope';
const EXPANDED_W = 320; // visual width of the rail when open
const COLLAPSED_W = 0;  // we slide out completely (content expands)

export default function AssistantRail({
  assistants, activeId, onSelect, onCreate, onRename, onDelete, defaultCollapsed = false,
}: Props) {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const asideRef = useRef<HTMLElement | null>(null);

  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  // ---------- WIDTH SYNCH (the key to make the content expand/shrink) ----------
  useEffect(() => {
    const root = document.documentElement;

    const setVar = (name: string, px: number) => {
      root.style.setProperty(name, `${Math.max(0, Math.round(px))}px`);
    };

    // find any "host" app sidebar if present (so we offset next to it)
    const findAppSidebar = () =>
      (document.querySelector('[data-app-sidebar]') as HTMLElement) ||
      (document.querySelector('#app-sidebar') as HTMLElement) ||
      (document.querySelector('.app-sidebar') as HTMLElement) ||
      (document.querySelector('aside.sidebar') as HTMLElement) ||
      null;

    const apply = () => {
      const appSidebar = findAppSidebar();
      const appW = appSidebar ? appSidebar.getBoundingClientRect().width : 0;
      setVar('--app-sidebar-w', appW);

      const rail = asideRef.current;
      const railW = rail ? rail.getBoundingClientRect().width : 0;
      setVar('--va-rail-w', railW);
    };

    // Initial set
    apply();

    // Observe app sidebar and rail size changes
    const appSidebar = findAppSidebar();
    const ro = new ResizeObserver(apply);
    if (appSidebar) ro.observe(appSidebar);

    const rail = asideRef.current;
    if (rail) ro.observe(rail);

    // Re-apply on collapse toggle / window resize
    const onPing = () => apply();
    window.addEventListener('resize', onPing);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onPing);
    };
  }, []);

  // Whenever we toggle, update CSS var and notify layout
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-va-rail-collapsed', collapsed ? 'true' : 'false');

    // After the DOM style change settles, recompute width vars so the lane shifts.
    const id = window.requestAnimationFrame(() => {
      const w = collapsed ? COLLAPSED_W : EXPANDED_W;
      root.style.setProperty('--va-rail-w', `${w}px`);
      window.dispatchEvent(new CustomEvent('voice:layout:ping'));
    });
    return () => cancelAnimationFrame(id);
  }, [collapsed]);

  // ---------- FILTER ----------
  const visible = useMemo(
    () => assistants.filter(a => a.name.toLowerCase().includes(query.trim().toLowerCase())),
    [assistants, query]
  );

  const beginRename = (a: AssistantLite) => { setEditingId(a.id); setTempName(a.name); };
  const saveRename = (a: AssistantLite) => { onRename(a.id, (tempName || '').trim() || 'Untitled'); setEditingId(null); };

  return (
    <div ref={scopeRef} className={SCOPE}>
      <aside
        ref={asideRef}
        data-va-rail
        data-va-collapsed={collapsed ? 'true' : 'false'}
        className="hidden lg:flex flex-col"
        style={{
          position:'fixed',
          left:'calc(var(--app-sidebar-w, 0px) - 1px)',
          top:'var(--app-header-h, 64px)',
          width: collapsed ? COLLAPSED_W : EXPANDED_W,
          height:'calc(100vh - var(--app-header-h, 64px))',
          borderRight: collapsed ? 'none' : '1px solid var(--va-border)',
          background:'var(--va-sidebar)',
          boxShadow: collapsed ? 'none' : 'var(--va-shadow-side)',
          zIndex: 12,          // above page bg, below any modals
          overflow:'hidden',
          transition: 'width .18s ease'
        }}
      >
        {/* Header */}
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PanelLeft className="w-4 h-4 icon" />
            {!collapsed && <span>Assistants</span>}
          </div>
          <div className="flex items-center gap-2">
            {!collapsed && (
              <button onClick={onCreate} className="btn btn--green" style={{ height: 36 }}>
                <Plus className="w-4 h-4 text-white" />
                <span className="text-white">Create</span>
              </button>
            )}
            <button
              title={collapsed ? 'Expand assistants' : 'Collapse assistants'}
              className="btn"
              onClick={() => setCollapsed(v => !v)}
              style={{ height: 36 }}
            >
              {collapsed ? <ChevronRightIcon className="w-4 h-4 icon" /> : <ChevronLeft className="w-4 h-4 icon" />}
            </button>
          </div>
        </div>

        {/* Body (hidden when collapsed) */}
        {!collapsed && (
          <div className="p-3 min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth:'thin' }}>
            <div
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
            </div>

            <div className="text-xs font-semibold flex items-center gap-2 mt-3 mb-1" style={{ color:'var(--text-muted)' }}>
              <Folder className="w-3.5 h-3.5 icon" /> Folders
            </div>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5">
              <FolderOpen className="w-4 h-4 icon" /> All
            </button>

            <div className="mt-4 space-y-2">
              {visible.map(a => {
                const isActive = a.id === activeId;
                const isEdit = editingId === a.id;
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
                              onKeyDown={(e)=> { if (e.key==='Enter') { onRename(a.id, (tempName || '').trim() || 'Untitled'); setEditingId(null); } if (e.key==='Escape') setEditingId(null); }}
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
                          <button onClick={(e)=> { e.stopPropagation(); setEditingId(a.id); setTempName(a.name); }} className="btn text-xs"><Edit3 className="w-3.5 h-3.5 icon" /> Rename</button>
                          <button onClick={(e)=> { e.stopPropagation(); onDelete(a.id); }} className="btn btn--danger text-xs"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                        </>
                      ) : (
                        <>
                          <button onClick={(e)=> { e.stopPropagation(); onRename(a.id, (tempName || '').trim() || 'Untitled'); setEditingId(null); }} className="btn btn--green text-xs"><Check className="w-3.5 h-3.5 text-white" /><span className="text-white">Save</span></button>
                          <button onClick={(e)=> { e.stopPropagation(); setEditingId(null); }} className="btn text-xs">Cancel</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
