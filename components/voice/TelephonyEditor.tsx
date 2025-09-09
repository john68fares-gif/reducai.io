// components/voice/TelephonyEditor.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { Phone as PhoneIcon, Trash2, UploadCloud } from 'lucide-react';

export type PhoneNum = { id: string; label?: string; e164: string };

export default function TelephonyEditor({
  numbers,
  linkedId,
  onLink,
  onAdd,
  onRemove,
  onImportTwilio, // optional: hook up your Twilio fetch -> onAdd(...)
}: {
  numbers: PhoneNum[];
  linkedId?: string;
  onLink: (id?: string) => void;
  onAdd: (e164: string, label?: string) => void;
  onRemove: (id: string) => void;
  onImportTwilio?: () => Promise<void> | void;
}) {
  const [e164, setE164] = useState('');
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);

  const canAdd = useMemo(() => {
    return validateE164(e164);
  }, [e164]);

  async function handleAdd() {
    const num = e164.trim();
    if (!validateE164(num)) {
      alert('Enter a valid E.164 phone number, e.g. +12025550123');
      return;
    }
    setAdding(true);
    try {
      onAdd(num, label.trim() || undefined);
      setE164('');
      setLabel('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Add / Import */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))' }}>
        <div>
          <div className="mb-1.5 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
            Phone Number (E.164)
          </div>
          <input
            value={e164}
            onChange={(e) => setE164(e.target.value)}
            placeholder="+12025550123"
            inputMode="tel"
            className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
            style={{
              background: 'var(--va-input-bg)',
              border: '1px solid var(--va-input-border)',
              boxShadow: 'var(--va-input-shadow)',
              color: 'var(--text)',
            }}
          />
          {!canAdd && e164 && (
            <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,99,71,.8)' }}>
              Number must be in E.164 format (e.g. +12025550123).
            </div>
          )}
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
            style={{
              background: 'var(--va-input-bg)',
              border: '1px solid var(--va-input-border)',
              boxShadow: 'var(--va-input-shadow)',
              color: 'var(--text)',
            }}
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={handleAdd}
            disabled={!canAdd || adding}
            className="btn btn--green w-full justify-center disabled:opacity-60"
          >
            <PhoneIcon className="w-4 h-4 text-white" />
            <span className="text-white">{adding ? 'Adding…' : 'Add Number'}</span>
          </button>
        </div>
      </div>

      {/* Optional Twilio import */}
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            if (!onImportTwilio) {
              alert('Hook up onImportTwilio to import from Twilio (fetch account numbers → onAdd).');
              return;
            }
            await onImportTwilio();
          }}
          className="btn btn--ghost"
        >
          <UploadCloud className="w-4 h-4 icon" />
          Import from Twilio
        </button>
        <div className="text-xs opacity-70">Bring in purchased numbers automatically.</div>
      </div>

      {/* List */}
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

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="radio"
                  name="linked_number"
                  checked={linkedId === n.id}
                  onChange={() => onLink(n.id)}
                />
                Linked
              </label>
              <button
                onClick={() => {
                  if (confirm('Remove this number? This cannot be undone.')) onRemove(n.id);
                }}
                className="btn btn--danger text-xs"
              >
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            </div>
          </div>
        ))}

        {numbers.length > 0 && (
          <div className="text-xs opacity-70">
            The number marked as <b>Linked</b> will attach to this assistant when you <i>Publish</i>.
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================================================================
   Helpers
============================================================================= */
function validateE164(v: string) {
  const s = v.trim();
  // E.164: max 15 digits, must start with +
  return /^\+[1-9]\d{6,14}$/.test(s);
}
