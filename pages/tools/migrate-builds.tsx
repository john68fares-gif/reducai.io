// pages/tools/migrate-builds.tsx
'use client';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import { scopedStorage } from '@/utils/scoped-storage';

type Bot = {
  id: string;
  assistantId?: string;
  name: string;
  type?: string;
  industry?: string;
  language?: string;
  model?: string;
  prompt?: string;
  createdAt?: string;
  updatedAt?: string;
  appearance?: any;
};

function normalize(b: any): Bot {
  const id = String(b?.id ?? b?.assistantId ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : Date.now().toString()));
  return {
    id,
    assistantId: String(b?.assistantId ?? b?.id ?? id),
    name: String(b?.name || 'Untitled Assistant'),
    type: b?.type || '',
    industry: b?.industry || '',
    language: b?.language || '',
    model: b?.model || 'gpt-4o-mini',
    prompt: b?.prompt || '',
    createdAt: b?.createdAt || new Date().toISOString(),
    updatedAt: b?.updatedAt || b?.createdAt || new Date().toISOString(),
    appearance: b?.appearance ?? undefined,
  };
}

export default function MigrateBuilds() {
  const [status, setStatus] = useState<'idle'|'running'|'done'|'error'>('idle');
  const [moved, setMoved] = useState<number>(0);
  const [skipped, setSkipped] = useState<number>(0);
  const [err, setErr] = useState<string>('');

  async function run() {
    setStatus('running');
    setErr('');
    try {
      // Read local builds from any legacy keys
      const keys = ['chatbots', 'agents', 'builds'];
      let local: Bot[] = [];
      for (const k of keys) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            local = arr.map(normalize);
            if (local.length) break;
          }
        } catch {}
      }

      // If nothing local, try current key
      if (!local.length) {
        try {
          const raw = localStorage.getItem('chatbots');
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) local = arr.map(normalize);
          }
        } catch {}
      }

      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();

      const cloudArr = await ss.getJSON<any[]>('chatbots.v1', []);
      const cloud = Array.isArray(cloudArr) ? cloudArr.map(normalize) : [];
      const cloudIndex = new Map(cloud.map((b) => [(b.assistantId || b.id), b]));

      let added = 0;
      let skip = 0;

      for (const b of local) {
        const key = b.assistantId || b.id;
        const exist = cloudIndex.get(key);
        if (!exist) {
          cloud.unshift(b);
          cloudIndex.set(key, b);
          added++;
        } else {
          // keep newer
          const newer =
            Date.parse(b.updatedAt || b.createdAt || '0') >
            Date.parse(exist.updatedAt || exist.createdAt || '0');
          if (newer) {
            const idx = cloud.findIndex((x) => (x.assistantId || x.id) === key);
            if (idx >= 0) cloud[idx] = b;
          } else {
            skip++;
          }
        }
      }

      await ss.setJSON('chatbots.v1', cloud);

      // re-seed local with merged cloud so we’re in sync
      try { localStorage.setItem('chatbots', JSON.stringify(cloud)); } catch {}
      try { window.dispatchEvent(new Event('builds:updated')); } catch {}

      setMoved(added);
      setSkipped(skip);
      setStatus('done');
    } catch (e: any) {
      setErr(e?.message || 'Migration failed');
      setStatus('error');
    }
  }

  useEffect(() => {
    // auto-run once when you open this page
    run();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Head><title>Migrate Builds</title></Head>
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">Migrate Builds</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Moves local builds into your cloud storage so they appear on all devices.
        </p>
        <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div>Status: <b>{status}</b></div>
          {status === 'done' && (
            <div className="mt-2">
              <div>Moved: {moved}</div>
              <div>Skipped (already in cloud): {skipped}</div>
            </div>
          )}
          {status === 'error' && <div className="mt-2" style={{ color: 'salmon' }}>{err}</div>}
        </div>
      </div>
    </div>
  );
}
