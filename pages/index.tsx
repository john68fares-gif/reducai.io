// pages/index.tsx
import Link from 'next/link';

export default function Landing() {
  return (
    <main style={STYLES.page}>
      <div style={STYLES.grid} />
      <div style={{ ...STYLES.glow, top: -220, left: -180 }} />
      <div style={{ ...STYLES.glow, bottom: -260, right: -180 }} />

      <header style={STYLES.nav}>
        <div style={STYLES.brand}>
          <span style={STYLES.logoDot} />
          <span>reduc.ai</span>
        </div>
        <nav style={STYLES.navLinks}>
          {/* remove direct /builder link to avoid accidental redirect */}
          <Link href="/auth?mode=signin&from=/builder" style={{ ...STYLES.link, ...STYLES.ghost }}>
            Sign in
          </Link>
          <Link href="/auth?mode=signup&from=/builder" style={{ ...STYLES.link, ...STYLES.primary }}>
            Sign up
          </Link>
        </nav>
      </header>

      <section style={STYLES.heroWrap}>
        <div style={STYLES.heroCard}>
          <div style={STYLES.badge}>NEW</div>
          <h1 style={STYLES.h1}>
            Build sales & support AI <span style={{ color: '#6af7d1' }}>in minutes</span>
          </h1>
          <p style={STYLES.sub}>Pixel-perfect, fast, and deadly simple.</p>

          <div style={STYLES.ctaRow}>
            {/* Always go via auth first */}
            <Link href="/auth?mode=signup&from=/builder" style={STYLES.ctaPrimary}>
              Create a Build
            </Link>
          </div>
        </div>
      </section>

      <footer style={STYLES.footer}>
        <span>© {new Date().getFullYear()} reduc.ai</span>
      </footer>
    </main>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  page: { position: 'relative', minHeight: '100vh', background: '#0b0c10', color: '#fff', overflow: 'hidden',
    fontFamily: 'Manrope, Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' },
  grid: { position: 'absolute', inset: 0, backgroundImage:
    'repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 40px)',
    maskImage: 'radial-gradient(ellipse at 50% 0%, rgba(0,0,0,.9), transparent 65%)' } as React.CSSProperties,
  glow: { position: 'absolute', width: 560, height: 560, borderRadius: '50%', background:
    'radial-gradient(circle, rgba(106,247,209,0.25), rgba(0,0,0,0))', filter: 'blur(60px)', pointerEvents: 'none' },
  nav: { maxWidth: 1120, margin: '0 auto', padding: '22px 20px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 12 },
  brand: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, letterSpacing: .3 },
  logoDot: { width: 10, height: 10, borderRadius: 999, background: '#6af7d1', boxShadow: '0 0 16px rgba(106,247,209,.8)' },
  navLinks: { display: 'flex', gap: 12, alignItems: 'center', fontWeight: 600, opacity: .95, flexWrap: 'wrap' },
  link: { textDecoration: 'none', color: 'white' },
  ghost: { border: '2px solid rgba(255,255,255,.15)', padding: '8px 12px', borderRadius: 10 },
  primary: { padding: '10px 14px', borderRadius: 12, fontWeight: 800, background: '#00ffc2', color: '#001018',
    boxShadow: '0 0 18px rgba(106,247,209,.35)' },
  heroWrap: { maxWidth: 1120, margin: '28px auto 0', padding: '0 20px' },
  heroCard: { position: 'relative', padding: 28, borderRadius: 20, background: 'rgba(13,15,17,.92)',
    border: '1px solid rgba(106,247,209,.25)', boxShadow: 'inset 0 0 22px rgba(0,0,0,.28), 0 0 28px rgba(106,247,209,.08)' },
  badge: { display: 'inline-block', padding: '6px 9px', borderRadius: 999, background: 'rgba(106,247,209,.15)',
    border: '1px solid rgba(106,247,209,.35)', fontSize: 12, marginBottom: 12 },
  h1: { fontSize: 44, lineHeight: '52px', margin: '4px 0 10px', fontWeight: 900 },
  sub: { opacity: .85, lineHeight: '26px', marginBottom: 16, maxWidth: 720 },
  ctaRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  ctaPrimary: { display: 'inline-block', padding: '12px 16px', borderRadius: 12, textDecoration: 'none', fontWeight: 800,
    background: '#00ffc2', color: '#001018', boxShadow: '0 0 18px rgba(106,247,209,.35)' },
  footer: { maxWidth: 1120, margin: '40px auto 30px', padding: '0 20px', display: 'flex', justifyContent: 'space-between',
    opacity: .7, fontSize: 13 },
};
