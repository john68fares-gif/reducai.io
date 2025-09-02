import Link from "next/link";
import SignInButton from "../components/ui/SignInButton";   // <-- add
import SignUpButton from "../components/ui/SignUpButton";   // <-- add

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
          {/* Only auth entry on landing */}
          <SignInButton label="Sign in" />
        </nav>
      </header>

      {/* HERO */}
      <section style={STYLES.heroWrap}>
        <div style={STYLES.heroCard}>
          <div style={STYLES.badge}>NEW</div>
          <h1 style={STYLES.h1}>
            Build sales & support AI <span style={{ color: "#6af7d1" }}>in minutes</span>
          </h1>
          <p style={STYLES.sub}>
            Pixel-perfect, fast, and deadly simple. Create an agent, refine the prompt,
            test replies, then deploy.
          </p>

          <div style={STYLES.ctaRow}>
            {/* Goes straight to Google; after success shows overlay on Builder */}
            <SignUpButton label="Sign up with Google" />
            {/* Optional: keep these if you still want to show product links to logged-out users */}
            {/* <Link href="/improve" style={STYLES.ctaGhost}>Open Improve</Link> */}
            {/* <Link href="/voice-agent" style={STYLES.ctaGhost}>Voice Agent</Link> */}
          </div>

          {/* trust row (unchanged) */}
          <div style={STYLES.trustRow}>
            <div style={STYLES.dot} /><span>Fast setup</span>
            <div style={STYLES.sep} /><div style={STYLES.dot} /><span>Glowing UI</span>
            <div style={STYLES.sep} /><div style={STYLES.dot} /><span>No backend needed</span>
          </div>
        </div>

        {/* side cards (unchanged) */}
        <div style={STYLES.cards}>
          <FeatureCard title="Sales AI" body="Qualify, handle objections, book calls." accent="#6af7d1" />
          <FeatureCard title="Support AI" body="Answer FAQs, deflect tickets, keep tone on-brand." accent="#7cc3ff" />
          <FeatureCard title="Start Blank" body="Bring your own prompt; total control." accent="#b28bff" />
        </div>
      </section>

      <footer style={STYLES.footer}>
        <span>© {new Date().getFullYear()} reduc.ai</span>
        <span style={{ opacity: .7 }}>Webhook: <code>/api/voice/twilio/incoming</code></span>
      </footer>
    </main>
  );
}
