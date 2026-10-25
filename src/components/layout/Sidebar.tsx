"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import React from "react";
import {
  LayoutDashboard,
  Bot,
  ShieldCheck,
  ListOrdered,
  ShieldAlert,
  Wallet,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── 6 primary nav items ──────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  description: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/owner",
    label: "Owner Dashboard",
    icon: LayoutDashboard,
    description: "KPIs, approvals, agent activity",
  },
  {
    href: "/customer",
    label: "Customer Dashboard",
    icon: ListOrdered,
    description: "Payment requests & history",
  },
  {
    href: "/workspace",
    label: "AI Agent Dashboard",
    icon: Bot,
    badge: "LIVE",
    description: "Tasks, execution & policy results",
  },
  {
    href: "/analytics",
    label: "Analytics & Reports",
    icon: ShieldCheck,
    description: "Insights, trends & PDF exports",
  },
  {
    href: "/transactions",
    label: "Transaction History",
    icon: ListOrdered,
    description: "All payment records & audit",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: ShieldAlert,
    description: "Profile, wallet & integrations",
  },
];

function NavBadge({ badge }: { badge: string }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded font-bold tracking-wide flex-shrink-0"
      style={{ background: "rgba(34,211,238,0.15)", color: "#22d3ee", fontSize: 9 }}
    >
      {badge}
    </span>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/" || pathname === "";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Brand header ────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 flex-shrink-0"
        style={{
          height: "var(--topbar-height)",
          borderBottom: "1px solid rgba(34,211,238,0.07)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)",
              boxShadow: "0 0 14px rgba(34,211,238,0.28)",
            }}
          >
            <Wallet style={{ width: 15, height: 15, color: "#020818" }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight tracking-tight">PolicyGuard</p>
            <p style={{ color: "var(--text-muted)", fontSize: 10, lineHeight: 1.3 }}>
              Agent Wallet · ERC-4337
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 lg:hidden flex-shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Network pill ────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          <div className="min-w-0 flex-1 overflow-hidden">
            <p style={{ color: "#fbbf24", fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>
              Sepolia Testnet
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 10, lineHeight: 1.3 }}>
              Not connected · Demo mode
            </p>
          </div>
        </div>
      </div>

      {/* ── 5 Main nav items ─────────────────────────────── */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        <div className="space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, badge, description }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all group",
                  active ? "nav-active" : "hover:bg-white/[0.04]"
                )}
                style={{ color: active ? "var(--cyan)" : "var(--text-secondary)" }}
              >
                {/* Icon */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: active
                      ? "rgba(34,211,238,0.12)"
                      : "rgba(255,255,255,0.04)",
                  }}
                >
                  <Icon
                    className="w-4 h-4"
                    style={{ color: active ? "var(--cyan)" : "var(--text-muted)" }}
                  />
                </div>

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold leading-tight truncate">{label}</span>
                    {badge && <NavBadge badge={badge} />}
                  </div>
                  <p
                    className="text-xs leading-tight truncate mt-0.5"
                    style={{ color: "var(--text-muted)", fontSize: 10 }}
                  >
                    {description}
                  </p>
                </div>

                {/* Active indicator */}
                {active && (
                  <ChevronRight
                    className="w-3 h-3 flex-shrink-0 opacity-60"
                    style={{ color: "var(--cyan)" }}
                  />
                )}
              </Link>
            );
          })}
        </div>

      </nav>

      {/* ── ERC-4337 status strip ────────────────────────── */}
      <div className="px-4 py-3 flex-shrink-0">
        <div
          className="px-3 py-2.5 rounded-xl"
          style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.09)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-3 h-3 flex-shrink-0" style={{ color: "var(--cyan)" }} />
            <span style={{ color: "var(--cyan)", fontSize: 11, fontWeight: 600 }}>ERC-4337 Ready</span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 10, lineHeight: 1.4 }}>
            Contracts not deployed. Connect wallet to enable on-chain enforcement.
          </p>
        </div>
      </div>

      {/* ── User profile row ─────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(34,211,238,0.07)" }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-white"
          style={{ background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", fontSize: 11 }}
        >
          AC
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="font-semibold text-white truncate" style={{ fontSize: 12 }}>
            Alexandra Chen
          </p>
          <p className="truncate" style={{ color: "var(--text-muted)", fontSize: 10 }}>
            Owner · usr_01
          </p>
        </div>
        <button
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
          style={{ color: "var(--text-muted)" }}
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden lg:flex flex-col select-none"
        style={{
          width: "var(--sidebar-width)",
          background: "var(--bg-sidebar)",
          borderRight: "1px solid rgba(34,211,238,0.07)",
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile hamburger ────────────────────────────── */}
      <button
        className="fixed top-4 left-4 z-50 p-2 rounded-lg lg:hidden"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(34,211,238,0.14)",
          color: "var(--text-secondary)",
        }}
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ── Mobile overlay + drawer ──────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: "rgba(2,8,24,0.75)", backdropFilter: "blur(4px)" }}
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex flex-col lg:hidden"
            style={{
              width: "var(--sidebar-width)",
              background: "var(--bg-sidebar)",
              borderRight: "1px solid rgba(34,211,238,0.07)",
            }}
          >
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}
