// FILE: components/subaccounts/CreateSubaccountModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';

const CTA      = '#59d9b3';
const CTA_LINE = 'rgba(89,217,179,.20)';

export default function CreateSubaccountModal({
  open, onClose, onCreate
}:{
  open: boolean;
  onClose: ()=>void;
  onCreate: (name:string)=>void;
}) {
  const [name, setName] = useState('');
  const can = name.trim().length > 1;

  useEffect(() => { if (open) setName(''); }, [open]);

  if (!open) return null;

  function submit() {
    if (!can) return;
    onCreate(name.trim());
  }

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-[1000]" style={{ background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }} onClick={onClose} />
      {/* modal */}
      <div className="fixed inset-0 z-[1001] grid place-items-center px-4">
        <div className="w-full max-w-[520px] rounded-[10px] overflow-hidden"
             style={{ background:'var(--panel, #0d0f11)', color:'var(--text, #e6f1ef)', border:`1px solid ${CTA_LINE}`, boxShadow:'0 18px 36px rgba(0,0,0,.28)'}}>
          {/* header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:`1px solid ${CTA_LINE}`}}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-[10px] grid place-items-center shrink-0"
                   style={{ background:CTA, boxShadow:'0 10px 22px rgba(89,217,179,.28)'}}>
                <Plus className="w-5 h-5" style={{ color:'#05221c' }}/>
              </div>
              <div className="truncate">
                <div className="text-[16px] font-semibold">Create New Subaccount</div>
                <div className="text-[12px]" style={{ color:'var(--text-muted,#9fb4ad)' }}>Organize your AI agents</div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-[8px]" style={{ border:`1px solid ${CTA_LINE}`, background:'transparent' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* body */}
          <div className="p-5">
            <label className="block text-xs mb-1" style={{ color:'var(--text-muted,#9fb4ad)' }}>Subaccount Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e)=>setName(e.target.value)}
              onKeyDown={(e)=> e.key==='Enter' && submit()}
              className="w-full h-[44px] px-3 rounded-[10px] outline-none"
              style={{ background:'var(--panel,#0d0f11)', border:`1px solid ${CTA_LINE}`, color:'var(--text,#e6f1ef)' }}
              placeholder="Enter subaccount name..."
            />
          </div>

          {/* footer */}
          <div className="px-5 pb-5 flex gap-3">
            <button onClick={onClose}
                    className="h-[44px] px-4 rounded-[10px] font-semibold flex-1"
                    style={{ background:'var(--panel)', border:`1px solid rgba(255,255,255,.9)`, color:'var(--text)'}}>
              Cancel
            </button>
            <button onClick={submit} disabled={!can}
                    className="h-[44px] px-4 rounded-[10px] font-semibold flex-1 disabled:opacity-60"
                    style={{ background:CTA, color:'#031613', border:`1px solid ${CTA_LINE}`, boxShadow:'0 10px 22px rgba(89,217,179,.28)'}}>
              Create Subaccount
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
