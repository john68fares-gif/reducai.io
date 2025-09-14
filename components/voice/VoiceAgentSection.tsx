function StyleBlock() {
  return (
    <style jsx global>{`
.${SCOPE}{
  /* ===== Core theme tokens (dark) – from your screenshots ===== */
  --background: oklch(0.1743 0.0227 283.0);
  --foreground: oklch(0.9185 0.0257 285.0);

  --card:       oklch(0.2284 0.0384 282.0);
  --card-fg:    var(--foreground);

  --popover:    oklch(0.2284 0.0384 282.0);
  --popover-fg: var(--foreground);

  --primary:    oklch(0.7162 0.1597 290.3962);
  --primary-fg: oklch(0.1743 0.0227 283.0);

  --secondary:    oklch(0.3139 0.0736 283.0);
  --secondary-fg: oklch(0.8367 0.0849 285.0);

  --accent:       oklch(0.3354 0.0828 280.0);
  --accent-fg:    var(--foreground);

  --muted:        oklch(0.2710 0.0621 281.4);
  --muted-fg:     oklch(0.7166 0.0462 285.0);

  --destructive:    oklch(0.6861 0.2061 14.99);
  --destructive-fg: oklch(1 0 0);

  --border: oklch(0.3261 0.0597 282.5832);
  --input:  oklch(0.3261 0.0597 282.5832);
  --ring:   var(--primary);

  /* Sidebar (from screenshots) */
  --sidebar:                 oklch(0.2284 0.0384 282.0);
  --sidebar-foreground:      var(--foreground);
  --sidebar-primary:         var(--primary);
  --sidebar-primary-foreground: var(--primary-fg);
  --sidebar-accent:          var(--accent);
  --sidebar-accent-foreground: var(--foreground);
  --sidebar-border:          var(--border);
  --sidebar-ring:            var(--primary);

  /* ===== Map into this page’s existing custom vars ===== */
  --bg: var(--background);
  --text: var(--foreground);
  --text-muted: color-mix(in oklab, var(--foreground) 65%, transparent);

  --va-card:    var(--card);
  --va-topbar:  var(--card);
  --va-sidebar: var(--sidebar);
  --va-chip:    color-mix(in oklab, var(--card) 92%, transparent);
  --va-border:  var(--border);

  --va-input-bg:    var(--card);
  --va-input-border: var(--input);
  --va-input-shadow: inset 0 1px 0 color-mix(in oklab, white 6%, transparent);

  --va-menu-bg:     var(--card);
  --va-menu-border: var(--border);

  --va-shadow:      0 24px 70px rgba(0,0,0,.55), 0 10px 28px rgba(0,0,0,.40);
  --va-shadow-lg:   0 42px 110px rgba(0,0,0,.66), 0 20px 48px rgba(0,0,0,.5);
  --va-shadow-sm:   0 12px 26px rgba(0,0,0,.35);
  --va-shadow-side: 8px 0 28px rgba(0,0,0,.42);

  --va-rail-w:320px;
  --app-sidebar-w:248px;
  --va-edge-gutter:${EDGE_GUTTER}px;

  overflow-x:hidden;
}

/* Light mode mapping (kept minimal so nothing breaks if user switches) */
:root:not([data-theme="dark"]) .${SCOPE}{
  --background: oklch(0.973 0.0133 286.0);
  --foreground: oklch(0.3015 0.0572 282.0);

  --card:       oklch(1 0 0);
  --card-fg:    var(--foreground);

  --popover:    oklch(1 0 0);
  --popover-fg: var(--foreground);

  --primary:    oklch(0.5417 0.179 288.03);
  --primary-fg: oklch(1 0 0);

  --secondary:    oklch(0.9174 0.0435 292.0);
  --secondary-fg: oklch(0.4143 0.1039 288.1);

  --accent:       oklch(0.9221 0.0373 
