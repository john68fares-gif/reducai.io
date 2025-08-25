import dynamic from 'next/dynamic';

const BuilderDashboard = dynamic(
  () => import('@/components/builder/BuilderDashboard'),
  { ssr: false }
);

export default function BuilderPage() {
  return <BuilderDashboard />;
}
