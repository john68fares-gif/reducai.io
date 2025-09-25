// FILE: components/voice/hooks/useCredentials.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { scopedStorage } from '@/utils/scoped-storage';

/** ------------ Types ------------ **/
export type ApiKey = { id: string; name: string; key?: string };
export type PhoneNum = { id: string; name: string; number: string };

/** ------------ LocalStorage / scopedStorage keys ------------ **/
const LS_KEYS = 'apiKeys.v1';
const LS_SELECTED = 'apiKeys.selectedId';

const PHONE_LIST_KEY_V1 = 'phoneNumbers.v1';     // [{id,name,number}]
const PHONE_LIST_KEY_LEG = 'phoneNumbers';       // legacy
const PHONE_SELECTED_ID = 'phoneNumbers.selectedId';

/** ------------ Helpers ------------ **/
const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';

function normalizeApiKeyList(anyVal: any): ApiKey[] {
  if (!anyVal) return [];
  try {
    if (Array.isArray(anyVal)) {
      const out: ApiKey[] = [];
      for (const k of anyVal) {
        if (!k) continue;
        const id = String(k.id ?? k._id ?? k.keyId ?? k.name ?? '').trim();
        const candidate = k.name ?? k.label ?? k.title ?? id;
        const name = String(candidate ?? 'OpenAI Key').trim();
        const key = k.key ? '••••' : (k.secret || k.value ? '••••' : undefined);
        if (id && name) out.push({ id, name, key });
      }
      return out;
    }
    if (typeof anyVal === 'string' && anyVal.trim().length > 10) {
      return [{ id: 'default', name: 'My OpenAI Key', key: '••••' }];
    }
    if (typeof anyVal === 'object') {
      const maybe = anyVal?.key || anyVal?.openai?.key || anyVal?.openai_key || anyVal?.OPENAI_API_KEY;
      if (typeof maybe === 'string' && maybe.trim().length > 10) {
        return [{ id: 'default', name: 'My OpenAI Key', key: '••••' }];
      }
    }
  } catch {}
  return [];
}

async function loadApiKeysEverywhere(
  currentSelected: string | undefined
): Promise<{ list: ApiKey[]; chosenId: string }> {
  // 1) scopedStorage
  try {
    const store = await scopedStorage().catch(() => null);
    if (store) {
      store.ensureOwnerGuard?.().catch(() => {});
      const v1 = normalizeApiKeyList(await store.getJSON(LS_KEYS, []).catch(() => []));
      const legacy = normalizeApiKeyList(await store.getJSON('apiKeys', []).catch(() => []));
      const c1 = normalizeApiKeyList(await store.getJSON('credentials.apiKeys', []).catch(() => []));
      const c2 = normalizeApiKeyList(await store.getJSON('openai.apiKeys', []).catch(() => []));
      const c3 = normalizeApiKeyList(await store.getJSON('keys.openai', []).catch(() => []));
      const merged = [v1, legacy, c1, c2, c3].find(a => a.length) || [];

      if (!merged.length && IS_CLIENT) {
        // 2) localStorage fallbacks
        const candidates = [
          'credentials.apiKeys', 'openai.apiKeys', 'keys.openai',
          'openai.apiKey', 'openai_key', 'apiKey', 'OPENAI_API_KEY'
        ];
        for (const k of candidates) {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          let parsed: any = null;
          try { parsed = JSON.parse(raw); } catch { parsed = raw; }
          const norm = normalizeApiKeyList(parsed);
          if (norm.length) {
            const chosen = currentSelected && norm.some(x => x.id === currentSelected)
              ? currentSelected
              : (norm[0]?.id || '');
            return { list: norm, chosenId: chosen };
          }
        }
      }

      const globalSelected = await store.getJSON<string>(LS_SELECTED, '').catch(() => '');
      const chosenId =
        (currentSelected && merged.some(k => k.id === currentSelected)) ? currentSelected :
        (globalSelected && merged.some(k => k.id === globalSelected)) ? globalSelected :
        (merged[0]?.id || '');

      if (chosenId && chosenId !== globalSelected) {
        try { await store.setJSON(LS_SELECTED, chosenId); } catch {}
      }

      return { list: merged, chosenId };
    }
  } catch {}

  // 3) optional GET /api/credentials → { apiKeys: [...] }
  try {
    const r = await fetch('/api/credentials').catch(() => null as any);
    const j = await r?.json().catch(() => null as any);
    const list = normalizeApiKeyList(j?.apiKeys || j);
    const chosenId =
      currentSelected && list.some(k => k.id === currentSelected)
        ? currentSelected
        : (list[0]?.id || '');
    return { list, chosenId };
  } catch {}

  return { list: [], chosenId: '' };
}

/** ------------ Hook ------------ **/
export function useCredentials() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedApiKeyId, setSelectedApiKeyIdState] = useState<string>('');

  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNum[]>([]);
  const [selectedPhoneId, setSelectedPhoneIdState] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // API keys
      const { list, chosenId } = await loadApiKeysEverywhere(selectedApiKeyId);
      if (!mountedRef.current) return;
      setApiKeys(list);
      setSelectedApiKeyIdState(chosenId);

      // Phones
      try {
        const store = await scopedStorage().catch(() => null);
        if (store) {
          store.ensureOwnerGuard?.().catch(() => {});
          const v1 = await store.getJSON<PhoneNum[]>(PHONE_LIST_KEY_V1, []).catch(() => []);
          const legacy = await store.getJSON<PhoneNum[]>(PHONE_LIST_KEY_LEG, []).catch(() => []);
          const merged = (Array.isArray(v1) && v1.length) ? v1 : (Array.isArray(legacy) ? legacy : []);
          const cleaned = (merged || [])
            .filter(Boolean)
            .map((p: any) => ({ id: String(p?.id || ''), name: String(p?.name || ''), number: String(p?.number || p?.phone || '') }))
            .filter(p => p.id && (p.number || p.name));

          const storedSel = await store.getJSON<string>(PHONE_SELECTED_ID, '').catch(() => '');
          const chosenPhone =
            (selectedPhoneId && cleaned.some(p => p.id === selectedPhoneId)) ? selectedPhoneId :
            (storedSel && cleaned.some(p => p.id === storedSel)) ? storedSel :
            (cleaned[0]?.id || '');

          if (!mountedRef.current) return;
          setPhoneNumbers(cleaned);
          setSelectedPhoneIdState(chosenPhone);
          if (chosenPhone && chosenPhone !== storedSel) {
            try { await store.setJSON(PHONE_SELECTED_ID, chosenPhone); } catch {}
          }
        } else {
          if (!mountedRef.current) return;
          setPhoneNumbers([]);
          setSelectedPhoneIdState('');
        }
      } catch {
        if (!mountedRef.current) return;
        setPhoneNumbers([]);
        setSelectedPhoneIdState('');
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e?.message || 'Failed to load credentials');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedApiKeyId, selectedPhoneId]);

  // initial + external updates
  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => { mountedRef.current = false; };
  }, [refresh]);

  // Listen for external changes (credentials page, storage)
  useEffect(() => {
    if (!IS_CLIENT) return;
    const onCredsUpdated = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      const k = e.key.toLowerCase();
      if (k.includes('apikey') || k.includes('phone')) refresh();
    };
    window.addEventListener('credentials:updated', onCredsUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('credentials:updated', onCredsUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  // Public setters that also persist to scopedStorage where appropriate
  const setSelectedApiKeyId = useCallback(async (id: string) => {
    setSelectedApiKeyIdState(id);
    try {
      const store = await scopedStorage();
      await store.ensureOwnerGuard?.();
      await store.setJSON(LS_SELECTED, id);
    } catch {}
  }, []);

  const setSelectedPhoneId = useCallback(async (id: string) => {
    setSelectedPhoneIdState(id);
    try {
      const store = await scopedStorage();
      await store.ensureOwnerGuard?.();
      await store.setJSON(PHONE_SELECTED_ID, id);
    } catch {}
  }, []);

  return {
    // API keys
    apiKeys,
    selectedApiKeyId,
    setSelectedApiKeyId,

    // Phone numbers
    phoneNumbers,
    selectedPhoneId,
    setSelectedPhoneId,

    // misc
    refresh,
    loading,
    error,
  };
}
