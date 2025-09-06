// pages/api-keys.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import {
  KeyRound, Plus, ChevronDown, Trash2, CheckCircle2, Zap, X, Key as KeyIcon, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { scopedStorage, migrateLegacyKeysToUser } from '@/utils/scoped-storage';

/* ------------------------------- Types & keys ------------------------------- */
type StoredKey = { id: string; name: string; key: string; createdAt: number };
const LS_KEYS = 'apiKeys.v1';          // cache for Step 2 (scopedStorage)
const LS_SELECTED = 'apiKeys.selectedId';
const isBrowser = typeof window !== 'undefined';

/* ------------------------------- Look & feel -------------------------------- */
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

const FRAME: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: '0 1px 0 rgba(0,0,0,0.22), 0 20px 60px rgba(0,0,0,0.42), 0 85px 220px rgba(0,255,194,0.08)',
  borderRadius: 30,
};
const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const looksLikeOpenAIKey = (v: string) => !!v && v.trim().startsWith('sk-') && v.trim().length >= 12;

/* ------------------------------- Crypto utils ------------------------------- */
/** We store a per-user 32B random base64 key in user_secrets.enc_key (RLS). */
async function getOrCreateUserSecret(): Promise<ArrayBuffer> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('user_secrets')
    .select('enc_key')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;

  if (data?.enc_key) {
    return base64ToBuf(data.enc_key);
  }
  // create one
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const enc_key = bufToBase64(raw.buffer);
  const { error: insErr } = await supabase.from('user_secrets').insert({ user_id: user.id, enc_key });
  if (insErr) throw insErr;
  return raw.buffer;
}

async function importAesKey(raw: ArrayBuffer) {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
function bufToBase64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ToBuf(b64: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}
async function encryptString(aesKey: CryptoKey, plaintext: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const enc = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc);
  // store base64(iv || cipher)
  const joined = new Uint8Array(iv.byteLength + (cipher as ArrayBuffer).byteLength);
  joined.set(iv, 0);
  joined.set(new Uint8Array(cipher as ArrayBuffer), iv.byteLength);
  return bufToBase64(joined.buffer);
}
async function decryptString(aesKey: CryptoKey, b64: string): Promise<string> {
  const joined = new Uint8Array(base64ToBuf(b64));
  const iv = joined.slice(0, 12);
  const cipher = joined.slice(12);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipher);
  return new TextDecoder().decode(dec);
}

/* ------------------------------ InlineSelect UI ----------------------------- */
type Opt = { value: string; label: string; sub?: string };
function InlineSelect({
  id, value, onChange, options, placeholder = 'No API Keys',
}: { id?: string; value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string }) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const sel = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 8, left: r.left, width: r.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <>
      <button
        id={id}
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 h-[46px] rounded-[14px] text-sm outline-none transition hover:-translate-y-[1px]"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        <span className="flex items-center gap-2 truncate">
          <KeyRound className="w-4 h-4" style={{ color: 'var(--brand)' }} />
        </span>
        <span className="flex-1 text-left truncate">
          {sel ? (<>{sel.label}{sel.sub ? <span style={{ color: 'var(--text-muted)' }} className="ml-2">••••{sel.sub}</span> : null}</>)
            : <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>}
        </span>
        <ChevronDown className="w-4 h-4 opacity-80" style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && rect && (
        <div ref={portalRef} className="fixed z-[9999] p-2 animate-[fadeIn_120ms_ease-out]"
             style={{ ...CARD, left: rect.left, top: rect.top, width: rect.width }}>
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>No items.</div>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-[10px] flex items-center gap-2 hover:bg-[rgba(0,0,0,0.04)] transition"
              style={{ color: 'var(--text)' }}
            >
              <KeyRound className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              <span className="flex-1 truncate">{o.label}</span>
              {o.sub && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>••••{o.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* -------------------------------- Add modal -------------------------------- */
function AddKeyModal({
  open, onClose, onSave,
}: { open: boolean; onClose: () => void; onSave: (name: string, key: string) => Promise<void> | void }) {
  const [name, setName] = useState(''); const [val, setVal] = useState('');
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setName(''); setVal(''); setError(''); setSaving(false); } }, [open]);
  if (!open) return null;

  const trimmed = val.trim();
  const canSave = name.trim().length > 1 && looksLikeOpenAIKey(trimmed);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4 animate-[fadeIn_140ms_ease]"
         style={{ background: 'rgba(0,0,0,0.60)' }}>
      <div className="w-full max-w-[740px] rounded-[24px] overflow-hidden animate-[popIn_140ms_ease]" style={FRAME}>
        <div className="flex items-center justify-between px-7 py-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--brand-weak)' }}>
              <KeyIcon className="w-6 h-6" style={{ color: 'var(--brand)' }} />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Add New Project API Key</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Stored in your account (encrypted) + cached locally.</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:opacity-70">
            <X className="w-5 h-5" style={{ color: 'var(--text)' }} />
          </button>
        </div>

        <div className="px-7 py-6 space-y-5">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Project Name <span style={{ color: 'var(--brand)' }}>*</span>
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="e.g., My Main Project, Test Environment"
                   className="w-full rounded-[14px] border px-4 h-[46px] text-sm outline-none"
                   style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              OpenAI API Key <span style={{ color: 'var(--brand)' }}>*</span>
            </label>
            <input type="password" value={val}
                   onChange={(e) => { setVal(e.target.value); setError(''); }}
                   placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                   className="w-full rounded-[14px] border px-4 h-[46px] text-sm outline-none"
                   style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            <div className="mt-2 text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <ShieldCheck className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              We validate format only (CORS blocks live check to OpenAI in-browser).
            </div>
            {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
          </div>
        </div>

        <div className="px-7 pb-7 flex gap-3">
          <button onClick={onClose}
                  className="w-full h-[46px] rounded-[18px] font-semibold"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            Cancel
          </button>

          <button disabled={!canSave || saving}
                  onClick={async () => {
                    if (!canSave) { setError('Please enter a project name and a key that starts with sk-'); return; }
                    setSaving(true);
                    await sleep(380 + Math.random() * 240);
                    try { await onSave(name.trim(), trimmed); }
                    catch (e: any) { setError(e?.message || 'Failed to save'); }
                    finally { setSaving(false); }
                  }}
                  className="w-full h-[46px] rounded-[18px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: BTN_GREEN, color: '#fff' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}>
            {saving ? (<><span className="w-4 h-4 rounded-full border-2 border-white/50 border-t-transparent animate-spin" />Saving…</>)
                    : (<><KeyRound className="w-4 h-4" />Save API Key</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Toast ---------------------------------- */
function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2400); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[9997] pointer-events-none flex items-center justify-center">
      <div className="pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl animate-[popIn_120ms_ease]"
           style={{ ...CARD, border: '1px solid var(--brand)', background: 'var(--panel)', color: 'var(--text)', boxShadow: '0 18px 60px rgba(0,0,0,0.4)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--brand-weak)' }}>
          <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--brand)' }} />
        </div>
        <div className="text-sm">{text}</div>
        <button onClick={onClose} className="ml-2 p-1 rounded hover:opacity-70">
          <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------- Page ----------------------------------- */
export default function ApiKeysPage() {
  const [list, setList] = useState<StoredKey[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // load from Supabase (and cache)
  useEffect(() => {
    (async () => {
      await migrateLegacyKeysToUser();
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();

      try {
        // Optimistic: show cached immediately if present
        const cached = await ss.getJSON<StoredKey[]>(LS_KEYS, []);
        if (cached.length) setList(cached);

        const raw = await getOrCreateUserSecret();
        const aesKey = await importAesKey(raw);

        const { data, error } = await supabase
          .from('user_api_keys')
          .select('id,name,ciphertext,created_at')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const decrypted: StoredKey[] = [];
        for (const row of data || []) {
          try {
            const key = await decryptString(aesKey, row.ciphertext);
            decrypted.push({ id: row.id, name: row.name, key, createdAt: Date.parse(row.created_at) || Date.now() });
          } catch { /* skip bad rows */ }
        }
        setList(decrypted);
        await ss.setJSON(LS_KEYS, decrypted);

        const chosen = await ss.getJSON<string>(LS_SELECTED, '');
        if (chosen && decrypted.find((k) => k.id === chosen)) setSelected(chosen);
        else if (decrypted[0]) setSelected(decrypted[0].id);
      } finally {
        await sleep(140);
        setLoading(false);
      }
    })();
  }, []);

  // persist selected id (scoped)
  useEffect(() => {
    (async () => {
      if (!isBrowser) return;
      const ss = await scopedStorage();
      if (selected) await ss.setJSON(LS_SELECTED, selected);
      else await ss.remove(LS_SELECTED);
    })();
  }, [selected]);

  const opts: Opt[] = useMemo(
    () => list.map((k) => ({ value: k.id, label: k.name, sub: (k.key || '').slice(-4).toUpperCase() })),
    [list]
  );
  const selectedKey = list.find((k) => k.id === selected) || null;

  async function refreshFromServer() {
    // small helper if you want a Refresh button later
    setLoading(true);
    const raw = await getOrCreateUserSecret();
    const aesKey = await importAesKey(raw);
    const { data } = await supabase
      .from('user_api_keys')
      .select('id,name,ciphertext,created_at')
      .order('created_at', { ascending: false });
    const out: StoredKey[] = [];
    for (const row of data || []) {
      try { out.push({ id: row.id, name: row.name, key: await decryptString(aesKey, row.ciphertext), createdAt: Date.parse(row.created_at) }); }
      catch {}
    }
    const ss = await scopedStorage();
    await ss.setJSON(LS_KEYS, out);
    setList(out);
    setLoading(false);
  }

  async function addKey(name: string, key: string) {
    const raw = await getOrCreateUserSecret();
    const aesKey = await importAesKey(raw);
    const ciphertext = await encryptString(aesKey, key);
    const { data, error } = await supabase.from('user_api_keys').insert({ name, ciphertext }).select('id,created_at').single();
    if (error) throw error;

    const next: StoredKey = { id: data.id, name, key, createdAt: Date.parse(data.created_at) || Date.now() };
    const updated = [next, ...list];
    setList(updated);
    setSelected(next.id);

    const ss = await scopedStorage();
    await ss.setJSON(LS_KEYS, updated);

    setShowAdd(false);
    setToast(`API Key “${name}” saved`);
  }

  async function removeKey(id: string) {
    await supabase.from('user_api_keys').delete().eq('id', id);
    const updated = list.filter((k) => k.id !== id);
    setList(updated);

    const ss = await scopedStorage();
    await ss.setJSON(LS_KEYS, updated);

    if (selected === id) setSelected(updated[0]?.id || '');
    const removedName = list.find((k) => k.id === id)?.name || 'project';
    setToast(`API Key for “${removedName}” removed`);
  }

  function testKey() {
    const ok = !!selectedKey?.key;
    setToast(ok ? 'API Key looks set. You can use it in Step 2.' : 'No API Key selected.');
  }

  return (
    <div className="px-6 py-10" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="mx-auto w-full max-w-[980px]">
        <div className="relative" style={FRAME}>
          <div className="flex items-start justify-between px-6 lg:px-8 py-6">
            <div>
              <h1 className="text-2xl font-semibold">API Keys</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage your OpenAI API keys for different projects</p>
            </div>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'var(--brand-weak)' }}>
              <KeyRound className="w-5 h-5" style={{ color: 'var(--brand)' }} />
            </div>
          </div>

          <div className="px-6 lg:px-8 pb-8 space-y-5">
            {loading ? (
              <div className="space-y-4">
                <div className="h-[46px] rounded-[14px] animate-pulse"
                     style={{ ...CARD, background: 'linear-gradient(90deg, var(--card) 25%, var(--panel) 37%, var(--card) 63%)', backgroundSize: '200% 100%' }} />
                <div className="h-[74px] rounded-[14px] animate-pulse"
                     style={{ ...CARD, background: 'linear-gradient(90deg, var(--card) 25%, var(--panel) 37%, var(--card) 63%)', backgroundSize: '200% 100%' }} />
                <div className="flex gap-4">
                  <div className="h-[46px] flex-1 rounded-[14px] animate-pulse"
                       style={{ ...CARD, background: 'linear-gradient(90deg, var(--card) 25%, var(--panel) 37%, var(--card) 63%)', backgroundSize: '200% 100%' }} />
                  <div className="h-[46px] w-[220px] rounded-[18px] animate-pulse"
                       style={{ ...CARD, background: 'linear-gradient(90deg, var(--card) 25%, var(--panel) 37%, var(--card) 63%)', backgroundSize: '200% 100%' }} />
                </div>
              </div>
            ) : list.length === 0 ? (
              <div className="text-center py-10">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full grid place-items-center border-2 border-dashed"
                     style={{ borderColor: 'rgba(0,255,194,0.35)', background: 'rgba(0,255,194,0.04)' }}>
                  <KeyRound className="w-6 h-6 animate-pulse" style={{ color: 'var(--brand)' }} />
                </div>
                <div className="text-lg font-medium">No API Keys Found</div>
                <div className="text-sm mt-1 mb-6" style={{ color: 'var(--text-muted)' }}>Add your first API key to get started</div>
                <button onClick={() => setShowAdd(true)}
                        className="inline-flex items-center gap-2 px-5 h-[46px] rounded-[18px] font-semibold"
                        style={{ background: BTN_GREEN, color: '#fff' }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}>
                  <Plus className="w-4 h-4" /> Add New API Key
                </button>
              </div>
            ) : (
              <>
                <div style={CARD} className="p-4">
                  <label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Select API Key</label>
                  <InlineSelect id="apikey-select" value={selected} onChange={setSelected} options={opts} placeholder="No API Keys" />
                </div>

                <div style={CARD} className="p-4">
                  {selectedKey ? (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-weak)' }}>
                        <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{selectedKey.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Key ending in ••••{(selectedKey.key || '').slice(-4).toUpperCase()}
                        </div>
                      </div>
                      <button onClick={() => removeKey(selectedKey.id)} className="p-2 rounded-lg hover:opacity-80" aria-label="Delete">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>No API Keys Found</div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <button onClick={() => setShowAdd(true)}
                          className="inline-flex items-center gap-2 px-4 h-[46px] rounded-[14px] font-semibold transition hover:-translate-y-[1px]"
                          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <Plus className="w-4 h-4" /> Add New API Key
                  </button>

                  <button onClick={testKey}
                          className="flex-1 h-[46px] rounded-[18px] font-semibold flex items-center justify-center gap-2"
                          style={{ background: BTN_GREEN, color: '#fff' }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}>
                    <Zap className="w-4 h-4" /> Test API Key
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <AddKeyModal open={showAdd} onClose={() => setShowAdd(false)} onSave={addKey} />
      {toast && <Toast text={toast} onClose={() => setToast(undefined)} />}

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn { 0% { opacity: 0; transform: translateY(8px) scale(.98) }
                           100% { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
}
