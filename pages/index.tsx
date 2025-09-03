// /pages/index.tsx
import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";

export default function Landing() {
  const router = useRouter();

  function goSignup() {
    router.push("/auth?mode=signup&from=/builder");
  }
  function goSignin() {
    router.push("/auth?mode=signin&from=/builder");
  }

  return (
    <>
      <Head>
        <title>Reduc AI — Build sales & support AI in minutes</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

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

          {/* Only show auth entry points from landing */}
          <nav style={STYLES.navLinks}>
            <button onClick={goSignin} style={STYLES.linkBtn}>
              Sign in
            </button>
            <button onClick={goSignup} style={{ ...STYLES.linkBtn, ...STYLES.primaryMini }}>
              Create account
            </button>
          </nav>
        </header>

        {/* HERO */}
        <section style={STYLES.heroWrap}>
          <div style={STYLES.heroCard}>
            <div style={STYLES.badge}>NEW</div>
            <h1 style={STYLES.h1}>
              Build sales & support AI{" "}
              <span style={{ color: "#6af7d1" }}>in minutes</span>
            </h1>
            <p style={STYLES.sub}>
              Pixel-perfect, fast, and simple. Create an agent, refine the prompt,
              test replies, then deploy — all in one flow.
            </p>

            <div style={STYLES.ctaRow}>
              <button onClick={goSignup} style={STYLES.ctaPrimary}>
                Get started — it’s free
              </button>
              <button onClick={goSignin} style={STYLES.ctaGhost}>
                I already have an account
              </button>
            </div>

            {/* trust row */}
            <div style={STYLES.trustRow}>
              <div style={STYLES.dot} />
              <span>Fast setup</span>
              <div style={STYLES.sep} />
              <div style={STYLES.dot} />
              <span>No credit card required</span>
              <div style={STYLES.sep} />
              <div style={STYLES.dot} />
              <span>Google or email sign in</span>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section style={STYLES.cardsWrap}>
          {FEATURES.map((f) => (
            <div key={f.title} style={STYLES.card}>
              <div style={STYLES.cardIcon}>{f.icon}</div>
              <div style={STYLES.cardTitle}>{f.title}</div>
              <div style={STYLES.cardText}>{f.text}</div>
            </div>
          ))}
        </section>

        {/* Footer note */}
        <footer style={STYLES.footer}>
          <div style={{ opacity: 0.7 }}>
            You’ll be asked to sign in to continue.
          </div>
          <div style={{ fontSize: 12, opacity: 0.5 }}>
            © {new Date().getFullYear()} reduc.ai — All rights reserved.
          </div>
        </footer>
      </main>
    </>
  );
}

const ACCENT = "#6af7d1";

const STYLES: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0b0c10",
    color: "#fff",
    position: "relative",
    overflow: "hidden",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
    backgroundSize: "32px 32px",
    maskImage: "radial-gradient(ellipse at center, rgba(0,0,0,0.9) 30%, rgba(0,0,0,1) 70%)",
    pointerEvents: "none",
  },
  glow: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(106,247,209,0.22) 0%, rgba(0,0,0,0) 70%)",
    filter: "blur(20px)",
    pointerEvents: "none",
  },
  nav: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "18px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    fontSize: 18,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: ACCENT,
    boxShadow: "0 0 14px rgba(106,247,209,0.8)",
  },
  navLinks: {
    display: "inline-flex",
    gap: 10,
    alignItems: "center",
  },
  linkBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.25)",
    color: "rgba(255,255,255,0.9)",
    fontWeight: 600,
    cursor: "pointer",
  } as React.CSSProperties,
  primaryMini: {
    border: "1px solid rgba(106,247,209,0.5)",
    background: ACCENT,
    color: "#0b0c10",
  },
  heroWrap: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "32px 20px 0",
  },
  heroCard: {
    position: "relative",
    borderRadius: 24,
    border: "1px solid rgba(106,247,209,0.25)",
    background: "rgba(13,15,17,0.92)",
    boxShadow: "0 0 30px rgba(0,0,0,0.45), inset 0 0 22px rgba(0,0,0,0.28)",
    padding: "28px 24px",
  },
  badge: {
    position: "absolute",
    top: 14,
    right: 14,
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(106,247,209,0.15)",
    color: ACCENT,
    border: "1px solid rgba(106,247,209,0.35)",
    fontWeight: 700,
  },
  h1: {
    fontSize: 44,
    lineHeight: 1.08,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    marginBottom: 10,
  },
  sub: {
    opacity: 0.75,
    fontSize: 18,
    maxWidth: 720,
  },
  ctaRow: {
    display: "flex",
    gap: 12,
    marginTop: 20,
    flexWrap: "wrap",
  },
  ctaPrimary: {
    padding: "14px 18px",
    borderRadius: 14,
    border: "1px solid rgba(106,247,209,0.45)",
    background: ACCENT,
    color: "#0b0c10",
    fontWeight: 800,
    boxShadow: "0 0 22px rgba(106,247,209,0.18)",
    cursor: "pointer",
  },
  ctaGhost: {
    padding: "14px 18px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.20)",
    background: "rgba(0,0,0,0.25)",
    color: "rgba(255,255,255,0.95)",
    fontWeight: 700,
    cursor: "pointer",
  },
  trustRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    flexWrap: "wrap",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: "rgba(255,255,255,0.5)",
  },
  sep: {
    width: 10,
    height: 1,
    background: "rgba(255,255,255,0.15)",
    margin: "0 4px",
  },
  cardsWrap: {
    maxWidth: 1120,
    margin: "26px auto 0",
    padding: "0 20px 40px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  },
  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    padding: 16,
    minHeight: 140,
  },
  cardIcon: {
    fontSize: 22,
    opacity: 0.9,
    marginBottom: 6,
  },
  cardTitle: {
    fontWeight: 700,
    marginBottom: 6,
  },
  cardText: {
    fontSize: 14,
    opacity: 0.7,
  },
  footer: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "14px 20px 36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    marginTop: 10,
  },
};

const FEATURES = [
  { icon: "⚡", title: "Instant drafts", text: "Generate a working agent scaffold with one click." },
  { icon: "🎯", title: "Precise rules", text: "Edit prompt & guardrails without touching code." },
  { icon: "🧠", title: "Knowledge", text: "Feed docs/FAQ and test answers live." },
  { icon: "🚀", title: "Deploy anywhere", text: "Embed on your site or connect to chat." },
];
