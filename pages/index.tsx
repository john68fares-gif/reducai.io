// pages/index.tsx
import Head from 'next/head';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wand2, Mic, Shield, Cpu, MessageSquare, Phone, ArrowRight, CheckCircle2,
  CreditCard, Sparkles, Globe, BarChart3, Timer, Lock, Headphones, Rocket, Star
} from 'lucide-react';

/* ───────────────────────────────
   Overlay tokens (same vibe as AssistantRail)
   ─────────────────────────────── */
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const EASE = 'cubic-bezier(.22,.61,.36,1)';

// IMPORTANT: replace these with your actual Price IDs from Stripe (test OR live to match STRIPE_SECRET_KEY)
const PRICE_IDS = {
  starter: { monthly: 'price_xxx_starter_m', annual: 'price_xxx_starter_y' },
  pro: { monthly: 'price_xxx_pro_m', annual: 'price_xxx_pro_y' },
};

type Billing = 'monthly' | 'annual';

export default function Home() {
  const [billing, setBilling] = useState<Billing>('monthly');
  const [loadingId, setLoadingId] = useState<string>('');

  async function startCheckout(priceId: string, opts?: { trialDays?: number }) {
    try {
      setLoadingId(priceId);
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          mode: 'subscription',
          successPath: '/builder',
          cancelPath: '/#pricing',
          trialDays: opts?.trialDays ?? undefined,
        }),
      });
      const json = await safeJSON(r);
      if (!r.ok || !json?.url) {
        console.error('Checkout error', json);
        alert('Could not start checkout. Check Stripe keys + Price IDs (open console).');
        return;
      }
      window.location.href = json.url as string;
    } catch (e) {
      console.error(e);
      alert('Could not start checkout. Please try again.');
    } finally {
      setLoadingId('');
    }
  }

  const isMonthly = billing === 'monthly';
  const pStarter = PRICE_IDS.starter[billing];
  const pPro = PRICE_IDS.pro[billing];

  return (
    <>
      <Head>
        <title>ReduxAI — Build AI voice agents in minutes</title>
        <meta name="description" content="Overlay-quality UI. Natural voice. Smart routing. Ship voice agents fast." />
      </Head>

      {/* Global overlay tokens */}
      <style jsx global>{`
        .va-scope{
          --bg:#0b0c10; --panel:#0d0f11; --card:#0f1214; --text:#e6f1ef; --text-muted:#9fb4ad;
          --brand:${CTA}; --brand-weak:rgba(89,217,179,.22);
          --border:rgba(255,255,255,.10); --border-weak:rgba(255,255,255,.10);
          --shadow-card:0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset;
          --radius:12px; --ease:${EASE};
        }
        :root:not([data-theme="dark"]) .va-scope{
          --bg:#f7faf9; --panel:#ffffff; --card:#f4f7f6; --text:#0f172a; --text-muted:#64748b;
          --brand:${CTA}; --brand-weak:rgba(89,217,179,.18);
          --border:rgba(15,23,42,.12); --border-weak:rgba(15,23,42,.12);
          --shadow-card:0 10px 24px rgba(2,6,12,.06), 0 0 0 1px rgba(15,23,42,.06) inset;
        }
        .va-card{ border:1px solid var(--border-weak); background:var(--panel); border-radius:var(--radius); box-shadow:var(--shadow-card); overflow:hidden; isolation:isolate; }
        .pill{ display:inline-flex; align-items:center; gap:8px; padding:6px 12px; border-radius:999px;
               background: color-mix(in oklab, var(--brand) 10%, var(--panel)); border:1px solid ${GREEN_LINE}; color: var(--text); font-size:12px; }
        .btn{ height:44px; padding:0 18px; border-radius:999px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; gap:8px;
              transition: transform .15s var(--ease); border:1px solid transparent; }
        .btn:hover{ transform: translateY(-1px); }
        .btn-primary{ background:var(--brand); color:#fff; }
        .btn-secondary{ background:var(--panel); color:var(--text); border:1px solid var(--border); }
        .section{ padding:80px 0; }
        .lift:hover{ transform: translateY(-2px); transition: transform .18s var(--ease); }
      `}</style>

      {/* Page */}
      <div className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>

        {/* NAV */}
        <header style={{ borderBottom:`1px solid ${GREEN_LINE}` }}>
          <nav className="mx-auto max-w-[1160px] px-5 lg:px-6 h-[66px] flex items-center justify-between">
            <div className="flex items-center gap-10">
              <div className="text-base font-semibold">ReduxAI<span style={{ color:CTA }}>.</span>com</div>
              <NavLink href="#features">Features</NavLink>
              <NavLink href="#pricing">Pricing</NavLink>
              <NavLink href="#faq">FAQ</NavLink>
            </div>
            <div className="flex items-center gap-8">
              <a className="btn btn-secondary" href="/login">Sign in</a>
              <button className="btn btn-primary" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior:'smooth' })}>
                Start free <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </nav>
        </header>

        {/* HERO */}
        <section className="section">
          <div className="mx-auto max-w-[1160px] px-5 lg:px-6 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="pill mb-3"><Sparkles className="w-4 h-4" /> Overlay-clean UI</div>
              <h1 className="text-[36px] md:text-[44px] leading-[1.05] font-semibold">Build & launch <span style={{ color:CTA }}>AI voice agents</span> in minutes.</h1>
              <p className="mt-3 text-[15px]" style={{ color:'var(--text-muted)' }}>
                Natural speech. Smart routing. Clean controls. The same visual language as your in-app overlays.
              </p>
              <div className="mt-6 flex flex-wrap gap-10 items-center">
                <button className="btn btn-primary" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior:'smooth' })}>Get started free</button>
                <div className="flex items-center gap-2 text-sm" style={{ color:'var(--text-muted)' }}>
                  <Shield className="w-4 h-4" /> Card verification required
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-6 text-sm">
                <Tag icon={<Mic className="w-4 h-4" />} label="Real-time voice" />
                <Tag icon={<Cpu className="w-4 h-4" />} label="LLM orchestrations" />
                <Tag icon={<Lock className="w-4 h-4" />} label="Auth-gated & private" />
              </div>
            </div>

            {/* Right: overlay preview */}
            <div className="va-card p-6 lift">
              <div className="text-sm mb-2" style={{ color:'var(--text-muted)' }}>Overlay preview</div>
              <div className="rounded-[12px] p-5"
                   style={{ border:`1px solid ${GREEN_LINE}`,
                            background:`linear-gradient(180deg, color-mix(in oklab, var(--brand) 14%, transparent), transparent 60%)` }}>
                <div className="text-[15px] font-medium">“Hi! I’m your AI receptionist. How can I help?”</div>
                <div className="mt-2 text-sm" style={{ color:'var(--text-muted)' }}>Warm, natural prosody. Pause-aware. Interrupt-friendly.</div>
              </div>
              <div className="mt-4 text-xs" style={{ color:'var(--text-muted)' }}>Configured after checkout. Import your prompts and routes.</div>
            </div>
          </div>
        </section>

        {/* TRUST / METRICS */}
        <section className="section" style={{ paddingTop:0 }}>
          <div className="mx-auto max-w-[1160px] px-5 lg:px-6">
            <div className="va-card grid grid-cols-2 md:grid-cols-4 gap-6 p-6">
              <Metric k="120ms" v="Avg. latency" icon={<Timer className="w-4 h-4" />} />
              <Metric k="99.9%" v="Uptime" icon={<Globe className="w-4 h-4" />} />
              <Metric k="A+" v="Call quality" icon={<Phone className="w-4 h-4" />} />
              <Metric k="4.9★" v="User rating" icon={<Star className="w-4 h-4" />} />
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="section" style={{ borderTop:`1px solid ${GREEN_LINE}` }}>
          <div className="mx-auto max-w-[1160px] px-5 lg:px-6">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon:<Wand2 className="w-5 h-5" />, title:'No fiddly setup', desc:'Connect your data & pick a voice. We handle infra.' },
                { icon:<MessageSquare className="w-5 h-5" />, title:'Natural speech', desc:'Low-latency prosody, smart pauses, barging.' },
                { icon:<Shield className="w-5 h-5" />, title:'Secure by design', desc:'Auth-gated app. Stable storage. Privacy-first.' },
                { icon:<BarChart3 className="w-5 h-5" />, title:'Analytics', desc:'Turns, intents, handoffs, outcomes.' },
                { icon:<Headphones className="w-5 h-5" />, title:'Live handoff', desc:'Route to human agents or numbers when needed.' },
                { icon:<Rocket className="w-5 h-5" />, title:'Launch fast', desc:'Opinionated defaults. Overlay-clean controls.' },
              ].map((f,i)=>(
                <div key={i} className="va-card p-5 lift">
                  <div className="w-10 h-10 rounded-[10px] grid place-items-center mb-3"
                       style={{ background:'var(--brand-weak)', border:`1px solid ${GREEN_LINE}` }}>
                    {f.icon}
                  </div>
                  <div className="text-[16px] font-semibold">{f.title}</div>
                  <div className="mt-1 text-[14px]" style={{ color:'var(--text-muted)' }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* STEPS */}
        <section className="section" style={{ borderTop:`1px solid ${GREEN_LINE}` }}>
          <div className="mx-auto max-w-[1160px] px-5 lg:px-6 grid md:grid-cols-3 gap-6">
            {[
              { n:'01', t:'Connect', d:'Hook up data sources and phone endpoints.' },
              { n:'02', t:'Configure', d:'Pick a voice, compose call logic and handoffs.' },
              { n:'03', t:'Go live', d:'Ship your first assistant in minutes.' },
            ].map((s, i)=>(
              <div key={i} className="va-card p-5">
                <div className="text-xs mb-1" style={{ color:'var(--text-muted)' }}>Step {s.n}</div>
                <div className="text-[18px] font-semibold">{s.t}</div>
                <div className="text-sm mt-1" style={{ color:'var(--text-muted)' }}>{s.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* SHOWCASE / SCREENSHOT STUB */}
        <section className="section" style={{ borderTop:`1px solid ${GREEN_LINE}` }}>
          <div className="mx-auto max-w-[1160px] px-5 lg:px-6 grid md:grid-cols-[1.2fr,.8fr] gap-12 items-center">
            <div className="va-card p-6 lift">
              <div className="text-sm mb-2" style={{ color:'var(--text-muted)' }}>Dashboard preview</div>
              <div className="rounded-[12px] h-[260px] grid place-items-center"
                   style={{ border:`1px solid ${GREEN_LINE}`, background:'linear-gradient(180deg, color-mix(in oklab, var(--brand) 8%, transparent), transparent 70%)' }}>
                <div className="text-sm" style={{ color:'var(--text-muted)' }}>Drop your real screenshot here later.</div>
              </div>
            </div>
            <div>
              <div className="pill"><Shield className="w-4 h-4" /> Secure & private</div>
              <h3 className="text-[28px] font-semibold mt-2">A calm, overlay-clean surface for serious work.</h3>
              <p className="mt-2 text-[15px]" style={{ color:'var(--text-muted)' }}>
                Same gradients, same rounded corners, same glow lines as your AssistantRail. No mess. Everything feels cohesive.
              </p>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="section" style={{ borderTop:`1px solid ${GREEN_LINE}` }}>
          <div className="mx-auto max-w-[1160px] px-5 lg:px-6">
            <div className="flex items-center justify-between mb-8 gap-6 flex-wrap">
              <div>
                <div className="pill"><CreditCard className="w-4 h-4" /> Pricing</div>
                <h2 className="text-[28px] md:text-[32px] font-semibold mt-2">Simple plans, free trial included</h2>
                <div className="text-sm mt-1" style={{ color:'var(--text-muted)' }}>
                  We verify your card with a €0 authorization. First charge after the trial unless you cancel.
                </div>
              </div>
              <BillingToggle billing={billing} setBilling={setBilling} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <PlanCard
                title="Starter"
                price={isMonthly ? '€19/mo' : '€11/mo (billed yearly)'}
                note="Everything you need to launch a single voice agent."
                features={['1 assistant', 'Real-time voice', 'Basic analytics', 'Email support']}
                cta="Start free trial"
                loading={loadingId === pStarter}
                onClick={() => startCheckout(pStarter, { trialDays: 7 })}
              />
              <PlanCard
                highlight
                title="Pro"
                price={isMonthly ? '€39/mo' : '€23/mo (billed yearly)'}
                note="Scale to multiple assistants and teams."
                features={['Up to 5 assistants', 'Advanced analytics', 'Priority routing', 'Priority support']}
                cta="Start free trial"
                loading={loadingId === pPro}
                onClick={() => startCheckout(pPro, { trialDays: 14 })}
              />
            </div>

            <div className="mt-5 text-xs" style={{ color:'var(--text-muted)' }}>
              UI labels are indicative; actual amount/interval come from your Stripe <i>Price</i>.
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="section" style={{ borderTop:`1px solid ${GREEN_LINE}` }}>
          <div className="mx-auto max-w-[900px] px-5 lg:px-6">
            <h3 className="text-[26px] font-semibold mb-6">Frequently asked</h3>
            <div className="grid gap-3">
              {FAQS.map((f,i)=>(
                <details key={i} className="va-card p-5">
                  <summary className="font-medium cursor-pointer">{f.q}</summary>
                  <p className="mt-2 text-[14px]" style={{ color:'var(--text-muted)' }}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="section" style={{ borderTop:`1px solid ${GREEN_LINE}`, paddingTop:40 }}>
          <div className="mx-auto max-w-[1160px] px-5 lg:px-6 text-sm" style={{ color:'var(--text-muted)' }}>
            © {new Date().getFullYear()} ReduxAI — All rights reserved.
          </div>
        </footer>
      </div>
    </>
  );
}

/* ───────────────── helpers & atoms ───────────────── */

function NavLink({ href, children }:{ href:string; children:React.ReactNode }) {
  return <a href={href} className="text-sm hover:opacity-90" style={{ color:'var(--text-muted)' }}>{children}</a>;
}

function Tag({ icon, label }:{ icon:React.ReactNode; label:string }) {
  return <div className="flex items-center gap-2 text-sm"><span style={{ color:CTA }}>{icon}</span>{label}</div>;
}

function Metric({ k, v, icon }:{ k:string; v:string; icon:React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-[10px] grid place-items-center" style={{ background:'var(--brand-weak)', border:`1px solid ${GREEN_LINE}` }}>
        {icon}
      </div>
      <div>
        <div className="text-[18px] font-semibold leading-none">{k}</div>
        <div className="text-xs mt-[2px]" style={{ color:'var(--text-muted)' }}>{v}</div>
      </div>
    </div>
  );
}

function BillingToggle({ billing, setBilling }:{ billing:'monthly'|'annual'; setBilling:(b:'monthly'|'annual')=>void }) {
  const monthlyActive = billing === 'monthly';
  return (
    <div className="va-card p-1 flex items-center gap-1">
      <button className="btn" style={{ height:36, padding:'0 14px', background: monthlyActive ? 'var(--brand)' : 'var(--panel)', color: monthlyActive ? '#fff' : 'var(--text)', borderRadius:999, border:`1px solid ${monthlyActive ? 'transparent' : 'var(--border)'}` }} onClick={()=>setBilling('monthly')}>Monthly</button>
      <button className="btn" style={{ height:36, padding:'0 14px', background: !monthlyActive ? 'var(--brand)' : 'var(--panel)', color: !monthlyActive ? '#fff' : 'var(--text)', borderRadius:999, border:`1px solid ${!monthlyActive ? 'transparent' : 'var(--border)'}` }} onClick={()=>setBilling('annual')}>
        Annual <span className="ml-1 text-xs" style={{ opacity:.9 }}>(save ~40%)</span>
      </button>
    </div>
  );
}

function PlanCard({
  title, price, note, features, cta, onClick, highlight, loading
}:{
  title:string; price:string; note:string; features:string[]; cta:string; onClick:()=>void; highlight?:boolean; loading?:boolean;
}) {
  return (
    <motion.div
      className="va-card p-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        outline: highlight ? `2px solid ${CTA}` : 'none',
        boxShadow: highlight ? '0 0 0 1px rgba(89,217,179,.18), var(--shadow-card)' : 'var(--shadow-card)',
      }}
    >
      <div className="text-sm mb-1" style={{ color:'var(--text-muted)' }}>{title}</div>
      <div className="text-[24px] font-semibold">{price}</div>
      <div className="text-sm mt-1 mb-3" style={{ color:'var(--text-muted)' }}>{note}</div>
      <ul className="text-sm space-y-2 mb-5">
        {features.map((f,i)=>(
          <li key={i} className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" style={{ color: CTA }} /> {f}
          </li>
        ))}
      </ul>
      <button className="btn btn-primary w-full" onClick={onClick} disabled={!!loading}>
        {loading ? 'Starting checkout…' : cta}
      </button>
    </motion.div>
  );
}

const FAQS = [
  { q: 'Do you offer a free trial?', a: 'Yes. We verify your card for €0 and start the trial. Cancel any time before it ends to avoid a charge.' },
  { q: 'Can I bring my own LLM & voice provider?', a: 'Yes. You can plug in your providers and switch per-assistant.' },
  { q: 'How do handoffs work?', a: 'Define routes and conditions. The assistant escalates to a real number or agent when needed.' },
  { q: 'Is my data safe?', a: 'Yes. The app is auth-gated and designed to minimize data exposure. You own your data.' },
];

async function safeJSON(r:Response){ try{ return await r.json(); } catch { return {}; } }
