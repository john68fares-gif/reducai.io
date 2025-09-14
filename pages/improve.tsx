// pages/improve.tsx
'use client';

import Link from 'next/link';

export default function ImprovePage() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#0b0c10] text-white">
      <div className="p-6 rounded-2xl border border-[#00ffc220] bg-[#0d0f11]/80 backdrop-blur">
        <h1 className="text-xl font-semibold">Improve is paused.</h1>
        <p className="mt-2 text-sm opacity-80">Head over to the Voice Agent section to continue.</p>
        <Link href="/voice" className="mt-4 inline-block px-4 py-2 rounded-xl border border-[#00ffc2] hover:bg-[#00ffc210]">
          Go to Voice Agent →
        </Link>
      </div>
    </main>
  );
}
