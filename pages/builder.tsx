import dynamic from "next/dynamic";
// add the .tsx extension to be explicit
const BuilderDashboard = dynamic(
  () => import("../components/builder/BuilderDashboard.tsx"),
  { ssr: true }
);

export default function BuilderPage() {
  return <BuilderDashboard />;
}
