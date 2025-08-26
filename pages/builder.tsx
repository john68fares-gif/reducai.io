import dynamic from "next/dynamic";
const BuilderDashboard = dynamic(() => import("../components/builder/BuilderDashboard"), { ssr: true });
export default function BuilderPage(){ return <BuilderDashboard/>; }
