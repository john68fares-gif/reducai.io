// pages/index.tsx (only showing the header section)
import AuthButtons from '../components/auth/AuthButtons';
// ...

<header style={STYLES.nav}>
  <div style={STYLES.brand}>
    <span style={STYLES.logoDot} />
    <span>reduc.ai</span>
  </div>

  <nav style={STYLES.navLinks}>
    <a href="/builder" style={STYLES.link}>Builder</a>
    <a href="/improve" style={STYLES.link}>Improve</a>
    <a href="/voice-agent" style={STYLES.link}>Voice Agent</a>

    {/* <- swap out any old buttons/handlers for this */}
    <AuthButtons compact />
  </nav>
</header>
