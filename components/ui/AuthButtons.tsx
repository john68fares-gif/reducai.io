// components/ui/AuthButtons.tsx
'use client';

import { useRouter } from 'next/router';

export default function AuthButtons() {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <button
        className="px-3 py-2 rounded-[10px] bg-transparent border border-white/20 hover:bg-white/10"
        onClick={() => router.push('/auth?mode=signin&from=/builder')}
      >
        Sign in
      </button>
      <button
        className="px-3 py-2 rounded-[10px] bg-[#00ffc2] text-black font-semibold shadow-[0_0_10px_rgba(106,247,209,0.28)] hover:brightness-110"
        onClick={() => router.push('/auth?mode=signup&from=/builder')}
      >
        Sign up
      </button>
    </div>
  );
}
