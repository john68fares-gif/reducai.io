// pages/account/pricing.tsx
'use client';

import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Crown, Zap, Check, ArrowLeft } from 'lucide-react';

const UI = {
  cardBg: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.22)',
  cardShadow:
    '0 10px 30px rgba(0,0,0,0.45), inset 0 0 22px rgba(0,0,0,0.35), 0 0 18px rgba(0,255,194,0.06)',
};

export default function PricingPage() {
  return (
    <>
      <Head><title>Pricing • Reduc AI</title></Head>
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <main className="w-full max-w-[820px] mx-auto px-6 pt-10 pb-24">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl md:text-3xl font-semibold">Pricing</h1>
            <Link href="/account" className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
              <ArrowLeft className="w-4 h-4" /> Back to settings
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5">
            <PlanCard
              title="Free"
              subtitle="Demo only — create and test demos with restricted features"
              price="€0"
              period="/ forever"
              icon={<Crown className="w-5 h-5" />}
              features={[
                'Build & preview demo chatbots',
                'Limited request quota',
                'Basic templates',
              ]}
              cta={<button disabled className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border opacity-70 cursor-not-allowed"
                           style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}>
                      Demo only
                    </button>}
            />

            <PlanCard
              title="Pro"
              subtitle="Everything you need to launch"
              price="€19.99"
              period="/ month"
              icon={<Zap className="w-5 h-5" />}
              features={[
                'Full builder features unlocked',
                'Higher request limits',
                'Priority worker queue',
                'Email support',
              ]}
              cta={
                <a href="https://buy.stripe.com/3cI7sLgWz0zb0uT5hrgUM00" target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border font-semibold"
                   style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(0,255,194,0.06)' }}>
                  <Zap className="w-4 h-4" /> Subscribe to Pro
                </a>
              }
            />
          </div>
        </main>
      </div>
    </>
  );
}

function PlanCard({
  title, subtitle, price, period, icon, features, cta,
}: {
  title: string; subtitle: string; price: string; period: string;
  icon: React.ReactNode; features: string[]; cta: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="rounded-[16px] p-6"
      style={{ background: UI.cardBg, border: UI.border, boxShadow: UI.cardShadow }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-black/20 border border-white/10">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <div className="text-base font-semibold">{title}</div>
            <div className="text-white/60 text-sm">{subtitle}</div>
          </div>
          <div className="mt-1 text-lg font-semibold">
            {price} <span className="text-white/60 text-sm font-normal">{period}</span>
          </div>

          <ul className="mt-3 text-white/85 text-sm space-y-1.5">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 text-[#57f0c6]" /> {f}
              </li>
            ))}
          </ul>

          <div className="mt-4">{cta}</div>
        </div>
      </div>
    </motion.section>
  );
}
