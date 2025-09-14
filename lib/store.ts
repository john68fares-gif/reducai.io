// lib/store.ts

export type Agent = {
  id: string;
  ownerId: string;
  phoneNumberId: string;   // keep required for VoiceAgent
  prompt: string;          // keep required
  model: string;           // keep required
  openaiApiKey: string;    // keep required
  ttsVoice: string;        // keep required
  language: string;        // keep required
  enabled: boolean;

  // extra (optional) for Builder/Improve
  name?: string;
  temperature?: number;    // 0..1
  createdAt?: number;

  updatedAt: number;
};

// in-memory
const AGENTS = new Map<string, Agent>();
const PHONE_TO_AGENT = new Map<string, string>();

export async function upsertAgent(a: Omit<Agent, 'updatedAt'>): Promise<Agent> {
  const prev = AGENTS.get(a.id);
  const createdAt = prev?.createdAt ?? a.createdAt ?? Date.now();
  const agent: Agent = { ...prev, ...a, createdAt, updatedAt: Date.now() };
  AGENTS.set(agent.id, agent);
  if (agent.phoneNumberId) PHONE_TO_AGENT.set(agent.phoneNumberId, agent.id);
  return agent;
}
export async function getAgentById(id: string) { return AGENTS.get(id) || null; }
export async function getAgentByPhoneNumberId(phoneNumberId: string) {
  const id = PHONE_TO_AGENT.get(phoneNumberId);
  return id ? AGENTS.get(id) || null : null;
}
export async function listAgentsByOwner(ownerId?: string) {
  const all = Array.from(AGENTS.values());
  return ownerId ? all.filter(a => a.ownerId === ownerId) : all;
}
export async function updateAgentById(id: string, patch: Partial<Agent>) {
  const cur = AGENTS.get(id);
  if (!cur) throw new Error('Not found');
  const next: Agent = { ...cur, ...patch, updatedAt: Date.now() };
  AGENTS.set(id, next);
  if (patch.phoneNumberId && patch.phoneNumberId !== cur.phoneNumberId) {
    if (cur.phoneNumberId) PHONE_TO_AGENT.delete(cur.phoneNumberId);
    PHONE_TO_AGENT.set(patch.phoneNumberId, id);
  }
  return next;
}
