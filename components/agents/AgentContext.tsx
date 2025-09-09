// components/agents/AgentContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

/* =============================================================================
   TYPES
============================================================================= */
export type PromptBlocks = {
  description: string;
  rules: string;
  questionFlow: string;
  faq: string;
  firstMessage: string; // seed message on new threads
};

export type AgentVersion = {
  id: string;              // version id (nanoid-like)
  createdAt: number;       // Date.now()
  blocks: PromptBlocks;    // the structured prompt
  model: string;           // runtime model for this version
  temperature: number;     // runtime temperature for this version
  apiKeyId?: string;       // (optional) link to a saved key in your key manager
};

export type Agent = {
  id: string;
  name: string;
  purpose?: string;        // short tagline
  phoneNumberId?: string;  // lets /api/chat look it up and use per-agent key
  // "current" runtime settings (UI picks from here; versions store their own too)
  model: string;
  temperature: number;
  apiKeyId?: string;

  // versioning
  versions: AgentVersion[]; // newest first
  activeVersionId?: string; // current selected version

  // quick access (mirrors active version's firstMessage for convenience)
  firstMessage?: string;
};

/* =============================================================================
   STORAGE (SCOPED + LEGACY MIGRATION)
============================================================================= */
const NS = 'reducai'; // namespace to avoid collisions across your app

function key(userId: string, suffix: string) {
  return `${NS}:${userId}:${suffix}`;
}

const isBrowser = typeof window !== 'undefined';

const storage = {
  get<T>(k: string, fallback: T): T {
    if (!isBrowser) return fallback;
    try {
      const raw = localStorage.getItem(k);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set<T>(k: string, v: T) {
    if (!isBrowser) return;
    localStorage.setItem(k, JSON.stringify(v));
  },
  remove(k: string) {
    if (!isBrowser) return;
    localStorage.removeItem(k);
  },
};

// Legacy list (your current Improve uses this)
const LEGACY_CHATBOTS_KEY = 'chatbots';

/** Attempt to migrate legacy agents shaped like:
 *   { id: string, name: string, prompt: string }
 * into new structured Agent objects (with a single version).
 */
function migrateLegacyAgents(userId: string): Agent[] {
  if (!isBrowser) return [];
  try {
    const raw = localStorage.getItem(LEGACY_CHATBOTS_KEY);
    if (!raw) return [];
    const old = JSON.parse(raw);
    if (!Array.isArray(old)) return [];

    const migrated: Agent[] = old.map((o: any): Agent => {
      const baseBlocks: PromptBlocks = {
        description: '',
        rules: '',
        questionFlow: '',
        faq: '',
        firstMessage: '', // not available in legacy, but can be added later
      };

      // Store the legacy "prompt" in DESCRIPTION so it isn’t lost;
      // you can split it manually later inside Improve.
      const blocks = { ...baseBlocks, description: String(o.prompt || '').slice(0, 12000) };

      const v: AgentVersion = {
        id: nano(),
        createdAt: Date.now(),
        blocks,
        model: 'gpt-4o-mini',
        temperature: 0.6,
      };

      return {
        id: String(o.id),
        name: String(o.name || 'Agent'),
        purpose: '',
        model: v.model,
        temperature: v.temperature,
        apiKeyId: undefined,
        versions: [v],
        activeVersionId: v.id,
        firstMessage: blocks.firstMessage || undefined,
      };
    });

    // Do not delete legacy key automatically; keep it for safety until you confirm.
    return migrated;
  } catch {
    return [];
  }
}

/* =============================================================================
   TINY HELPERS
============================================================================= */
function nano() {
  return Math.random().toString(36).slice(2, 10);
}

function getUserId(): string {
  // Replace with your real auth user id when available (Supabase/Clerk/etc.).
  if (!isBrowser) return 'anon';
  const k = key('global', 'user');
  const existing = storage.get<string | null>(k, null);
  if (existing) return existing;
  storage.set(k, 'anon');
  return 'anon';
}

/* =============================================================================
   CONTEXT SHAPE
============================================================================= */
type AgentCtx = {
  userId: string;
  agents: Agent[];
  currentAgentId?: string;
  currentAgent?: Agent;

  // selection
  setCurrentAgentId: (id?: string) => void;

  // CRUD
  addAgent: (agent: Agent) => void;
  saveAgent: (agent: Agent) => void;
  updateAgentPartial: (agentId: string, patch: Partial<Agent>) => void;
  deleteAgent: (agentId: string) => void;

  // versions
  saveVersion: (agentId: string, version: AgentVersion, setActive?: boolean) => void;
  activateVersion: (agentId: string, versionId: string) => void;

  // convenience
  setFirstMessage: (agentId: string, message: string) => void;

  // optional threads (if you want to centralize)
  getThread: (agentId: string) => { role: 'user' | 'assistant'; text: string }[];
  appendToThread: (agentId: string, msg: { role: 'user' | 'assistant'; text: string }) => void;
  clearThread: (agentId: string) => void;
};

const Ctx = createContext<AgentCtx | null>(null);

/* =============================================================================
   PROVIDER
============================================================================= */
export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string>('anon');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState<string | undefined>(undefined);

  // initial load + legacy migration
  useEffect(() => {
    const uid = getUserId();
    setUserId(uid);

    const stored = storage.get<Agent[]>(key(uid, 'agents:list'), []);
    if (stored.length > 0) {
      setAgents(stored);
    } else {
      // Try legacy migration ONCE if no new-format agents exist yet
      const migrated = migrateLegacyAgents(uid);
      if (migrated.length) {
        setAgents(migrated);
        storage.set(key(uid, 'agents:list'), migrated);
      }
    }

    const last = storage.get<string | undefined>(key(uid, 'agents:current'), undefined);
    setCurrentAgentId(last);
  }, []);

  // persist list + selection
  useEffect(() => {
    storage.set(key(userId, 'agents:list'), agents);
  }, [userId, agents]);

  useEffect(() => {
    storage.set(key(userId, 'agents:current'), currentAgentId ?? null);
  }, [userId, currentAgentId]);

  const currentAgent = useMemo(
    () => agents.find(a => a.id === currentAgentId),
    [agents, currentAgentId]
  );

  /* ============================== CRUD ============================== */
  function addAgent(agent: Agent) {
    setAgents(prev => [agent, ...prev]);
  }

  function saveAgent(agent: Agent) {
    setAgents(prev => {
      const idx = prev.findIndex(a => a.id === agent.id);
      if (idx === -1) return [agent, ...prev];
      const copy = [...prev];
      copy[idx] = agent;
      return copy;
    });
  }

  function updateAgentPartial(agentId: string, patch: Partial<Agent>) {
    setAgents(prev => {
      const i = prev.findIndex(a => a.id === agentId);
      if (i === -1) return prev;
      const updated = { ...prev[i], ...patch };
      const copy = [...prev];
      copy[i] = updated;
      return copy;
    });
  }

  function deleteAgent(agentId: string) {
    setAgents(prev => prev.filter(a => a.id !== agentId));
    if (currentAgentId === agentId) setCurrentAgentId(undefined);
    // also clear thread storage
    try {
      if (isBrowser) sessionStorage.removeItem(threadKey(agentId));
    } catch {}
  }

  /* ============================ VERSIONS ============================ */
  function saveVersion(agentId: string, version: AgentVersion, setActive = true) {
    setAgents(prev => {
      const copy = [...prev];
      const i = copy.findIndex(a => a.id === agentId);
      if (i === -1) return prev;
      const agent = copy[i];

      // prepend new version
      const versions = [version, ...agent.versions];
      copy[i] = {
        ...agent,
        versions,
        activeVersionId: setActive ? version.id : agent.activeVersionId,
        // mirror firstMessage for quick access in UIs
        firstMessage: version.blocks.firstMessage?.trim() ? version.blocks.firstMessage.trim() : agent.firstMessage,
        // also reflect model/temperature/apiKeyId to top-level runtime defaults
        model: version.model ?? agent.model,
        temperature: typeof version.temperature === 'number' ? version.temperature : agent.temperature,
        apiKeyId: version.apiKeyId ?? agent.apiKeyId,
      };
      return copy;
    });
  }

  function activateVersion(agentId: string, versionId: string) {
    setAgents(prev => {
      const copy = [...prev];
      const i = copy.findIndex(a => a.id === agentId);
      if (i === -1) return prev;
      const agent = copy[i];
      const v = agent.versions.find(v => v.id === versionId);
      copy[i] = {
        ...agent,
        activeVersionId: versionId,
        firstMessage: v?.blocks.firstMessage?.trim() || agent.firstMessage,
        model: v?.model ?? agent.model,
        temperature: typeof v?.temperature === 'number' ? v.temperature : agent.temperature,
        apiKeyId: v?.apiKeyId ?? agent.apiKeyId,
      };
      return copy;
    });
  }

  function setFirstMessage(agentId: string, message: string) {
    setAgents(prev => {
      const copy = [...prev];
      const i = copy.findIndex(a => a.id === agentId);
      if (i === -1) return prev;
      copy[i] = { ...copy[i], firstMessage: message?.trim() || undefined };
      return copy;
    });
  }

  /* ========================= THREAD HELPERS =========================
   * Optional centralized per-agent threads. If you decide to move your
   * Improve/Chat pages to use these, it’ll keep behavior consistent.
   * For now, Improve can keep its own sessionStorage logic.
   * ================================================================= */
  function threadKey(agentId: string) {
    return `${NS}:thread:${agentId}`;
  }

  function getThread(agentId: string) {
    if (!isBrowser) return [];
    try {
      const raw = sessionStorage.getItem(threadKey(agentId));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function appendToThread(agentId: string, msg: { role: 'user' | 'assistant'; text: string }) {
    if (!isBrowser) return;
    try {
      const arr = getThread(agentId);
      arr.push({ role: msg.role, text: String(msg.text ?? '') });
      sessionStorage.setItem(threadKey(agentId), JSON.stringify(arr));
    } catch {
      // ignore
    }
  }

  function clearThread(agentId: string) {
    if (!isBrowser) return;
    try {
      sessionStorage.removeItem(threadKey(agentId));
    } catch {
      // ignore
    }
  }

  const value: AgentCtx = {
    userId,
    agents,
    currentAgentId,
    currentAgent,
    setCurrentAgentId,

    addAgent,
    saveAgent,
    updateAgentPartial,
    deleteAgent,

    saveVersion,
    activateVersion,

    setFirstMessage,

    getThread,
    appendToThread,
    clearThread,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* =============================================================================
   HOOK
============================================================================= */
export function useAgentContext() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAgentContext must be used within AgentProvider');
  return ctx;
}

