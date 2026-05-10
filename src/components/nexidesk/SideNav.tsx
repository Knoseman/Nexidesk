"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Inbox,
  Users,
  Settings,
  MessageSquare,
  LayoutDashboard,
  Tag,
  Mail,
} from "lucide-react";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/app/tickets", icon: Inbox, label: "Inbox" },
  { href: "/app/contacts", icon: Users, label: "Contacts" },
  { href: "/app/snippets", icon: MessageSquare, label: "Snippets" },
  {
    href: "/app/admin/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    adminOnly: true,
  },
  { href: "/app/admin/agents", icon: Settings, label: "Team", adminOnly: true },
  { href: "/app/admin/tags", icon: Tag, label: "Tags", adminOnly: true },
  {
    href: "/app/admin/autoresponse",
    icon: Mail,
    label: "Auto-reply",
    adminOnly: true,
  },
];

export function SideNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav
      className="flex h-full w-14 flex-shrink-0 flex-col items-center py-4 gap-2 bg-slate-900 border-r border-slate-800 z-40"
      aria-label="Module navigation"
    >
      <div className="flex flex-col items-center gap-2 w-full px-2">
        {visibleItems.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all hover:bg-white/10"
              style={{
                color: active ? "white" : "#94a3b8",
                backgroundColor: active
                  ? "rgba(255,255,255,0.15)"
                  : "transparent",
              }}
            >
              <Icon size={20} />
              {!active && (
                <div className="absolute left-14 hidden group-hover:block z-50">
                  <div className="rounded bg-slate-900 px-2 py-1 text-xs text-white shadow-lg whitespace-nowrap border border-slate-700">
                    {label}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
