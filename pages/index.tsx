// pages/index.tsx
import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import SignInButton from '../components/ui/SignInButton'
import SignUpButton from '../components/ui/SignUpButton'

export default function Landing() {
  return (
    <main style={STYLES.page}>
      {/* subtle animated grid */}
      <div style={STYLES.grid} />
      {/* soft radial glows */}
      <div style={{ ...STYLES.glow, top: -220, left: -180 }} />
      <div style={{ ...STYLES.glow, bottom: -260, right: -180 }} />

      {/* NAV */}
      <header style={STYLES.nav}>
        <div style={STYLES.brand}>
          <span style={STYLES.logoDot} />
          <span>reduc.ai</span>
        </div>

        <nav style={STYLES.navLinks}>
          {/* Landing should only funnel to auth */}
          <SignInButton label="Sign in" />
        </nav>
      </header>

      {/* HERO */}
      <section style={STYLES.heroWrap}>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .35 }}
          style={STYLES.heroCard}
        >
          <div style={STYLES.badge}>NEW</div>
          <h1 style={STYLES.h1}>
            Build sales & support AI <span style={{ color: "#6af7d1" }}>in minutes</span>
          </h1>
          <p style={STYLES.sub}>
            Pixel-perfect, fast, and deadly simple. Create an agent, refine the prompt,
            test replies, then deploy.
          </p>

          <div style={STYLES.ctaRow}>
            {/* goes straight to Google; after success shows overlay on /builder */}
            <SignUpButton label="Sign up with Google" />
          </div>

          {/* trust row */}
          <div style={STYLES.trustRow}>
            <div style={STYLES.dot} />
            <span>Fast setup</span>
            <div style={STYLES.sep} />
            <div style={STYLES.dot} />
            <span>Glowing UI</span>
            <div style={STYLES.sep} />
            <div style={STYLES.dot} />
            <span>No backend needed to start</span>
          </div>
        </motion.div>

        {/* side “feature” cards */}
        <div style={STYLES.cards}>
          <FeatureCard
            title="Sales AI"
            body="Qualify, handle objections, book calls."
            accent="#6af7d1"
          />
          <FeatureCard
            title="Support AI"
            body="Answer FAQs, deflect tickets, keep tone on-brand."
            accent="#7cc3ff"
          />
          <FeatureCard
            title="Start Blank"
            body="Bring your own prompt; total control."
            accent="#b28bff"
          />
        </div>
      </section>

      {/* FOOTER */}
      <footer style={STYLES.footer}>
        <span>© {new Date().getFullYear()} reduc.ai</span>
        <span style={{ opacity: .7 }}>Webhook: <code>/api/voice/twilio/incoming</code></span>
      </footer>
    </main>
  )
}

/* --------------------------- tiny components --------------------------- */

function FeatureCard({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      style={{ ...STYLES.card, borderColor: hexWithAlpha(accent, .35) }}
    >
      <div style={{ ...STYLES.cardIcon, borderColor: hexWithAlpha(accent, .45) }}>
        <div style={{ ...STYLES.cardDot, background: accent }} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
      <div style={{ opacity: .75, fontSize: 13, lineHeight: "20px" }}>{body}</div>
    </motion.div>
  );
}

/* ------------------------------- styles -------------------------------- */

const STYLES: Record<string, CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    background: "#0b0c10",
    color: "#fff",
    overflow: "hidden",
    fontFamily:
      "Manrope, Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 40px)",
    maskImage: "radial-gradient(ellipse at 50% 0%, rgba(0,0,0,.9), transparent 65%)",
    animation: "gridShift 20s linear infinite",
  } as CSSProperties,
  glow: {
    position: "absolute",
    width: 560,
    height: 560,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(106,247,209,0.25), rgba(0,0,0,0))",
    filter: "blur(60px)",
    pointerEvents: "none",
  },
  nav: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 800,
    letterSpacing: .3,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "#6af7d1",
    boxShadow: "0 0 16px rgba(106,247,209,.8)",
  },
  navLinks: { display: "flex", gap: 12, fontWeight: 700, opacity: .9, alignItems: 'center' },
  heroWrap: {
    maxWidth: 1120,
    margin: "28px auto 0",
    padding: "0 20px",
    display: "grid",
    gridTemplateColumns: "1.2fr .8fr",
    gap: 24,
  },
  heroCard: {
    position: "relative",
    padding: 28,
    borderRadius: 20,
    background: "rgba(13,15,17,.92)",
    border: "1px solid rgba(106,247,209,.25)",
    boxShadow:
      "inset 0 0 22px rgba(0,0,0,.28), 0 0 28px rgba(106,247,209,.08)",
  },
  badge: {
    display: "inline-block",
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(106,247,209,.15)",
    border: "1px solid rgba(106,247,209,.35)",
    fontSize: 12,
    marginBottom: 12,
  },
  h1: { fontSize: 44, lineHeight: "52px", margin: "4px 0 10px", fontWeight: 900 },
  sub: { opacity: .85, lineHeight: "26px", marginBottom: 16, maxWidth: 720 },
  ctaRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  ctaPrimary: {
    display: "inline-block",
    padding: "12px 16px",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 900,
    background: "#00ffc2",
    color: "#001018",
    boxShadow: "0 0 26px rgba(106,247,209,.45)",
  },
  ctaGhost: {
    display: "inline-block",
    padding: "12px 16px",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 700,
    border: "2px solid rgba(255,255,255,.15)",
    background: "rgba(0,0,0,.2)",
    color: "#fff",
  },
  trustRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    color: "rgba(255,255,255,.8)",
    fontSize: 13,
  },
  dot: {
    width: 7, height: 7, borderRadius: 999, background: "#6af7d1",
    boxShadow: "0 0 10px rgba(106,247,209,.7)",
  },
  sep: { width: 14, height: 1, background: "rgba(255,255,255,.2)" },
  cards: {
    display: "grid",
    gap: 16,
    alignContent: "start",
  },
  card: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(16,19,20,.88)",
    border: "1px solid rgba(255,255,255,.18)",
    boxShadow: "0 0 18px rgba(0,0,0,.25)",
    display: "grid",
    gap: 10,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 12,
    border: "2px solid rgba(106,247,209,.4)",
    display: "grid", placeItems: "center",
    background: "rgba(0,0,0,.25)",
  },
  cardDot: { width: 10, height: 10, borderRadius: 999 },
  footer: {
    maxWidth: 1120,
    margin: "40px auto 30px",
    padding: "0 20px",
    display: "flex",
    justifyContent: "space-between",
    opacity: .7,
    fontSize: 13,
  },
}

// helper: add alpha to hex like #6af7d1
function hexWithAlpha(hex: string, alpha = 0.3) {
  const n = hex.replace("#", "");
  const r = parseInt(n.substring(0, 2), 16);
  const g = parseInt(n.substring(2, 4), 16);
  const b = parseInt(n.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
