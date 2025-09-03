// pages/index.tsx
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase-client';

export default function Home() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  // Detect session on the client (no SSR redirects)
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthed(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setAuthed(Boolean(s));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const goCreate = () => {
    if (authed) router.push('/builder');
    else router.push('/auth?mode=signup&from=/builder');
  };

  return (
    <div className="min-h-screen w-full bg-[#0b0c10] text-white">
      <main className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-3xl md:text-4xl font-semibold mb-8">Welcome to Reduc.ai</h1>

        <p className="text-white/70 max-w-2xl mb-10">
          Build your AI agent in minutes. Your data stays secure and you’re always in control.
        </p>

        <button
          onClick={goCreate}
          className="px-5 py-3 rounded-[10px] bg-[#00ffc2] text-black font-semibold
                     shadow-[0_0_10px_rgba(106,247,209,0.28)] hover:brightness-110 transition"
        >
          Create a Build
        </button>
      </main>
    </div>
  );
}
