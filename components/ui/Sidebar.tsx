// components/ui/Sidebar.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home, Hammer, Monitor, Rocket, Key,
  Package, BookOpen, HelpCircle, ShoppingCart,
  Bot, User, Mic, Phone, ChevronLeft, ChevronRight,
} from 'lucide-react';

function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

const LS_COLLAPSED = 'ui:sidebarCollapsed';
const W_EXPANDED = 260;
const W_COLLAPSED = 72;

let SIDEBAR_MOUNTED = false;

export default function Sidebar() {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState<boolean>(() => !SIDEBAR_MOUNTED);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (SIDEBAR_MOUNTED) {
      setAllowed(true);
    }
    SIDEBAR_MOUNTED = true;

    const stored = localStorage.getItem(LS_COLLAPSED);
    if (stored) {
      setCollapsed(stored === '1');
    }
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(LS_COLLAPSED, next ? '1' : '0');
  };

  const links = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/build', icon: Hammer, label: 'Build' },
    { href: '/improve', icon: Monitor, label: 'Improve' },
    { href: '/launch', icon: Rocket, label: 'Launch' },
    { href: '/keys', icon: Key, label: 'API Keys' },
    { href: '/packages', icon: Package, label: 'Packages' },
    { href: '/docs', icon: BookOpen, label: 'Docs' },
    { href: '/support', icon: HelpCircle, label: 'Support' },
    { href: '/shop', icon: ShoppingCart, label: 'Shop' },
    { href: '/agents', icon: Bot, label: 'Agents' },
    { href: '/profile', icon: User, label: 'Profile' },
    { href: '/voice', icon: Mic, label: 'Voice' },
    { href: '/phone', icon: Phone, label: 'Phone' },
  ];

  if (!allowed) return null;

  return (
    <div
      className="h-screen flex flex-col bg-[#0d0f11] border-r border-[#00ffc220] transition-[width] duration-500 ease-in-out"
      style={{ width: collapsed ? W_COLLAPSED : W_EXPANDED }}
    >
      <div className="flex-1 overflow-y-auto">
        <nav className="flex flex-col gap-1 p-2">
          {links.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center rounded-lg px-3 py-3 transition-colors duration-300',
                  active
                    ? 'bg-[#00ffc220] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#00ffc210]'
                )}
              >
                <Icon className="w-6 h-6 shrink-0" />
                <span
                  className={cn(
                    'ml-3 whitespace-nowrap overflow-hidden transition-all duration-500 ease-in-out',
                    collapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <button
        onClick={toggle}
        className="flex items-center justify-center p-3 hover:bg-[#00ffc210] text-gray-400 hover:text-white transition-colors duration-300"
      >
        {collapsed ? (
          <ChevronRight className="w-5 h-5" />
        ) : (
          <ChevronLeft className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
