// lib/chatbots-store.ts
export type ChatBot = {
  id: string;
  ownerId: string;
  name: string;
  model: string;             // e.g. 'gpt-4o-mini'
  temperature: number;       // 0..1
  system: string;            // personality / system prompt
  createdAt: number;
  updatedAt: number;
};

const BOTS = new Map<string, ChatBot>();            // id -> bot
const OWNER_INDEX = new Map<string, Set<string>>(); // ownerId -> ids

function index(ownerId: string, id: string) {
  if (!OWNER_INDEX.has(ownerId)) OWNER_INDEX.set(ownerId, new Set());
  OWNER_INDEX.get(ownerId)!.add(id);
}
function unindex(ownerId: string, id: string) {
  const s = OWNER_INDEX.get(ownerId);
  if (!s) return;
  s.delete(id);
  if (s.size === 0) OWNER_INDEX.delete(ownerId);
}

export function listByOwner(ownerId: string): ChatBot[] {
  const ids = OWNER_INDEX.get(ownerId);
  if (!ids) return [];
  return [...ids].map(id => BOTS.get(id)!).filter(Boolean);
}

export function getById(id: string): ChatBot | null {
  return BOTS.get(id) || null;
}

export function upsert(bot: Partial<ChatBot> & { ownerId: string }): ChatBot {
  const now = Date.now();
  const existing = bot.id ? BOTS.get(bot.id) : undefined;

  const record: ChatBot = {
    id: existing?.id || bot.id || `asst_${Math.random().toString(36).slice(2, 12)}`,
    ownerId: bot.ownerId,
    name: (bot.name ?? existing?.name ?? 'Untitled Agent').trim(),
    model: bot.model ?? existing?.model ?? 'gpt-4o-mini',
    temperature: typeof bot.temperature === 'number' ? bot.temperature :
      (typeof existing?.temperature === 'number' ? existing!.temperature : 0.5),
    system: typeof bot.system === 'string' ? bot.system : (existing?.system ?? ''),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  BOTS.set(record.id, record);
  if (!existing) index(record.ownerId, record.id);
  return record;
}

export function updateById(id: string, patch: Partial<Omit<ChatBot, 'id'|'ownerId'|'createdAt'>>): ChatBot | null {
  const cur = BOTS.get(id);
  if (!cur) return null;
  const upd: ChatBot = {
    ...cur,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.model !== undefined ? { model: patch.model } : {}),
    ...(patch.temperature !== undefined ? { temperature: Number(patch.temperature) } : {}),
    ...(patch.system !== undefined ? { system: String(patch.system) } : {}),
    updatedAt: Date.now(),
  };
  BOTS.set(id, upd);
  return upd;
}

export function removeById(id: string): boolean {
  const cur = BOTS.get(id);
  if (!cur) return false;
  BOTS.delete(id);
  unindex(cur.ownerId, id);
  return true;
}
