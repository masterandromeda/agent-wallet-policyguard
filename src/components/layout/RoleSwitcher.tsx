"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ShieldCheck, Users, Bot } from "lucide-react";

const ROLES = [
  { href: "/owner",    label: "Owner",    icon: ShieldCheck, accent: "#22d3ee" },
  { href: "/customer", label: "Customer", icon: Users,       accent: "#2dd4bf" },
  { href: "/agent",    label: "Agent",    icon: Bot,         accent: "#8b5cf6" },
];

export function RoleSwitcher() {
  const pathname = usePathname();

  return (
    <div
      className="fixed top-3.5 right-4 z-50 flex items-center gap-1 p-1 rounded-xl"
      style={{
        background: "rgba(5,14,28,0.92)",
        border: "1px solid rgba(34,211,238,0.12)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      <span className="px-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>View:</span>
      {ROLES.map(({ href, label, icon: Icon, accent }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              active ? "text-white" : "text-[#94a3b8] hover:text-white hover:bg-white/5"
            )}
            style={active ? {
              background: `rgba(${accent === "#22d3ee" ? "34,211,238" : accent === "#2dd4bf" ? "45,212,191" : "139,92,246"},0.12)`,
              border: `1px solid ${accent}30`,
              color: accent,
            } : {}}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
