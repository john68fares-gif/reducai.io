'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanelLeft, Plus, Search, Check, Edit3, Trash2, Bot,
  ChevronLeft, ChevronRight as ChevronRightIcon, Folder, FolderOpen
} from 'lucide-react';

const SCOPE = 'va-scope';

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

    const target = findSidebar();
    if (!target) { setVar(fallbackCollapsed ? 72 : 248); return; }

    setVar(target.getBoundingClientRect().width);

    const ro = new ResizeObserver(() => setVar(target.getBoundingClientRect().width));
    ro.observe(target);

    const mo = new MutationObserver(() => setVar(target.getBoundingClientRect().width));
    mo.observe(target, { attributes: true, attributeFilter: ['class', 'style'] });

    const onTransitionEnd = () => setVar(target.getBoundingClientRect().width);
    target.addEventListener('transitionend', onTransitionEnd);

    return () => {
      ro.disconnect();
      mo.disconnect();
      target.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [scopeRef, fallbackCollapsed]);
}

export type AssistantLite = { id: string; name: string; folder?: string; updatedAt: number };
type Props = {
  assistants: AssistantLite[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, nextName: string) => void;
  onDelete: (id: string) => void;
  defaultCollapsed?: boolean;
};

export default function AssistantRail({
  assistants, activeId, onSelect, onCreate, onRename, onDelete, defaultCollapsed = false,
}: Props) {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const [hostCollapsed, setHostCollapsed] = useState<boolean>(() =>
    typeof document !== 'undefined' && document.body.getAttribute('data-sb-collapsed') === 'true'
  );
  const [railCollapsed, setRailCollapsed] = useState<boolean>(defaultCollapsed);
  useEffect(() => {
    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (typeof detail.collapsed === 'boolean') setHostCollapsed(!!detail.collapsed);
    };
    window.addEventListener('layout:sidebar', onEvt as EventListener);
    const mo = new MutationObserver(() => {
      setHostCollapsed(document.body.getAttribute('data-sb-collapsed') === 'true');
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-sb-collapsed', 'class'] });
    return () => { window.removeEventListener('layout:sidebar', onEvt as EventListener); mo.disconnect(); };
  }, []);
  useAppSidebarWidth(scopeRef, hostCollapsed);

  const [q, setQ] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const filtered = useMemo(
    () => assistants.filter(a => a.name.toLowerCase().includes(q.trim().toLowerCase())),
    [assistants, q]
  );
  const beginRename = (id: string, cur: string) => { setEditingId(id); setTempName(cur); };
  const saveRename = (id: string) => { onRename(id, (tempName || '').trim() || 'Untitled'); setEditingId(null); };

  return (
    <div ref={scopeRef} className={SCOPE}>
      <aside
        className="hidden lg:flex flex-col"
        data-collapsed={railCollapsed ? 'true' : 'false'}
        style={{
          position: 'fixed',
          left: 'calc(var(--app-sidebar-w, 248px) - 1px)',
          top: 'var(--app-header-h, 64px)',
          width: railCollapsed ? '72px' : 'var(--va-rail-w, 360px)',
          height: 'calc(100vh - var(--app-header-h, 64px))',
          borderRight: '1px solid var(--va-border)',
          background: 'var(--va-sidebar, var(--va-card))',
          boxShadow: 'var(--va-shadow-side, 8px 0 28px rgba(0,0,0,.42))',
          zIndex: 10,
          willChange: 'left',
        }}
      >
        {/* header */}
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--va-border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PanelLeft className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            {!railCollapsed && <span>Assistants</span>}
          </div>
          <div className="flex items-center gap-2">
            {!railCollapsed && (
              <button onClick={onCreate} className="btn btn--green">
                <Plus className="w-3.5 h-3.5 text-white" /><span className="text-white">Create</span>
              </button>
            )}
            <button
              title={railCollapsed ? 'Expand assistants' : 'Collapse assistants'}
              className="btn btn--ghost"
              onClick={() => setRailCollapsed(v => !v)}
            >
              {railCollapsed ? <ChevronRightIcon className="w-4 h-4" style={{ color: 'var(--accent)' }} /> : <ChevronLeft className="w-4 h-4" style={{ color: 'var(--accent)' }} />}
            </button>
          </div>
        </div>

        {/* search + folders */}
        {!railCollapsed && (
          <div className="p-3" style={{ borderBottom: '1px solid var(--va-border)' }}>
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)', boxShadow: 'var(--va-input-shadow)' }}>
              <Search className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search assistants"
                className="w-full bg-transparent outline-none text-sm"
                style={{ color: 'var(--text)' }}
              />
            </div>
            <div className="text-xs font-semibold flex items-center gap-2 mt-3 mb-1" style={{ color: 'var(--text-muted)' }}>
              <Folder className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} /> Folders
            </div>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5">
              <FolderOpen className="w-4 h-4" style={{ color: 'var(--accent)' }} /> All
            </button>
          </div>
        )}

        {/* list */}
        <div className="p-3 min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {filtered.map(a => {
            const isActive = a.id === activeId;
            const isEdit = editingId === a.id;
            if (railCollapsed) {
              return (
                <button key={a.id} onClick={() => onSelect(a.id)}
                  className="w-full rounded-xl p-3 grid place-items-center"
                  title={a.name}
                  style={{
                    background: isActive ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'var(--va-card)',
                    border: `1px solid ${isActive ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))' : 'var(--va-border)'}`
                  }}>
                  <Bot className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                </button>
              );
            }
            return (
              <div key={a.id} className="w-full rounded-xl p-3"
                   style={{
                     background: isActive ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'var(--va-card)',
                     border: `1px solid ${isActive ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))' : 'var(--va-border)'}`
                   }}>
                <button className="w-full text-left flex items-center justify-between" onClick={() => onSelect(a.id)}>
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      <Bot className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      {!isEdit ? (
                        <span className="truncate">{a.name}</span>
                      ) : (
                        <input
                          autoFocus value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveRename(a.id); if (e.key === 'Escape') setEditingId(null); }}
                          className="bg-transparent rounded-md px-2 py-1 outline-none w-full"
                          style={{ border: '1px solid var(--va-input-border)', color: 'var(--text)' }}
                        />
                      )}
                    </div>
                    <div className="text-[11px] mt-0.5 opacity-70 truncate">{a.folder || 'Unfiled'} • {new Date(a.updatedAt).toLocaleDateString()}</div>
                  </div>
                  {isActive ? <Check className="w-4 h-4" style={{ color: 'var(--accent)' }} /> : null}
                </button>
                <div className="mt-2 flex items-center gap-2">
                  {!isEdit ? (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); beginRename(a.id, a.name); }} className="btn btn--ghost text-xs">
                        <Edit3 className="w-3.5 h-3.5" /> Rename
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDelete(a.id); }} className="btn btn--danger text-xs">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); saveRename(a.id); }} className="btn btn--green text-xs">
                        <Check className="w-3.5 h-3.5 text-white" /> <span className="text-white">Save</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="btn btn--ghost text-xs">Cancel</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
