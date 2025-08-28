// lib/store.ts
export type Agent = {
  id: string;               // your builder "bot" id
  ownerId: string;          // put your auth user id if you have one
  phoneNumberId: string;    // E.164 like +15551234567
  prompt: string;
  model: string;            // e.g. "gpt-4o-mini"
  openaiApiKey: string;     // user's own key
  ttsVoice: string;         // e.g. "Polly.Joanna" or "alice"
  language: string;         // e.g. "en-US"
  enabled: boolean;
  updatedAt: number;
};

// in-memory (replace with DB/KV later)
const AGENTS = new Map<string, Agent>();          // id -> Agent
const PHONE_TO_AGENT = new Map<string, string>(); // +E164 -> id

export async function upsertAgent(a: Omit<Agent, 'updatedAt'>): Promise<Agent> {
  const agent: Agent = { ...a, updatedAt: Date.now() };
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
