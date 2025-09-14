// lib/store.ts

export type Agent = {
  /** Builder's ID for the bot (what you show in the dashboard) */
  id: string;

  /** Signed-in user id (owner) — REQUIRED for per-account scoping */
  ownerId: string;

  /** Optional display name for the bot */
  name?: string;

  /** Model + temperature are the main “tuning” knobs Improve edits */
  model?: string;            // e.g. "gpt-4o-mini"
  temperature?: number;      // 0..1

  /** Optional prompt/instructions */
  prompt?: string;

  /** Voice/telephony fields some parts of the app use */
  phoneNumberId?: string;    // E.164 like +15551234567
  ttsVoice?: string;         // e.g. "Polly.Joanna" or "alice"
  language?: string;         // e.g. "en-US"

  /** If you let users bring their own key */
  openaiApiKey?: string;

  enabled?: boolean;

  /** Timestamps */
  createdAt: number;
  updatedAt: number;
};

/** In-memory store (replace with DB later). */
const AGENTS = new Map<string, Agent>();          // id -> Agent
const OWNER_INDEX = new Map<string, Set<string>>(); // ownerId -> Set<id>

/** Internal helpers */
function indexAdd(ownerId: string, id: string) {
  if (!OWNER_INDEX.has(ownerId)) OWNER_INDEX.set(ownerId, new Set());
  OWNER_INDEX.get(ownerId)!.add(id);
}
function indexRemove(ownerId: string, id: string) {
  OWNER_INDEX.get(ownerId)?.delete(id);
  if (OWNER_INDEX.get(ownerId)?.size === 0) OWNER_INDEX.delete(ownerId);
}

/** Create or update (used by your Builder “save” route). */
export async function upsertAgent(input: Omit<Agent, 'createdAt' | 'updatedAt'>): Promise<Agent> {
  const existing = AGENTS.get(input.id);
  const now = Date.now();

  const next: Agent = {
    ...existing,
    ...input,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  AGENTS.set(next.id, next);
  if (!existing || existing.ownerId !== next.ownerId) {
    if (existing) indexRemove(existing.ownerId, existing.id);
    indexAdd(next.ownerId, next.id);
  }
  return next;
}

export async function getAgentById(id: string): Promise<Agent | null> {
  return AGENTS.get(id) ?? null;
}

export async function listAgentsByOwner(ownerId: string): Promise<Agent[]> {
  const ids = OWNER_INDEX.get(ownerId);
  if (!ids) return [];
  const out: Agent[] = [];
  ids.forEach(id => {
    const a = AGENTS.get(id);
    if (a) out.push(a);
  });
  return out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export async function updateAgentById(id: string, patch: Partial<Agent>): Promise<Agent> {
  const cur = AGENTS.get(id);
  if (!cur) throw new Error('Not found');
  const next: Agent = { ...cur, ...patch, updatedAt: Date.now() };

  // If owner changed (rare), fix index
  if (patch.ownerId && patch.ownerId !== cur.ownerId) {
    indexRemove(cur.ownerId, id);
    indexAdd(patch.ownerId, id);
  }

  AGENTS.set(id, next);
  return next;
}
