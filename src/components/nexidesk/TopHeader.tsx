"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/lib/brand";
import { HelpPanel } from "./HelpPanel";

export function TopHeader({ userInitials }: { userInitials: string }) {
  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 z-50 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-8">
        {/* Logo */}
        <div className="flex items-center">
          <BrandLogo height={28} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Help Icon (moved from modules sidebar) */}
        <HelpPanel />

        <div className="h-6 w-px bg-slate-200 mx-1 dark:bg-slate-700" />

        {/* User initials / Account */}
        <Link
          href="/app/account"
          title="Account Settings"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 border border-slate-200 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
        >
          {userInitials}
        </Link>

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          title="Sign out"
          aria-label="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-all hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

// Link component helper for TopHeader
import Link from "next/link";
