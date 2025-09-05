// pages/account/pricing.tsx
'use client';

import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Zap, Check, ArrowLeft } from 'lucide-react';

const UI = {
  cardBg: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.22)',
  cardShadow: '0 10px 30px rgba(0,0,0,0.45), inset 0 0 22px rgba(0,0,0,0.35), 0 0 18px rgba(0,255,194,0.06)',
};

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly'|'yearly'>('monthly');

  // numbers (edit as needed)
  const monthlyPrice = 19.99;
  const yearlyDiscount = 0.40;
  const yearlyPrice = useMemo(() => Math.round((monthlyPrice*12)*(1-yearlyDiscount)), [monthlyPrice]);

  return (
    <>
      <Head><title>Pricing • Reduc AI</title></Head>
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <main className="w-full max-w-[980px] mx-auto px-6 pt-10 pb-24">

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl md:text-3xl font-semibold">Pricing</h1>
            <Link href="/account" className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
              <ArrowLeft className="w-4 h-4" /> Back to settings
            </Link>
          </div>

          {/* Toggle */}
          <div className="flex items-center gap-2 mb-6">
            <button onClick={() => setBilling('monthly')}
              className={`px-3 py-1.5 rounded-full text-sm border ${billing==='monthly'?'font-semibold':''}`}
              style={{ borderColor: 'rgba(106,247,209,0.28)', background: billing==='monthly' ? 'rgba(0,255,194,0.10)' : 'transparent' }}>
              Monthly
            </button>
            <button onClick={() => setBilling('yearly')}
              className={`px-3 py-1.5 rounded-full text-sm border ${billing==='yearly'?'font-semibold':''}`}
              style={{ borderColor: 'rgba(106,247,209,0.28)', background: billing==='yearly' ? 'rgba(0,255,194,0.10)' : 'transparent' }}>
              Yearly • {Math.round(yearlyDiscount*100)}% off
            </button>
          </div>

          {/* Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PlanCard
              title="Free"
              subtitle="Demo only — create and test demos with restricted features"
              price={billing==='monthly' ? '€0' : '€0'}
              period={billing==='monthly' ? '/ forever' : '/ forever'}
              icon={<Crown className="w-5 h-5" />}
              features={[
                'Build & preview demo chatbots',
                'Limited request quota',
                'Basic templates',
              ]}
              badge="Current plan"
              badgeMuted
              cta={<button disabled className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border opacity-70 cursor-not-allowed"
                           style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}>
                      Demo only
                    </button>}
            />

            <PlanCard
              title="Pro"
              subtitle="Everything you need to launch"
              price={billing==='monthly' ? `€${monthlyPrice.toFixed(2)}` : `€${yearlyPrice}`}
              period={billing==='monthly' ? '/ month' : '/ year'}
              icon={<Zap className="w-5 h-5" />}
              features={[
                'Full builder features unlocked',
                'Higher request limits',
                'Priority worker queue',
                'Email support',
              ]}
              badge={billing==='yearly' ? `Save ${Math.round(yearlyDiscount*100)}%` : undefined}
              cta={
                <a href="https://buy.stripe.com/3cI7sLgWz0zb0uT5hrgUM00" target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border font-semibold"
                   style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(0,255,194,0.06)' }}>
                  <Zap className="w-4 h-4" /> {billing==='monthly' ? 'Subscribe to Pro' : 'Go annual & save'}
                </a>
              }
            />
          </div>

          {/* Savings banner */}
          {billing==='yearly' && (
            <div className="mt-6 text-center text-sm rounded-[12px] px-4 py-3"
                 style={{ border:'1px solid rgba(106,247,209,0.28)', background:'rgba(0,255,194,0.06)' }}>
              Switch to annual billing and save {Math.round(yearlyDiscount*100)}%!
            </div>
          )}

          {/* Billing & Subscription (customer portal) */}
          <section className="mt-10">
            <h2 className="text-lg font-semibold mb-3">Billing & Subscription</h2>
            <motion.section
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}
              className="rounded-[16px] p-6"
              style={{ background: UI.cardBg, border: UI.border, boxShadow: UI.cardShadow }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-[12px] p-4" style={{ background:'rgba(15,18,20,0.55)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-white/70 mb-1">Manage Billing</div>
                  <a
                    href="YOUR_STRIPE_PORTAL_LINK"  // TODO: replace with your generated customer portal URL
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border font-semibold"
                    style={{ borderColor:'rgba(106,247,209,0.28)', background:'rgba(0,255,194,0.06)' }}
                  >
                    Open Stripe Customer Portal
                  </a>
                </div>
                <div className="rounded-[12px] p-4" style={{ background:'rgba(15,18,20,0.55)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-white/70 mb-1">Need to cancel?</div>
                  <a
                    href="YOUR_UNSUBSCRIBE_LINK" // optional: or route to contact
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border"
                    style={{ borderColor:'rgba(255,255,255,0.12)', background:'rgba(16,19,20,0.90)' }}
                  >
                    Unsubscribe
                  </a>
                </div>
              </div>
            </motion.section>
          </section>

        </main>
      </div>
    </>
  );
}

function PlanCard({
  title, subtitle, price, period, icon, features, cta, badge, badgeMuted,
}: {
  title: string; subtitle: string; price: string; period: string;
  icon: React.ReactNode; features: string[]; cta: React.ReactNode;
  badge?: string; badgeMuted?: boolean;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}
      className="rounded-[16px] p-6 relative"
      style={{ background: UI.cardBg, border: UI.border, boxShadow: UI.cardShadow }}>
      {badge && (
        <span className={`absolute -top-3 left-4 px-2 py-1 rounded-full text-[11px] border ${badgeMuted?'opacity-70':''}`}
              style={{ borderColor:'rgba(106,247,209,0.28)', background:'rgba(0,255,194,0.10)' }}>
          {badge}
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-black/20 border border-white/10">{icon}</div>
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
