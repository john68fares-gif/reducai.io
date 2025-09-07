// pages/tools/migrate-builds.tsx
'use client';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import { scopedStorage } from '@/utils/scoped-storage';

type Bot = {
  id: string;
  assistantId?: string;
  name: string;
  industry?: string;
  language?: string;
  model?: string;
  description?: string;
  prompt?: string;
  createdAt?: string;
  updatedAt?: string;
  appearance?: any;
};

const nowISO = () => new Date().toISOString();

function normalize(b: any): Bot {
  return {
    id: b?.id ?? b?.assistantId ?? String(Date.now()),
    assistantId: b?.assistantId ?? b?.id,
    name: String(b?.name || 'Untitled Bot'),
    industry: String(b?.industry || ''),
    language: String(b?.language || ''),
    model: String(b?.model || 'gpt-4o-mini'),
    description: String(b?.description || ''),
    prompt: String(b?.prompt || ''),
    createdAt: b?.createdAt || nowISO(),
    updatedAt: b?.updatedAt || b?.createdAt || nowISO(),
    appearance: b?.appearance ?? undefined,
  };
}

export default function MigrateBuilds() {
  const [status, setStatus] = useState<'idle'|'running'|'done'|'error'>('idle');
  const [msg, setMsg] = useState<string>('Ready to migrate…');
  const [moved, setMoved] = useState<number>(0);

  async function run() {
    try {
      setStatus('running');
      setMsg('Reading localStorage…');

      const localRaw = typeof window !== 'undefined' ? localStorage.getItem('chatbots') : null;
      const localArr: any[] = localRaw ? JSON.parse(localRaw) : [];
      const locals: Bot[] = Array.isArray(localArr) ? localArr.map(normalize) : [];

      setMsg(`Found ${locals.length} local builds. Opening scoped storage…`);
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();

      const cloudArr = await ss.getJSON<any[]>('chatbots.v1', []);
      const cloud: Bot[] = Array.isArray(cloudArr) ? cloudArr.map(normalize) : [];

      // merge by assistantId/id, keep newest updatedAt
      const map = new Map<string, Bot>();
      const put = (x: Bot) => {
        const key = x.assistantId || x.id;
        const prev = map.get(key);
        if (!prev) map.set(key, x);
        else {
          const newer =
            Date.parse(x.updatedAt || x.createdAt || '0') >
            Date.parse(prev.updatedAt || prev.createdAt || '0')
              ? x
              : prev;
          map.set(key, newer);
        }
      };
      cloud.forEach(put);
      locals.forEach(put);

      const merged = Array.from(map.values()).sort(
        (a, b) =>
          Date.parse(b.updatedAt || b.createdAt || '0') -
          Date.parse(a.updatedAt || a.createdAt || '0')
      );

      setMsg('Writing to cloud (chatbots.v1)…');
      await ss.setJSON('chatbots.v1', merged);

      // fire the live-refresh event the dashboard listens for
      try { window.dispatchEvent(new Event('builds:updated')); } catch {}

      setMoved(merged.length);
      setMsg(`Migration complete. Cloud now has ${merged.length} builds.`);
      setStatus('done');
    } catch (e: any) {
      setStatus('error');
      setMsg(e?.message || 'Migration failed.');
    }
  }

  // Auto-run once when you open the page; you can refresh to run again safely.
  useEffect(() => { run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Head><title>Migrate Builds • Reduc AI</title></Head>
      <div className="max-w-2xl mx-auto px-6 py-12 font-movatif">
        <h1 className="text-2xl font-semibold mb-2">Migrate Local Builds to Cloud</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Copies builds from this device’s <code>localStorage</code> into your account’s scoped storage
          (<code>chatbots.v1</code>) so they appear on all devices.
        </p>

        <div className="rounded-2xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}>
          <div className="text-sm mb-2">Status:</div>
          <div className="text-sm">{msg}</div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={run}
              disabled={status === 'running'}
              className="px-5 py-2 rounded-[14px] font-semibold"
              style={{
                background: status === 'running' ? 'color-mix(in oklab, var(--text) 14%, transparent)' : 'var(--brand)',
                color: '#fff',
                boxShadow: '0 10px 24px rgba(16,185,129,.25)',
              }}
            >
              {status === 'running' ? 'Migrating…' : 'Run Again'}
            </button>
          </div>

          {status === 'done' && (
            <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Migrated/merged total: {moved}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
