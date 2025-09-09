'use client';

import React, { useState } from 'react';
import { Phone as PhoneIcon, Trash2 } from 'lucide-react';

export type PhoneNum = { id: string; label?: string; e164: string };

type Props = {
  numbers: PhoneNum[];
  linkedId?: string;
  onLink: (id?: string) => void;
  onAdd: (e164: string, label?: string) => void;
  onRemove: (id: string) => void;
};

export default function TelephonyEditor({ numbers, linkedId, onLink, onAdd, onRemove }: Props) {
  const [e164, setE164] = useState('');
  const [label, setLabel] = useState('');

  const handleAdd = () => {
    if (!e164.trim()) return;
    onAdd(e164.trim(), label.trim() || undefined);
    setE164('');
    setLabel('');
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))' }}>
        <div>
          <div className="mb-1.5 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
            Phone Number (E.164)
          </div>
          <input
            value={e164}
            onChange={(e) => setE164(e.target.value)}
            placeholder="+12025550123"
            className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
            style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)', boxShadow: 'var(--va-input-shadow)', color: 'var(--text)' }}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
            Label
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Support line"
            className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
            style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)', boxShadow: 'var(--va-input-shadow)', color: 'var(--text)' }}
          />
        </div>
        <div className="flex items-end">
          <button onClick={handleAdd} className="btn btn--green w-full justify-center">
            <PhoneIcon className="w-4 h-4 text-white" />
            <span className="text-white">Add Number</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {numbers.length === 0 && <div className="text-sm opacity-70">No phone numbers added yet.</div>}
        {numbers.map((n) => (
          <div
            key={n.id}
            className="flex items-center justify-between rounded-xl px-3 py-2"
            style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)' }}
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{n.label || 'Untitled'}</div>
              <div className="text-xs opacity-70">{n.e164}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs">
                <input type="radio" name="linked_number" checked={linkedId === n.id} onChange={() => onLink(n.id)} />
                Linked
              </label>
              <button onClick={() => onRemove(n.id)} className="btn btn--danger text-xs">
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            </div>
          </div>
        ))}
        {numbers.length > 0 && (
          <div className="text-xs opacity-70">
            The number marked as <b>Linked</b> will be attached to this assistant on <i>Publish</i>.
          </div>
        )}
      </div>
    </div>
  );
}
