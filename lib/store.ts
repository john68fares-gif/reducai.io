// lib/store.ts
// Minimal Agent storage with an optional Vercel KV adapter.
// In production, protect these endpoints with auth & encrypt apiKey.

export type Agent = {
  id: string;                // agent id
  ownerId: string;           // your app's user id (string)
  phoneNumberId: string;     // Twilio CalledSid or E.164
  prompt: string;            // system prompt
  model: string;             // e.g. "gpt-4o-mini"
  openaiApiKey: string;      // user's own API key
  enabled: boolean;
  updatedAt: number;
};

const useKV = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

// ---- KV adapter (optional) ----
async function kvGet<T>(key: string): Promise<T | null> {
  if (!useKV) return null;
  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN!}` },
    cache: 'no-store',
  });
  if (!r.ok) return null;
  const json = await r.json();
  return json?.result ?? null;
}
async function kvSet<T>(key: string, val: T): Promise<void> {
  if (!useKV) return;
  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`;
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(val),
  });
}

// ---- Memory fallback (dev) ----
const mem = new Map<string, Agent>(); // by id
const memIndexByPhone = new Map<string, string>(); // phoneNumberId -> id

function kAgent(id: string) { return `agent:${id}`; }
function kPhone(phone: string) { return `phoneIndex:${phone}`; }

export async function upsertAgent(a: Omit<Agent, 'updatedAt'>): Promise<Agent> {
  const agent: Agent = { ...a, updatedAt: Date.now() };

  if (useKV) {
    await kvSet(kAgent(agent.id), agent);
    await kvSet(kPhone(agent.phoneNumberId), agent.id);
    return agent;
  }

  mem.set(agent.id, agent);
  memIndexByPhone.set(agent.phoneNumberId, agent.id);
  return agent;
}

export async function getAgentById(id: string): Promise<Agent | null> {
  if (useKV) return (await kvGet<Agent>(kAgent(id))) || null;
  return mem.get(id) || null;
}

export async function getAgentByPhoneNumberId(phoneNumberId: string): Promise<Agent | null> {
  if (useKV) {
    const agentId = await kvGet<string>(kPhone(phoneNumberId));
    if (!agentId) return null;
    return (await kvGet<Agent>(kAgent(agentId))) || null;
  }
  const id = memIndexByPhone.get(phoneNumberId);
  return id ? mem.get(id) || null : null;
}
