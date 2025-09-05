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
      <Head><title>Pricing • Reduc AI</title></Head>
      <div
        className="min-h-screen"
        style={{ background: 'var(--bg)', color: 'var(--text)' }}
      >
        <main className="w-full max-w-[980px] mx-auto px-6 pt-10 pb-24">
          {/* header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 text-[17px] font-semibold">
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
                  style={{
                    border: '1px solid var(--brand-weak)',
                    background: 'var(--card)',
                  }}
                >
                  <Percent className="w-5 h-5" style={{ color: 'var(--brand)' }} />
                </span>
                <span>Pricing</span>
              </div>
              <div
                className="text-sm ml-10 -mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Choose a plan that fits your launch
              </div>
            </div>

            <Link
              href="/account"
              className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100"
              style={{ color: 'var(--text-muted)' }}
            >
              <ArrowLeft className="w-4 h-4" /> Back to settings
            </Link>
          </div>

          {/* billing toggle */}
          <div className="flex items-center gap-2 mb-8">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                billing === 'monthly' ? 'font-semibold' : ''
              }`}
              style={{
                borderColor: 'var(--brand-weak)',
                background: billing === 'monthly' ? 'var(--card)' : 'transparent',
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                billing === 'yearly' ? 'font-semibold' : ''
              }`}
              style={{
                borderColor: 'var(--brand-weak)',
                background: billing === 'yearly' ? 'var(--card)' : 'transparent',
              }}
            >
              Yearly • {Math.round(yearlyDiscount * 100)}% off
            </button>
          </div>

          {/* plans */}
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border opacity-70 cursor-not-allowed"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--card)',
                    color: 'var(--text-muted)',
                  }}
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border font-semibold"
                  style={{
                    borderColor: 'var(--brand-weak)',
                    background: 'var(--card)',
                    color: 'var(--text)',
                  }}
                >
                  <Zap className="w-4 h-4" style={{ color: 'var(--brand)' }} />{' '}
                  {billing === 'monthly'
                    ? 'Subscribe to Pro'
                    : 'Go annual & save'}
                </a>
              }
            />
          </div>

          {/* savings banner */}
          {billing === 'yearly' && (
            <div
              className="mt-8 text-center text-sm rounded-md px-4 py-3"
              style={{
                border: '1px solid var(--brand-weak)',
                background: 'var(--card)',
                color: 'var(--text)',
              }}
            >
              Switch to annual billing and save {Math.round(yearlyDiscount * 100)}%!
            </div>
          )}

          {/* billing panel */}
          <section className="mt-10">
            <div className="mb-3">
              <div className="flex items-center gap-2 text-[17px] font-semibold">
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
                  style={{
                    border: '1px solid var(--brand-weak)',
                    background: 'var(--card)',
                  }}
                >
                  <Crown className="w-5 h-5" style={{ color: 'var(--brand)' }} />
                </span>
                <span>Billing & Subscription</span>
              </div>
              <div
                className="text-sm ml-10 -mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Manage your subscription and invoices
              </div>
            </div>

            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              className="rounded-lg p-6"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div
                  className="rounded-md p-4"
                  style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }} className="mb-1">
                    Manage Billing
                  </div>
                  <a
                    href="YOUR_STRIPE_PORTAL_LINK"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border font-semibold"
                    style={{
                      borderColor: 'var(--brand-weak)',
                      background: 'var(--card)',
                      color: 'var(--text)',
                    }}
                  >
                    Open Customer Portal
                  </a>
                </div>
                <div
                  className="rounded-md p-4"
                  style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }} className="mb-1">
                    Need to cancel?
                  </div>
                  <a
                    href="YOUR_UNSUBSCRIBE_LINK"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--card)',
                      color: 'var(--text-muted)',
                    }}
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
      className="rounded-lg p-6 relative"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {badge && (
        <span
          className={`absolute -top-3 left-4 px-2 py-1 rounded-full text-[11px] border ${
            badgeMuted ? 'opacity-70' : ''
          }`}
          style={{
            borderColor: 'var(--brand-weak)',
            background: 'var(--card)',
            color: 'var(--text)',
          }}
        >
          {badge}
        </span>
      )}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
          }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <div className="text-base font-semibold">{title}</div>
            <div style={{ color: 'var(--text-muted)' }} className="text-sm">
              {subtitle}
            </div>
          </div>
          <div className="mt-1 text-lg font-semibold">
            {price}{' '}
            <span
              className="text-sm font-normal"
              style={{ color: 'var(--text-muted)' }}
            >
              {period}
            </span>
          </div>
          <ul
            className="mt-3 text-sm space-y-1.5"
            style={{ color: 'var(--text)' }}
          >
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check
                  className="w-4 h-4 mt-0.5"
                  style={{ color: 'var(--brand)' }}
                />{' '}
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-4">{cta}</div>
        </div>
      </div>
    </motion.section>
  );
}
