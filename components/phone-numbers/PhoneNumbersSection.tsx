// pages/phone-numbers.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import {
  Phone, Plus, ChevronDown, Trash2, CheckCircle2, Zap, X, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { scopedStorage, migrateLegacyKeysToUser } from '@/utils/scoped-storage';

/* ------------------------------- Types & keys ------------------------------- */
type TwilioSecret = { sid: string; token: string };
type StoredNumber = {
  id: string;
  label: string;
  phone: string;         // E.164
  provider: 'twilio';
  createdAt: number;
  secret?: TwilioSecret; // decrypted on client
};

const LS_NUMBERS = 'phoneNumbers.v1';
const LS_SELECTED = 'phoneNumbers.selectedId';
const isBrowser = typeof window !== 'undefined';

/* ------------------------------- Look & feel -------------------------------- */
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

const FRAME: React.CSSProperties = {
  background: 'var(--frame-bg, var(--panel))',
  border: '1px solid var(--border)',
  boxShadow: 'var(--frame-shadow, var(--shadow-soft))',
  borderRadius: 30,
};
const CARD: React.CSSProperties = {
  background: 'var(--card-bg, var(--card))',
  border: '1px solid var(--border)',
  boxShadow: 'var(--card-shadow, var(--shadow-card))',
  borderRadius: 20,
};

const looksLikeE164 = (v: string) => /^\+\d{7,15}$/.test(v.trim());
const looksLikeSid  = (v: string) => /^AC[a-zA-Z0-9]{32}$/.test(v.trim());
const looksLikeToken= (v: string) => v.trim().length >= 16;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------- Crypto utils ------------------------------- */
async function getOrCreateUserSecret(): Promise<ArrayBuffer> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('user_secrets')
    .select('enc_key')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;

  if (data?.enc_key) return base64ToBuf(data.enc_key);

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
  for (let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return arr.buffer;
}
async function encryptString(aesKey: CryptoKey, plaintext: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const enc = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc);
  const joined = new Uint8Array(iv.byteLength + (cipher as ArrayBuffer).byteLength);
  joined.set(iv, 0);
  joined.set(new Uint8Array(cipher as ArrayBuffer), iv.byteLength);
  return bufToBase64(joined.buffer);
}
async function decryptString(aesKey: CryptoKey, b64: string): Promise<string> {
  const joined = new Uint8Array(base64ToBuf(b64));
  const iv = joined.slice(0,12);
  const cipher = joined.slice(12);
  const dec = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, aesKey, cipher);
  return new TextDecoder().decode(dec);
}

/* ------------------------------ InlineSelect UI ----------------------------- */
type Opt = { value: string; label: string; sub?: string };
function InlineSelect({
  id, value, onChange, options, placeholder='No Phone Numbers',
}: { id?: string; value: string; onChange:(v:string)=>void; options: Opt[]; placeholder?: string }) {
  const btnRef = useRef<HTMLButtonElement|null>(null);
  const portalRef = useRef<HTMLDivElement|null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top:number; left:number; width:number }|null>(null);
  const sel = useMemo(()=> options.find(o=>o.value===value) || null, [options,value]);

  useLayoutEffect(()=>{
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ top:r.bottom+8, left:r.left, width:r.width });
  },[open]);

  useEffect(()=>{
    if (!open) return;
    const onClick=(e:MouseEvent)=>{
      if (btnRef.current?.contains(e.target as Node)) return;
      if (portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return ()=> window.removeEventListener('mousedown', onClick);
  },[open]);

  return (
    <>
      <button
        id={id}
        ref={btnRef}
        onClick={()=>setOpen(v=>!v)}
        className="w-full flex items-center justify-between gap-3 px-4 h-[46px] rounded-[14px] text-sm outline-none transition hover:-translate-y-[1px]"
        style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', boxShadow:'var(--chip-shadow, none)' }}
      >
        <span className="flex items-center gap-2 truncate">
          <Phone className="w-4 h-4" style={{ color:'var(--brand)' }} />
        </span>
        <span className="flex-1 text-left truncate">
          {sel ? (<>{sel.label}{sel.sub ? <span style={{color:'var(--text-muted)'}} className="ml-2">{sel.sub}</span> : null}</>)
               : <span style={{ color:'var(--text-muted)' }}>{placeholder}</span>}
        </span>
        <ChevronDown className="w-4 h-4 opacity-80" style={{ color:'var(--text-muted)' }} />
      </button>

      {open && rect && (
        <div ref={portalRef} className="fixed z-[9999] p-2 animate-[fadeIn_120ms_ease-out]"
             style={{ ...CARD, left:rect.left, top:rect.top, width:rect.width }}>
          {options.length===0 && <div className="px-3 py-2 text-sm" style={{color:'var(--text-muted)'}}>No items.</div>}
          {options.map(o=>(
            <button key={o.value}
              onClick={()=>{ onChange(o.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-[10px] flex items-center gap-2 hover:bg-[rgba(0,0,0,0.04)] transition"
              style={{ color:'var(--text)' }}>
              <Phone className="w-4 h-4" style={{ color:'var(--brand)' }} />
              <span className="flex-1 truncate">{o.label}</span>
              {o.sub && <span className="text-xs" style={{ color:'var(--text-muted)' }}>{o.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* -------------------------------- Add modal -------------------------------- */
function AddNumberModal({
  open, onClose, onSave,
}: { open:boolean; onClose:()=>void; onSave:(v:{label:string; phone:string; sid:string; token:string})=>Promise<void>|void }) {
  const [label,setLabel]=useState(''); const [phone,setPhone]=useState('');
  const [sid,setSid]=useState(''); const [token,setToken]=useState('');
  const [error,setError]=useState(''); const [saving,setSaving]=useState(false);
  useEffect(()=>{ if(open){ setLabel(''); setPhone(''); setSid(''); setToken(''); setError(''); setSaving(false);} },[open]);
  if(!open) return null;

  const canSave = label.trim().length>1 && looksLikeE164(phone) && looksLikeSid(sid) && looksLikeToken(token);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4 animate-[fadeIn_140ms_ease]"
         style={{ background:'rgba(0,0,0,0.60)' }}>
      <div className="w-full max-w-[780px] rounded-[24px] overflow-hidden animate-[popIn_140ms_ease]" style={FRAME}>
        <div className="flex items-center justify-between px-7 py-6" style={{ borderBottom:'1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background:'var(--brand-weak)' }}>
              <Phone className="w-6 h-6" style={{ color:'var(--brand)' }} />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-semibold" style={{ color:'var(--text)' }}>Add Twilio Number</div>
              <div className="text-sm" style={{ color:'var(--text-muted)' }}>Your number + Twilio SID/Token are encrypted and stored in your account.</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:opacity-70">
            <X className="w-5 h-5" style={{ color:'var(--text)' }} />
          </button>
        </div>

        <div className="px-7 py-6 grid gap-5 md:grid-cols-2">
          <div className="md:col-span-1">
            <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Label</label>
            <input value={label} onChange={(e)=>setLabel(e.target.value)} placeholder="Support line"
                   className="w-full rounded-[14px] border px-4 h-[46px] text-sm outline-none"
                   style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }} />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Phone (E.164)</label>
            <input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+15551234567"
                   className="w-full rounded-[14px] border px-4 h-[46px] text-sm outline-none"
                   style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }} />
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Twilio Account SID</label>
            <input value={sid} onChange={(e)=>setSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                   className="w-full rounded-[14px] border px-4 h-[46px] text-sm outline-none"
                   style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }} />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Twilio Auth Token</label>
            <input type="password" value={token} onChange={(e)=>setToken(e.target.value)} placeholder="••••••••••••••••"
                   className="w-full rounded-[14px] border px-4 h-[46px] text-sm outline-none"
                   style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }} />
            <div className="mt-2 text-xs flex items-center gap-2" style={{ color:'var(--text-muted)' }}>
              <ShieldCheck className="w-4 h-4" style={{ color:'var(--brand)' }} />
              We validate format locally and store encrypted (AES-GCM).
            </div>
            {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
          </div>
        </div>

        <div className="px-7 pb-7 flex gap-3">
          <button onClick={onClose}
                  className="w-full h-[46px] rounded-[18px] font-semibold"
                  style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)' }}>
            Cancel
          </button>

          <button disabled={!canSave || saving}
                  onClick={async ()=>{
                    if(!canSave){ setError('Add a label, E.164 phone, valid SID and token.'); return; }
                    setSaving(true);
                    await sleep(300);
                    try { await onSave({ label:label.trim(), phone:phone.trim(), sid:sid.trim(), token:token.trim() }); }
                    catch(e:any){ setError(e?.message || 'Failed to save'); }
                    finally{ setSaving(false); }
                  }}
                  className="w-full h-[46px] rounded-[18px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background:BTN_GREEN, color:'#fff' }}
                  onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN_HOVER)}
                  onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN)}>
            <Plus className="w-4 h-4" /> Save Number
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Toast ---------------------------------- */
function Toast({ text, onClose }: { text:string; onClose:()=>void }) {
  useEffect(()=>{ const t = setTimeout(onClose, 2200); return ()=>clearTimeout(t); },[onClose]);
  return (
    <div className="fixed inset-0 z-[9997] pointer-events-none flex items-center justify-center">
      <div className="pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl animate-[popIn_120ms_ease]"
           style={{ ...CARD, border:'1px solid var(--brand)', background:'var(--panel)', color:'var(--text)', boxShadow:'0 18px 60px rgba(0,0,0,0.4)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background:'var(--brand-weak)' }}>
          <CheckCircle2 className="w-5 h-5" style={{ color:'var(--brand)' }} />
        </div>
        <div className="text-sm">{text}</div>
        <button onClick={onClose} className="ml-2 p-1 rounded hover:opacity-70">
          <X className="w-4 h-4" style={{ color:'var(--text-muted)' }} />
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------- Page ----------------------------------- */
export default function PhoneNumbersPage(){
  const [list,setList]=useState<StoredNumber[]>([]);
  const [selected,setSelected]=useState<string>('');
  const [openAdd,setOpenAdd]=useState(false);
  const [toast,setToast]=useState<string>();
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async ()=>{
      await migrateLegacyKeysToUser(); // harmless here, keeps same pattern
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();

      try{
        const cached = await ss.getJSON<StoredNumber[]>(LS_NUMBERS, []);
        if(cached.length) setList(cached);

        const raw = await getOrCreateUserSecret();
        const aes = await importAesKey(raw);

        // Change table name here if yours differs
        const { data, error } = await supabase
          .from('user_phone_numbers')
          .select('id,label,phone_e164,provider,ciphertext,created_at')
          .order('created_at', { ascending:false });

        if(error) throw error;

        const out: StoredNumber[] = [];
        for (const row of (data || [])){
          let secret: TwilioSecret|undefined;
          try{
            if(row.ciphertext){
              const dec = await decryptString(aes, row.ciphertext);
              secret = JSON.parse(dec);
            }
          }catch{}
          out.push({
            id:row.id,
            label:row.label || row.phone_e164,
            phone:row.phone_e164,
            provider:'twilio',
            createdAt: Date.parse(row.created_at) || Date.now(),
            secret
          });
        }
        setList(out);
        await ss.setJSON(LS_NUMBERS, out);

        const chosen = await ss.getJSON<string>(LS_SELECTED, '');
        if (chosen && out.find(n=>n.id===chosen)) setSelected(chosen);
        else if (out[0]) setSelected(out[0].id);
      } finally {
        await sleep(120);
        setLoading(false);
      }
    })();
  },[]);

  useEffect(()=>{
    (async ()=>{
      if(!isBrowser) return;
      const ss = await scopedStorage();
      if(selected) await ss.setJSON(LS_SELECTED, selected);
      else await ss.remove(LS_SELECTED);
    })();
  },[selected]);

  const opts: Opt[] = useMemo(
    ()=> list.map(n=>({ value:n.id, label:`${n.label}`, sub:n.phone })),
    [list]
  );
  const current = list.find(n=>n.id===selected) || null;

  async function addNumber(v:{label:string; phone:string; sid:string; token:string}){
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) throw new Error('Not signed in');

    const raw = await getOrCreateUserSecret();
    const aes = await importAesKey(raw);
    const ciphertext = await encryptString(aes, JSON.stringify({ sid:v.sid, token:v.token }));

    const { data, error } = await supabase
      .from('user_phone_numbers') // change if needed
      .insert({
        user_id: user.id,
        label: v.label,
        phone_e164: v.phone,
        provider: 'twilio',
        ciphertext
      })
      .select('id,created_at')
      .single();

    if(error) throw error;

    const next: StoredNumber = {
      id: data.id,
      label: v.label,
      phone: v.phone,
      provider: 'twilio',
      createdAt: Date.parse(data.created_at) || Date.now(),
      secret: { sid:v.sid, token:v.token }
    };
    const updated = [next, ...list];
    setList(updated);
    setSelected(next.id);

    const ss = await scopedStorage();
    await ss.setJSON(LS_NUMBERS, updated);

    setOpenAdd(false);
    setToast(`Number “${v.label}” added`);
  }

  async function removeNumber(id:string){
    await supabase.from('user_phone_numbers').delete().eq('id', id);
    const updated = list.filter(n=>n.id!==id);
    setList(updated);
    const ss = await scopedStorage();
    await ss.setJSON(LS_NUMBERS, updated);
    if(selected===id) setSelected(updated[0]?.id || '');
    setToast('Number removed');
  }

  function testConnection(){
    // purely UI for now (no live Twilio call from browser)
    const ok = !!current?.secret?.sid && !!current?.secret?.token;
    setToast(ok ? 'Twilio credentials look set.' : 'Select a number with SID/Token.');
  }

  return (
    <div className="px-6 py-10" style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* small section label above the panel */}
      <div className="mx-auto w-full max-w-[980px] mb-3">
        <div className="text-xs font-semibold tracking-[.12em] opacity-70" style={{ color:'var(--text-muted)' }}>
          PHONE NUMBERS
        </div>
      </div>

      <div className="mx-auto w-full max-w-[980px] pn-panel">
        <div className="relative" style={FRAME}>
          <div className="flex items-start justify-between px-6 lg:px-8 py-6">
            <div>
              <h1 className="text-2xl font-semibold">Phone Numbers</h1>
              <p className="text-sm mt-1" style={{ color:'var(--text-muted)' }}>
                Connect your own <b>Twilio</b> number. We only support Twilio for now.
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                 style={{ background:'var(--brand-weak)', boxShadow:'var(--chip-shadow, none)' }}>
              <Phone className="w-5 h-5" style={{ color:'var(--brand)' }} />
            </div>
          </div>

          <div className="px-6 lg:px-8 pb-8 space-y-5">
            {loading ? (
              <div className="space-y-4">
                <div className="h-[46px] rounded-[14px] skeleton" />
                <div className="h-[74px] rounded-[14px] skeleton" />
                <div className="flex gap-4">
                  <div className="h-[46px] flex-1 rounded-[14px] skeleton" />
                  <div className="h-[46px] w-[220px] rounded-[18px] skeleton" />
                </div>
              </div>
            ) : list.length === 0 ? (
              <div className="text-center py-10">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full grid place-items-center border-2 border-dashed"
                     style={{ borderColor:'rgba(0,255,194,0.35)', background:'rgba(0,255,194,0.04)' }}>
                  <Phone className="w-6 h-6 animate-pulse" style={{ color:'var(--brand)' }} />
                </div>
                <div className="text-lg font-medium">No Numbers Connected</div>
                <div className="text-sm mt-1 mb-6" style={{ color:'var(--text-muted)' }}>
                  Add your first Twilio number to get started
                </div>
                <button onClick={()=>setOpenAdd(true)}
                        className="inline-flex items-center gap-2 px-5 h-[46px] rounded-[18px] font-semibold"
                        style={{ background:BTN_GREEN, color:'#fff' }}
                        onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN_HOVER)}
                        onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN)}>
                  <Plus className="w-4 h-4" /> Add Twilio Number
                </button>
              </div>
            ) : (
              <>
                <div style={CARD} className="p-4">
                  <label className="block text-xs mb-2" style={{ color:'var(--text-muted)' }}>Select Number</label>
                  <InlineSelect id="number-select" value={selected} onChange={setSelected}
                                options={opts} placeholder="No Numbers" />
                </div>

                <div style={CARD} className="p-4">
                  {current ? (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'var(--brand-weak)' }}>
                        <CheckCircle2 className="w-4 h-4" style={{ color:'var(--brand)' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{current.label} <span className="opacity-70">({current.phone})</span></div>
                        <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                          Provider: Twilio • SID: {current.secret?.sid ? current.secret.sid.slice(0,6)+'…' : '—'}
                        </div>
                      </div>
                      <button onClick={()=>removeNumber(current.id)} className="p-2 rounded-lg hover:opacity-80" aria-label="Delete">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ) : (
                    <div style={{ color:'var(--text-muted)' }}>No number selected</div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <button onClick={()=>setOpenAdd(true)}
                          className="inline-flex items-center gap-2 px-4 h-[46px] rounded-[14px] font-semibold transition hover:-translate-y-[1px]"
                          style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)' }}>
                    <Plus className="w-4 h-4" /> Add Twilio Number
                  </button>

                  <button onClick={testConnection}
                          className="flex-1 h-[46px] rounded-[18px] font-semibold flex items-center justify-center gap-2"
                          style={{ background:BTN_GREEN, color:'#fff' }}
                          onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN_HOVER)}
                          onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN)}>
                    <Zap className="w-4 h-4" /> Test Connection
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <AddNumberModal open={openAdd} onClose={()=>setOpenAdd(false)} onSave={addNumber} />
      {toast && <Toast text={toast} onClose={()=>setToast(undefined)} />}

      <style jsx global>{`
        /* ---- Page-scoped dark-mode cosmetics (matches API Keys look) ---- */
        [data-theme="dark"] .pn-panel{
          --frame-bg: radial-gradient(120% 180% at 50% -40%, rgba(0,255,194,.06) 0%, rgba(12,16,18,1) 42%),
                      linear-gradient(180deg, #0e1213 0%, #0c1012 100%);
          --frame-shadow:
            0 26px 70px rgba(0,0,0,.60),
            0 8px 24px rgba(0,0,0,.45),
            0 0 0 1px rgba(0,255,194,.06);
          --chip-shadow: 0 4px 14px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05);
        }
        [data-theme="dark"] .pn-panel .skeleton{
          background: linear-gradient(90deg, rgba(255,255,255,.04) 25%, rgba(255,255,255,.02) 37%, rgba(255,255,255,.04) 63%);
          border: 1px solid rgba(255,255,255,.06);
          box-shadow: 0 12px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04);
        }
        [data-theme="dark"] .pn-panel .p-4{
          --card-bg: linear-gradient(180deg, rgba(24,32,31,.86) 0%, rgba(16,22,21,.86) 100%);
          --card-shadow:
            0 16px 36px rgba(0,0,0,.55),
            0 2px 8px rgba(0,0,0,.35),
            inset 0 1px 0 rgba(255,255,255,.07),
            0 0 0 1px rgba(0,255,194,.05);
        }
      `}</style>
    </div>
  );
}
