// lib/store.ts

export type Agent = {
  id: string;               // your builder "bot" id
  ownerId: string;          // auth user id (if you have one)
  phoneNumberId: string;    // E.164 like +15551234567
  prompt: string;
  model: string;            // e.g. "gpt-4o-mini"
  openaiApiKey: string;     // user's own key
  ttsVoice: string;         // e.g. "Polly.Joanna" or "alice"
  language: string;         // e.g. "en-US"
  enabled: boolean;

  // NEW (optional) — useful for Builder/Improve UI
  name?: string;
  temperature?: number;     // 0..1
  createdAt?: number;       // ms epoch

  updatedAt: number;        // ms epoch
};

// In-memory (replace with DB/KV later)
const AGENTS = new Map<string, Agent>();          // id -> Agent
const PHONE_TO_AGENT = new Map<string, string>(); // +E164 -> id

/** Create or replace an agent. Preserves createdAt if it already exists. */
export async function upsertAgent(a: Omit<Agent, 'updatedAt'>): Promise<Agent> {
  const prev = AGENTS.get(a.id);
  const createdAt = prev?.createdAt ?? a.createdAt ?? Date.now();
  const agent: Agent = { ...prev, ...a, createdAt, updatedAt: Date.now() };
  AGENTS.set(agent.id, agent);
  if (agent.phoneNumberId) PHONE_TO_AGENT.set(agent.phoneNumberId, agent.id);
  return agent;
}

export async function getAgentById(id: string) {
  return AGENTS.get(id) || null;
}

export async function getAgentByPhoneNumberId(phoneNumberId: string) {
  const id = PHONE_TO_AGENT.get(phoneNumberId);
  return id ? AGENTS.get(id) || null : null;
}

/** NEW: list all agents, optionally filtered by ownerId (for per-account views). */
export async function listAgentsByOwner(ownerId?: string): Promise<Agent[]> {
  const all = Array.from(AGENTS.values());
  return ownerId ? all.filter(a => a.ownerId === ownerId) : all;
}

/** NEW: partial update (used by /api/chatbots/[id].ts for model/temp/prompt/etc). */
export async function updateAgentById(id: string, patch: Partial<Agent>): Promise<Agent> {
  const cur = AGENTS.get(id);
  if (!cur) throw new Error('Not found');
  const next: Agent = { ...cur, ...patch, updatedAt: Date.now() };
  AGENTS.set(id, next);

  // keep phone → agent mapping in sync if phoneNumberId changes
  if (patch.phoneNumberId && patch.phoneNumberId !== cur.phoneNumberId) {
    if (cur.phoneNumberId) PHONE_TO_AGENT.delete(cur.phoneNumberId);
    PHONE_TO_AGENT.set(patch.phoneNumberId, id);
  }
  return next;
}

// Optional helper for tests/debug
export async function _resetStore() {
  AGENTS.clear();
  PHONE_TO_AGENT.clear();
}
