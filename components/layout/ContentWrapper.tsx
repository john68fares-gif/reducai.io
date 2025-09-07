// components/layout/ContentWrapper.tsx
type Props = { children: React.ReactNode };

/**
 * This wrapper does NOT fight the side rails.
 * It leaves a left gutter for the main app sidebar (var(--sidebar-w))
 * and for the Assistant rail (var(--assist-rail)).
 * It also honors the app header height (var(--app-header-h)).
 */
export default function ContentWrapper({ children }: Props) {
  return (
    <div
      style={{
        // Page header offset
        paddingTop: 'var(--app-header-h, 64px)',
        // Leave room for main sidebar + assistant rail so content doesn’t sit behind them
        paddingLeft:
          'calc(var(--sidebar-w, 260px) + var(--assist-rail, 340px) + var(--content-gap, 24px))',
        paddingRight: 'var(--content-pad-r, 24px)',
        minHeight: '100vh',
      }}
      className="content-wrapper"
    >
      {children}
      <style jsx global>{`
        :root {
          /* Fallbacks if not already defined by your shell layout */
          --sidebar-w: 260px;
          --app-header-h: 64px;
          --assist-rail: 340px;
          --content-gap: 24px;
        }
      `}</style>
    </div>
  );
}
