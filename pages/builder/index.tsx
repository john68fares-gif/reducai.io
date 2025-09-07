// pages/builder/index.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Wand2 } from 'lucide-react';
import type { Build } from '@/utils/builds-store';
import { subscribeBuilds } from '@/utils/builds-store';

const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
  borderRadius: 20,
};

const PANEL: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: 28,
};

const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

export default function BuilderDashboardPage() {
  const [items, setItems] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeBuilds((rows) => {
      setItems(rows);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const hasBuilds = useMemo(() => items && items.length > 0, [items]);

  return (
    <div className="w-full max-w-7xl mx-auto px-6 lg:px-10 py-8">
      {/* ====== HERO / CREATE A BUILD (restored) ====== */}
      <section className="relative overflow-hidden p-6 md:p-7 mb-8" style={PANEL}>
        {/* subtle ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
          style={{
            background:
              'radial-gradient(circle, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)',
            filter: 'blur(38px)',
          }}
        />
        {/* grid background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[.07]"
          style={{
            background:
              'linear-gradient(transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px), linear-gradient(90deg, transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px)',
            backgroundSize: '32px 32px',
            maskImage: 'radial-gradient(circle at 30% 20%, black, transparent 70%)',
          }}
        />

        <div className="relative flex items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-xs tracking-wide px-3 py-1.5 rounded-[20px] border"
                 style={{ borderColor: 'var(--border)', background: 'color-mix(in oklab, var(--brand) 10%, var(--card))' }}>
              <Wand2 className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} />
              New
            </div>
            <h1 className="mt-3 text-2xl md:text-3xl font-semibold" style={{ color: 'var(--text)' }}>
              Create a Build
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Start building your AI assistant.
            </p>
          </div>

          <Link
            href="/builder/create"
            className="shrink-0 inline-flex items-center gap-2 px-5 h-[44px] rounded-[16px] font-semibold"
            style={{ background: BTN_GREEN, color: '#fff' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = BTN_GREEN_HOVER)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = BTN_GREEN)}
          >
            <Plus className="w-4 h-4" /> Continue
          </Link>
        </div>
      </section>

      {/* ====== BUILDS LIST ====== */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 rounded-2xl" style={CARD} />
          ))}
        </div>
      ) : !hasBuilds ? (
        <div className="rounded-2xl p-8 text-center" style={CARD}>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No assistants yet. Click “Continue” above to create your first build.
          </div>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((b) => (
            <li key={(b.assistantId || b.id)}>
              <Link
                href={`/builder/${encodeURIComponent(b.assistantId || b.id)}`}
                className="block rounded-2xl p-4 transition"
                style={CARD}
              >
                <div className="font-medium" style={{ color: 'var(--text)' }}>
                  {b.name}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {b.model || '—'} · {b.type || 'Ai automation'} · {b.language || '—'}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
