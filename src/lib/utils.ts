// Utility helpers shared across the app
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RiskLevel, TxStatus, AgentStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUSDPrecise(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAddress(address: string, chars = 6): string {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars)}…${address.slice(-4)}`;
}

export function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function riskLevelColor(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    low: "text-emerald-400",
    medium: "text-amber-400",
    high: "text-orange-400",
    critical: "text-rose-500",
  };
  return map[level];
}

export function riskLevelBg(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    critical: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  return map[level];
}

export function txStatusColor(status: TxStatus): string {
  const map: Record<TxStatus, string> = {
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    blocked: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    failed: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };
  return map[status];
}

export function agentStatusColor(status: AgentStatus): string {
  const map: Record<AgentStatus, string> = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    suspended: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    pending: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  return map[status];
}

export function riskScoreColor(score: number): string {
  if (score < 25) return "text-emerald-400";
  if (score < 50) return "text-amber-400";
  if (score < 75) return "text-orange-400";
  return "text-rose-500";
}

export function riskScoreBarColor(score: number): string {
  if (score < 25) return "bg-emerald-500";
  if (score < 50) return "bg-amber-500";
  if (score < 75) return "bg-orange-500";
  return "bg-rose-500";
}

export function percentageOf(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}
