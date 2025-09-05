// pages/account/pricing.tsx
'use client';

import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Zap, Check, ArrowLeft, Percent } from 'lucide-react';

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const monthlyPrice = 19.99;
  const yearlyDiscount = 0.4;
  const yearlyPrice = useMemo(
    () => Math.round(monthlyPrice * 12 * (1 - yearlyDiscount)),
    [monthlyPrice]
  );

  return (
    <>
      <Head>
        <title>Pricing • Reduc AI</title>
      </Head>
      <div className="min-h-screen bg-white text-black dark:bg-[#0b0c10] dark:text-white">
        <main className="w-full max-w-[980px] mx-auto px-6 pt-10 pb-24">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 text-[17px] font-semibold">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-[#0d0f11]">
                  <Percent className="w-5 h-5" />
                </span>
                <span>Pricing</span>
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-sm ml-10 -mt-1">
                Choose a plan that fits your launch
              </div>
            </div>
            <Link
              href="/account"
              className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" /> Back to settings
            </Link>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center gap-2 mb-8">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                billing === 'monthly'
                  ? 'font-semibold bg-green-100 dark:bg-emerald-900/30 border-green-300 dark:border-emerald-600'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                billing === 'yearly'
                  ? 'font-semibold bg-green-100 dark:bg-emerald-900/30 border-green-300 dark:border-emerald-600'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              Yearly • {Math.round(yearlyDiscount * 100)}% off
            </button>
          </div>

          {/* Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              badge="Current plan"
              badgeMuted
              cta={
                <button
                  disabled
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-[#0d0f11] opacity-70 cursor-not-allowed"
                >
                  Demo only
                </button>
              }
            />

            <PlanCard
              title="Pro"
              subtitle="Everything you need to launch"
              price={
                billing === 'monthly'
                  ? `€${monthlyPrice.toFixed(2)}`
                  : `€${yearlyPrice}`
              }
              period={billing === 'monthly' ? '/ month' : '/ year'}
              icon={<Zap className="w-5 h-5" />}
              features={[
                'Full builder features unlocked',
                'Higher request limits',
                'Priority worker queue',
                'Email support',
              ]}
              badge={
                billing === 'yearly'
                  ? `Save ${Math.round(yearlyDiscount * 100)}%`
                  : undefined
              }
              cta={
                <a
                  href="https://buy.stripe.com/3cI7sLgWz0zb0uT5hrgUM00"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border font-semibold border-green-300 dark:border-emerald-600 bg-green-100 dark:bg-emerald-900/30 hover:bg-green-200 dark:hover:bg-emerald-800/50 transition"
                >
                  <Zap className="w-4 h-4" />{' '}
                  {billing === 'monthly'
                    ? 'Subscribe to Pro'
                    : 'Go annual & save'}
                </a>
              }
            />
          </div>

          {/* Savings banner */}
          {billing === 'yearly' && (
            <div className="mt-8 text-center text-sm rounded-lg px-4 py-3 border border-green-300 dark:border-emerald-600 bg-green-100 dark:bg-emerald-900/30">
              Switch to annual billing and save{' '}
              {Math.round(yearlyDiscount * 100)}%!
            </div>
          )}

          {/* Billing & Subscription panel */}
          <section className="mt-10">
            <div className="mb-3">
              <div className="flex items-center gap-2 text-[17px] font-semibold">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-[#0d0f11]">
                  <Crown className="w-5 h-5" />
                </span>
                <span>Billing & Subscription</span>
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-sm ml-10 -mt-1">
                Manage your subscription and invoices
              </div>
            </div>

            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              className="rounded-xl p-6 bg-white dark:bg-[#0d0f11] border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg p-4 bg-gray-50 dark:bg-[#14171b] border border-gray-200 dark:border-gray-700">
                  <div className="text-gray-600 dark:text-gray-400 mb-1">
                    Manage Billing
                  </div>
                  <a
                    href="YOUR_STRIPE_PORTAL_LINK"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border font-semibold border-green-300 dark:border-emerald-600 bg-green-100 dark:bg-emerald-900/30 hover:bg-green-200 dark:hover:bg-emerald-800/50 transition"
                  >
                    Open Customer Portal
                  </a>
                </div>
                <div className="rounded-lg p-4 bg-gray-50 dark:bg-[#14171b] border border-gray-200 dark:border-gray-700">
                  <div className="text-gray-600 dark:text-gray-400 mb-1">
                    Need to cancel?
                  </div>
                  <a
                    href="YOUR_UNSUBSCRIBE_LINK"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-[#0d0f11] hover:bg-gray-200 dark:hover:bg-[#1a1d21] transition"
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
  title,
  subtitle,
  price,
  period,
  icon,
  features,
  cta,
  badge,
  badgeMuted,
}: {
  title: string;
  subtitle: string;
  price: string;
  period: string;
  icon: React.ReactNode;
  features: string[];
  cta: React.ReactNode;
  badge?: string;
  badgeMuted?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="rounded-xl p-6 bg-white dark:bg-[#0d0f11] border border-gray-200 dark:border-gray-700 shadow-sm relative"
      whileHover={{ y: -2 }}
    >
      {badge && (
        <span
          className={`absolute -top-3 left-4 px-2 py-1 rounded-full text-[11px] border ${
            badgeMuted ? 'opacity-70' : ''
          } border-green-300 dark:border-emerald-600 bg-green-100 dark:bg-emerald-900/30`}
        >
          {badge}
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-[#14171b] border border-gray-300 dark:border-gray-600">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col">
            <div className="text-base font-semibold">{title}</div>
            <div className="text-gray-600 dark:text-gray-400 text-sm">
              {subtitle}
            </div>
          </div>
          <div className="mt-1 text-lg font-semibold">
            {price}{' '}
            <span className="text-gray-600 dark:text-gray-400 text-sm font-normal">
              {period}
            </span>
          </div>
          <ul className="mt-3 text-sm space-y-1.5 text-gray-700 dark:text-gray-300">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 text-green-500" /> {f}
              </li>
            ))}
          </ul>
          <div className="mt-4">{cta}</div>
        </div>
      </div>
    </motion.section>
  );
}
