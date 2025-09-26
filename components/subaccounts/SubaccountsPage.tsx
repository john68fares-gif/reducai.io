// components/subaccounts/SubaccountsPage.tsx
'use client';

import { useState } from 'react';
import { Plus, Bot } from 'lucide-react';

type Subaccount = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  agents: number;
};

export default function SubaccountsPage() {
  const [subaccounts, setSubaccounts] = useState<Subaccount[]>([
    { id: '68b7f14b2c8bbab698dd0a1', name: 'Dental Chatbot', status: 'active', agents: 0 }
  ]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');

  function createSubaccount() {
    if (!newName.trim()) return;
    const newAcc: Subaccount = {
      id: Math.random().toString(36).slice(2, 10),
      name: newName.trim(),
      status: 'active',
      agents: 0,
    };
    setSubaccounts([...subaccounts, newAcc]);
    setNewName('');
    setShowModal(false);
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-6">Launch & Deploy</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {/* Create Subaccount Card */}
        <div
          onClick={() => setShowModal(true)}
          className="cursor-pointer rounded-lg border border-[var(--border-weak)] bg-[var(--panel-bg)] shadow hover:shadow-lg transition p-6 flex flex-col items-center justify-center text-center"
        >
          <Plus className="w-10 h-10 mb-2 text-[var(--text-muted)]" />
          <div className="font-medium">Create Subaccount</div>
          <div className="text-xs opacity-70">Click to create</div>
        </div>

        {/* Subaccount Cards */}
        {subaccounts.map((sa) => (
          <div
            key={sa.id}
            className="rounded-lg border border-[var(--border-weak)] bg-[var(--panel-bg)] shadow p-6 flex flex-col"
          >
            <Bot className="w-10 h-10 mb-3 text-[var(--text-muted)]" />
            <div className="font-medium text-lg mb-1">{sa.name}</div>
            <div className="text-xs opacity-70">ID: {sa.id}</div>
            <div className="text-xs mt-2">{sa.agents} AI Agents</div>
            <div className="text-xs mt-1">
              Status:{' '}
              <span className={sa.status === 'active' ? 'text-green-400' : 'text-red-400'}>
                {sa.status.charAt(0).toUpperCase() + sa.status.slice(1)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-[var(--panel-bg)] rounded-lg p-6 w-full max-w-sm shadow-lg border border-[var(--border-weak)]">
            <h2 className="text-lg font-semibold mb-4">Create New Subaccount</h2>
            <input
              type="text"
              placeholder="Enter subaccount name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full mb-4 px-3 py-2 rounded-md bg-[var(--input-bg)] border border-[var(--input-border)] text-sm outline-none"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-md border border-[var(--border-weak)]"
              >
                Cancel
              </button>
              <button
                onClick={createSubaccount}
                className="px-4 py-2 rounded-md bg-emerald-500 text-white font-semibold"
              >
                Create Subaccount
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
