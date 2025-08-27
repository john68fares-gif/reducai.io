// pages/builder.tsx
import dynamic from 'next/dynamic';

// Robust dynamic that returns mod.default (if present) and shows a loader while it loads.
const BuilderDashboard = dynamic(
  async () => {
    const mod = await import('@/components/builder/BuilderDashboard');
    return mod.default || mod;
  },
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: 32, color: 'white' }}>
        Loading Builder…
      </div>
    ),
  }
);

export default function BuilderPage() {
  return <BuilderDashboard />;
}
