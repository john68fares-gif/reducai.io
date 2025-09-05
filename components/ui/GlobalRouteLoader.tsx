'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function GlobalRouteLoader() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const start = () => setLoading(true);
    const end = () => setLoading(false);
    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', end);
    router.events.on('routeChangeError', end);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', end);
      router.events.off('routeChangeError', end);
    };
  }, [router.events]);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center"
         style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}>
      <div className="w-9 h-9 rounded-full border-2 border-[color:var(--text-muted)] border-t-[var(--brand)] animate-spin" />
    </div>
  );
}
