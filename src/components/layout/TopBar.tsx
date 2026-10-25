"use client";

import { Bell, Search, RefreshCw, ChevronRight } from "lucide-react";
import { ConnectionBadge } from "@/components/ui/index";

interface TopBarProps {
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, subtitle, breadcrumb, actions }: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6"
      style={{
        height: "var(--topbar-height)",
        background: "rgba(2,8,24,0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(34,211,238,0.07)",
      }}
    >
      {/* Left: breadcrumb + title */}
      <div className="flex items-center gap-2 min-w-0">
        {breadcrumb && (
          <>
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{breadcrumb}</span>
            <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          </>
        )}
        <h1 className="text-sm font-semibold text-white truncate">{title}</h1>
        {subtitle && (
          <span className="hidden md:block text-xs" style={{ color: "var(--text-muted)" }}>— {subtitle}</span>
        )}
      </div>

      {/* Right: search + badges + actions */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Search bar */}
        <div
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{
            background: "rgba(7,16,32,0.9)",
            border: "1px solid rgba(56,189,248,0.10)",
            width: 200,
          }}
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm outline-none flex-1 min-w-0"
            style={{ color: "var(--text-primary)", caretColor: "#22d3ee" }}
          />
        </div>

        {/* Demo badge */}
        <ConnectionBadge connected={false} />

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <Bell className="w-4 h-4" />
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ background: "#f43f5e" }}
          />
        </button>

        {actions}
      </div>
    </header>
  );
}
