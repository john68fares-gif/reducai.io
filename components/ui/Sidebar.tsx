"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Hammer,
  Rocket,
  Key,
  HelpCircle,
  Mic,
  Phone,
  Monitor,
  ShoppingCart,
  BookOpen,
  Package,
} from "lucide-react";

// tiny class joiner
function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/build", label: "Build", desc: "Create AI agent", icon: Home },
    { href: "/improve", label: "Improve", desc: "Integrate & optimize", icon: Hammer },
    { href: "/voice", label: "Voice Agent", desc: "Calls & persona", icon: Mic },
    { href: "/phone-numbers", label: "Phone Numbers", desc: "Link provider numbers", icon: Phone },
    { href: "/demo", label: "Demo", desc: "Showcase to clients", icon: Monitor },
    { href: "/launch", label: "Launch", desc: "Deploy to production", icon: Rocket },
    { href: "/marketplace", label: "Marketplace", desc: "", icon: ShoppingCart },
    { href: "/ai-mentor", label: "AI Mentor", desc: "", icon: BookOpen },
    { href: "/api-key", label: "API Key", desc: "", icon: Key },
    { href: "/bulk-tester", label: "Bulk Tester", desc: "", icon: Package },
    { href: "/video-guides", label: "Video Guides", desc: "", icon: Monitor },
    { href: "/support", label: "Support", desc: "Help & FAQ", icon: HelpCircle },
  ];

  return (
    <div className="sidebar flex flex-col h-screen w-[260px] border-r">
      {/* Logo / title */}
      <div className="px-4 py-6">
        <div className="text-lg font-bold text-accent-green">reducai.io</div>
        <div className="text-xs text-foreground/60">Builder Workspace</div>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-2 px-2">
        {navItems.map(({ href, label, desc, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-3 transition-all",
                active
                  ? "bg-accent-green/10 text-accent-green shadow-[0_0_12px_rgba(0,255,194,0.25)]"
                  : "text-foreground/70 hover:bg-accent-green/5 hover:text-foreground"
              )}
            >
              <Icon size={20} />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{label}</span>
                {desc && (
                  <span className="text-xs text-foreground/50 group-hover:text-foreground/70">
                    {desc}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
