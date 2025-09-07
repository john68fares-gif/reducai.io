// pages/builder/index.tsx  (or wherever your list renders)
import { useEffect, useState } from 'react';
import type { Build } from '@/utils/builds-store';
import { subscribeBuilds } from '@/utils/builds-store';

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

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-5 w-40 mb-3 rounded" style={{ background: 'color-mix(in oklab, var(--text) 10%, transparent)' }} />
        <div className="h-24 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* your existing table/list UI, just map over 'items' */}
      {items.length === 0 ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No assistants yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((b) => (
            <li key={(b.assistantId || b.id)}>
              <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="font-medium" style={{ color: 'var(--text)' }}>{b.name}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {b.model} · {(b.industry || '—')} · {(b.language || '—')}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
