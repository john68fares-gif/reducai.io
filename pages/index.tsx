// /pages/index.tsx
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';

const ACCENT = '#6af7d1';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace('/builder');
    })();
  }, [router]);

  function goSignIn() {
    router.push('/auth?mode=signin&from=%2Fbuilder');
  }

  // ...rest of your component unchanged
}
