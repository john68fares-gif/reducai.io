'use client';

import React, { useMemo, useState } from 'react';
import {
  Search, Plus, Folder, FolderOpen, Check, Trash2, Edit3,
  ChevronLeft, ChevronRight as ChevronRightIcon, PanelLeft, Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/** ===== Types the parent already uses ===== */
export type PhoneNum = { id: string; label?: string; e164: string };
export type Assistant = {
  id: string;
  name: string;
  folder?: string;
  updatedAt: number;
  published?: boolean;
  config: {
    model: {
      provider: 'openai';
      model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
      firstMessageMode: 'assistant_first' | 'user_first';
      firstMessage: string;
      systemPrompt: string;
    };
    voice: { provider: 'openai' | 'elevenlabs'; voiceId: string; voiceLabel: string };
    transcriber: {
      provider: 'deepgram';
      model: 'nova-2' | 'nova-3';
      language: 'en' | 'multi';
      denoise: boolean;
      confidenceThreshold: number;
      numerals: boolean;
    };
    tools: { enableEndCall: boolean; dialKeypad: boolean };
    telephony?: { numbers: PhoneNum[]; linkedNumberId?: string };
  };
};

type Props = {
  /** Data */
  assistants: Assistant[];
  activeId: string;
  query: string;
  railCollapsed: boolean;
  creating?: boolean;

  /** Events */
  onSelect: (assistantId: string) => void;
  onCreate: () => void;
  onRename: (assistantId: string, nextName: string) => void;
  onDelete: (assistantId: string) => void;
  onQueryChange: (q: string) => void;
  onToggleRail: () => void;
};

/** A small input used during inline rename */
function RenameInput({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  onChange: (s: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave();
        if (e.key === 'Escape') onCancel();
      }}
      className="bg-transparent rounded-md px-2 py-1 outline-none w-full"
      style={{ border: '1px solid var(--va-input-border)', color: 'var(--text)' }}
    />
  );
}

/**
 * AssistantSidebar — fixed rail that aligns to the host app's sidebar using CSS var:
 *   --app-sidebar-w   (kept in sync by parent)
 *
 * Parent places this component anywhere; it will pin itself using position:fixed.
 */
export default function AssistantSidebar({
  assistants,
  activeId,
  query,
  railCollapsed,
  creating = false,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onQueryChange,
  onToggleRail,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');

  const visible = useMemo(
    () =>
      assistants.filter((a) =>
        a.name.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [assistants, query]
  );

  const beginRename = (a: Assistant) => {
    setEditingId(a.id);
    setTempName(a.name);
  };
  const cancelRename = () => {
    setEditingId(null);
    setTempName('');
  };
  const saveRename = (a: Assistant) => {
    const name = (tempName || '').trim() || 'Untitled';
    onRename(a.id, name);
    setEditingId(null);
  };

  return (
    <aside
      className="hidden lg:flex flex-col"
      data-collapsed={railCollapsed ? 'true' : 'false'}
      style={{
        position: 'fixed',
        left: 'calc(var(--app-sidebar-w, 248px) - 1px)',
        top: 'var(--app-header-h, 64px)',
        width: railCollapsed ? '72px' : 'var(--va-rail-w, 360px)',
        height: 'calc(100vh - var(--app-header-h, 64px))',
        borderLeft: 'none',
        borderRight: '1px solid var(--va-border)',
        background: 'var(--va-sidebar)',
        boxShadow: 'var(--va-shadow-side)',
        zIndex: 10,
        willChange: 'left',
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--va-border)' }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PanelLeft className="w-4 h-4 icon" />
          {!railCollapsed && <span>Assistants</span>}
        </div>
        <div className="flex items-center gap-2">
          {!railCollapsed && (
            <button onClick={onCreate} className="btn btn--green">
              {creating ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/50 border-t-transparent animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5 text-white" />
              )}
              <span className="text-white">{creating ? 'Creating…' : 'Create'}</span>
            </button>
          )}
          <button
            title={railCollapsed ? 'Expand assistants' : 'Collapse assistants'}
            className="btn btn--ghost"
            onClick={onToggleRail}
          >
            {railCollapsed ? (
              <ChevronRightIcon className="w-4 h-4 icon" />
            ) : (
              <ChevronLeft className="w-4 h-4 icon" />
            )}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {!railCollapsed && (
          <div
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 mb-2"
            style={{
              background: 'var(--va-input-bg)',
              border: '1px solid var(--va-input-border)',
              boxShadow: 'var(--va-input-shadow)',
            }}
          >
            <Search className="w-4 h-4 icon" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search assistants"
              className="w-full bg-transparent outline-none text-sm"
              style={{ color: 'var(--text)' }}
            />
          </div>
        )}

        {/* Folders (stub) */}
        {!railCollapsed && (
          <>
            <div
              className="text-xs font-semibold flex items-center gap-2 mt-3 mb-1"
              style={{ color: 'var(--text-muted)' }}
            >
              <Folder className="w-3.5 h-3.5 icon" /> Folders
            </div>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5">
              <FolderOpen className="w-4 h-4 icon" /> All
            </button>
          </>
        )}

        {/* Assistants list */}
        <div className="mt-4 space-y-2">
          {visible.map((a) => {
            const isActive = a.id === activeId;
            const isEdit = editingId === a.id;

            if (railCollapsed) {
              return (
                <button
                  key={a.id}
                  onClick={() => onSelect(a.id)}
                  className="w-full rounded-xl p-3 grid place-items-center"
                  style={{
                    background: isActive
                      ? 'color-mix(in oklab, var(--accent) 10%, transparent)'
                      : 'var(--va-card)',
                    border: `1px solid ${
                      isActive
                        ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))'
                        : 'var(--va-border)'
                    }`,
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
                  background: isActive
                    ? 'color-mix(in oklab, var(--accent) 10%, transparent)'
                    : 'var(--va-card)',
                  border: `1px solid ${
                    isActive
                      ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))'
                      : 'var(--va-border)'
                  }`,
                  boxShadow: 'var(--va-shadow-sm)',
                }}
              >
                <button
                  className="w-full text-left flex items-center justify-between"
                  onClick={() => onSelect(a.id)}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      <Bot className="w-4 h-4 icon" />
                      {!isEdit ? (
                        <span className="truncate">{a.name}</span>
                      ) : (
                        <RenameInput
                          value={tempName}
                          onChange={setTempName}
                          onSave={() => saveRename(a)}
                          onCancel={cancelRename}
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
                          beginRename(a);
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
                          saveRename(a);
                        }}
                        className="btn btn--green text-xs"
                      >
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span className="text-white">Save</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelRename();
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

      {/* Scoped shimmer glow background */}
      <AnimatePresence>
        {/* nothing animated here yet, kept for parity */}
      </AnimatePresence>
    </aside>
  );
}
