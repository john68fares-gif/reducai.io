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

// tiny class joiner
function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { href: "/build", label: "Build", desc: "Create AI agent", icon: Home },
    { href: "/improve", label: "Improve", desc: "Integrate & optimize", icon: Hammer },
    { href: "/voice", label: "Voice Agent", desc: "Calls & persona", icon: Mic },
    { href: "/phone-numbers", label: "Phone Numbers", desc: "Link provider numbers", icon: Phone },
    { href: "/launch", label: "Launch", desc: "Deploy to production", icon: Rocket },
    { href: "/api-key", label: "API Key", desc: "", icon: Key },
    { href: "/support", label: "Support", desc: "Help & FAQ", icon: HelpCircle },
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
      <nav className="mt-16 flex flex-col gap-2 px-2">
        {navItems.map(({ href, label, desc, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-3 transition-all",
                collapsed ? "justify-center" : "justify-start",
                active
                  ? "bg-accent-green/10 text-accent-green shadow-[0_0_12px_rgba(0,255,194,0.25)]"
                  : "text-foreground/70 hover:bg-accent-green/5 hover:text-foreground"
              )}
            >
              <Icon size={20} />
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{label}</span>
                  {desc && (
                    <span className="text-xs text-foreground/50 group-hover:text-foreground/70">
                      {desc}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom account section */}
      {!collapsed && (
        <div className="mt-auto p-4">
          <div className="flex items-center gap-3 rounded-xl bg-accent-green/10 px-3 py-3 cursor-pointer hover:bg-accent-green/20 transition">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-green text-black">
              <span className="font-bold text-xs">J</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">My Account</span>
              <span className="text-xs text-foreground/70">980 XP · Bronze</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
