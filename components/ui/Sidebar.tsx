"use client";

import { useEffect, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Prevent duplicate sidebars if _app renders twice on client
let SIDEBAR_MOUNTED = false;

// tiny class joiner
function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (SIDEBAR_MOUNTED) return;
    SIDEBAR_MOUNTED = true;
  }, []);

  const navItems = [
    { href: "/build", label: "Build", icon: Home },
    { href: "/improve", label: "Improve", icon: Hammer },
    { href: "/voice", label: "Voice Agent", icon: Mic },
    { href: "/launch", label: "Launch", icon: Rocket },
    { href: "/phone-numbers", label: "Phone Numbers", icon: Phone },
    { href: "/api-key", label: "API Key", icon: Key },
    { href: "/support", label: "Support", icon: HelpCircle },
  ];

  return (
    <div
      className={cn(
        "sidebar flex flex-col h-screen border-r transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-accent-green/40 bg-background text-foreground shadow-md hover:bg-accent-green/10 transition"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Nav items */}
      <nav className="mt-16 flex flex-col gap-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center" : "justify-start",
                active
                  ? "bg-accent-green/10 text-accent-green"
                  : "text-foreground/70 hover:bg-accent-green/5 hover:text-foreground"
              )}
            >
              <Icon size={20} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
