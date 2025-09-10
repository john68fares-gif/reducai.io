'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeft, Plus, Search, Folder, FolderOpen, Check, Edit3, Trash2, ChevronLeft, ChevronRight as ChevronRightIcon, Bot } from 'lucide-react';

export type Assistant = {
  id: string;
  name: string;
  folder?: string;
  updatedAt: number;
  published?: boolean;
};

type Props = {
  assistants: Assistant[];
  activeId: string | null;
  onCreate: () => void;
  onActivate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  /** If your shell (layout) has a collapsible sidebar, pass its collapsed state so spacing stays correct. */
  shellCollapsed?: boolean;
};

function useAppSidebarWidth(scope: HTMLDivElement | null, fallbackCollapsed: boolean) {
  useEffect(() => {
    if (!scope) return;

    const setVar = (w: number) =>
      scope.style.setProperty('--app-sidebar-w', `${Math.round(w)}px`);

    const findSidebar = () =>
      (document.querySelector('[data-app-sidebar]') as HTMLElement) ||
      (document.querySelector('#app-sidebar') as HTMLElement) ||
      (document.querySelector('.app-sidebar') as HTMLElement) ||
      (document.querySelector('aside.sidebar') as HTMLElement) || null;

    let target = findSidebar();
    if (!target) {
      setVar(fallbackCollapsed ? 72 : 248);
      return;
    }

    const read = () => setVar(target!.getBoundingClientRect().width);
    read();

    const ro = new ResizeObserver(read);
    ro.observe(target);

    const mo = new MutationObserver(read);
    mo.observe(target, { attributes: true, attributeFilter: ['class', 'style'] });

    const onTransitionEnd = () => read();
    target.addEventListener('transitionend', onTransitionEnd);

    return () => {
      ro.disconnect();
      mo.disconnect();
      target.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [scope, fallbackCollapsed]);
}

export default function AssistantSidebar({
  assistants,
  activeId,
  onCreate,
  onActivate,
  onRename,
  onDelete,
  shellCollapsed = false,
}: Props) {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  // keep the main layout’s sidebar width in sync so we butt up against it perfectly
  useAppSidebarWidth(scopeRef.current, shellCollapsed);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? assistants.filter(a => a.name.toLowerCase().includes(q)) : assistants;
  }, [assistants, query]);

  return (
    <div ref={scopeRef}>
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
          background: 'var(--va-sidebar)',
          boxShadow: 'var(--va-shadow-side)',
          zIndex: 10,
          willChange: 'left',
        }}
      >
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--va-border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PanelLeft className="w-4 h-4 icon" />
            {!railCollapsed && <span>Assistants</span>}
          </div>
          <div className="flex items-center gap-2">
            {!railCollapsed && (
              <button onClick={onCreate} className="btn btn--green">
                <Plus className="w-3.5 h-3.5 text-white" />
                <span className="text-white">Create</span>
              </button>
            )}
            <button
              title={railCollapsed ? 'Expand assistants' : 'Collapse assistants'}
              className="btn btn--ghost"
              onClick={() => setRailCollapsed(v => !v)}
            >
              {railCollapsed ? <ChevronRightIcon className="w-4 h-4 icon" /> : <ChevronLeft className="w-4 h-4 icon" />}
            </button>
          </div>
        </div>

        <div className="p-3 min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {!railCollapsed && (
            <div
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 mb-2"
              style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)', boxShadow: 'var(--va-input-shadow)' }}
            >
              <Search className="w-4 h-4 icon" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assistants"
                className="w-full bg-transparent outline-none text-sm"
                style={{ color: 'var(--text)' }}
              />
            </div>
          )}

          {!railCollapsed && (
            <>
              <div className="text-xs font-semibold flex items-center gap-2 mt-3 mb-1" style={{ color: 'var(--text-muted)' }}>
                <Folder className="w-3.5 h-3.5 icon" /> Folders
              </div>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5">
                <FolderOpen className="w-4 h-4 icon" /> All
              </button>
            </>
          )}

          <div className="mt-4 space-y-2">
            {filtered.map(a => {
              const isActive = a.id === activeId;
              const isEdit = editingId === a.id;

              if (railCollapsed) {
                return (
                  <button
                    key={a.id}
                    onClick={() => onActivate(a.id)}
                    className="w-full rounded-xl p-3 grid place-items-center"
                    style={{
                      background: isActive ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'var(--va-card)',
                      border: `1px solid ${isActive ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))' : 'var(--va-border)'}`,
                      boxShadow: 'var(--va-shadow-sm)',
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
                    boxShadow: 'var(--va-shadow-sm)',
                  }}
                >
                  <button className="w-full text-left flex items-center justify-between" onClick={() => onActivate(a.id)}>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        <Bot className="w-4 h-4 icon" />
                        {!isEdit ? (
                          <span className="truncate">{a.name}</span>
                        ) : (
                          <input
                            autoFocus
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onRename(a.id, (tempName || '').trim() || 'Untitled');
                                setEditingId(null);
                              }
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="bg-transparent rounded-md px-2 py-1 outline-none w-full"
                            style={{ border: '1px solid var(--va-input-border)', color: 'var(--text)' }}
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(a.id);
                            setTempName(a.name);
                          }}
                          className="btn btn--ghost text-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5 icon" /> Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(a.id);
                          }}
                          className="btn btn--danger text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRename(a.id, (tempName || '').trim() || 'Untitled');
                            setEditingId(null);
                          }}
                          className="btn btn--green text-xs"
                        >
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span className="text-white">Save</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                          }}
                          className="btn btn--ghost text-xs"
                        >
                          Cancel
                        </button>
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
