"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// ─── Card ─────────────────────────────────────────────────────
interface CardProps { children: React.ReactNode; className?: string; }
export function Card({ children, className }: CardProps) {
  return (
    <div className={cn("solid-card", className)}>
      {children}
    </div>
  );
}
export function CardHeader({ children, className }: CardProps) {
  return (
    <div className={cn("px-5 pt-5 pb-4", className)}
      style={{ borderBottom: "1px solid rgba(56,189,248,0.08)" }}>
      {children}
    </div>
  );
}
export function CardBody({ children, className }: CardProps) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

// ─── Glass Card ────────────────────────────────────────────────
export function GlassCard({ children, className }: CardProps) {
  return <div className={cn("glass-card", className)}>{children}</div>;
}

// ─── KPI Stat Card ─────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  iconClass?: string;
  trend?: { value: string; positive?: boolean };
  className?: string;
  accent?: "cyan" | "green" | "red" | "amber" | "violet" | "blue" | "teal";
}
const ACCENT_MAP = {
  cyan:   { icon: "icon-box-cyan",   value: "#22d3ee", bar: "#22d3ee" },
  green:  { icon: "icon-box-green",  value: "#10b981", bar: "#10b981" },
  red:    { icon: "icon-box-red",    value: "#f43f5e", bar: "#f43f5e" },
  amber:  { icon: "icon-box-amber",  value: "#f59e0b", bar: "#f59e0b" },
  violet: { icon: "icon-box-violet", value: "#8b5cf6", bar: "#8b5cf6" },
  blue:   { icon: "icon-box-blue",   value: "#3b82f6", bar: "#3b82f6" },
  teal:   { icon: "icon-box-teal",   value: "#2dd4bf", bar: "#2dd4bf" },
};
export function StatCard({ label, value, subtext, icon: Icon, iconClass, trend, className, accent = "cyan" }: StatCardProps) {
  const a = ACCENT_MAP[accent];
  return (
    <div className={cn("kpi-card p-5", className)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="section-label">{label}</p>
        <div className={cn("icon-box w-9 h-9", iconClass || a.icon)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white leading-none mb-1" style={{ color: a.value }}>
        {value}
      </p>
      {subtext && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{subtext}</p>}
      {trend && (
        <p className={cn("text-xs font-medium mt-2", trend.positive ? "text-emerald-400" : "text-rose-400")}>
          {trend.positive ? "↑" : "↓"} {trend.value}
        </p>
      )}
    </div>
  );
}

// ─── Page Header ───────────────────────────────────────────────
interface PageHeaderProps {
  breadcrumb?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}
export function PageHeader({ breadcrumb, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div>
        {breadcrumb && <p className="section-label mb-2">{breadcrumb}</p>}
        <h1 className="text-xl font-bold text-white leading-tight">{title}</h1>
        {subtitle && <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0 mt-1">{actions}</div>}
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}
export function SectionHeader({ title, subtitle, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

// ─── Badge ──────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}
export function Badge({ children, className, dot }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold",
      className
    )}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />}
      {children}
    </span>
  );
}

// ─── Button ─────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
}
export function Button({ variant = "secondary", size = "md", loading, children, className, disabled, ...props }: ButtonProps) {
  const sizes = { xs: "px-2.5 py-1 text-xs", sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-5 py-2.5 text-sm" };
  const variants = {
    primary: "btn-primary-glow",
    secondary: "btn-secondary",
    danger: "btn-danger",
    ghost: "bg-transparent hover:bg-white/5 text-[#94a3b8] hover:text-white border-transparent",
    outline: "bg-transparent border border-[rgba(56,189,248,0.18)] text-[#94a3b8] hover:border-[#22d3ee] hover:text-[#22d3ee]",
  };
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium cursor-pointer select-none border",
        variants[variant], sizes[size], className
      )}
      {...props}
    >
      {loading && (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      )}
      {children}
    </button>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────
interface ProgressBarProps {
  value: number; // 0–100
  variant?: "default" | "warn" | "danger" | "green";
  className?: string;
  showLabel?: boolean;
}
export function ProgressBar({ value, variant = "default", className, showLabel }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  const auto = pct > 85 ? "warn" : variant;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 progress-track">
        <div
          className={cn(
            "progress-fill",
            (auto === "warn" || auto === "danger") ? "progress-fill-warn" :
            auto === "green" ? "progress-fill-green" : ""
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)", minWidth: 32, textAlign: "right" }}>{pct}%</span>}
    </div>
  );
}

// ─── Table ──────────────────────────────────────────────────────
export function Table({ children, className }: CardProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-4 py-3 text-left text-xs font-semibold tracking-wider", className)}
      style={{ color: "var(--text-muted)", borderBottom: "1px solid rgba(56,189,248,0.08)" }}>
      {children}
    </th>
  );
}
export function Td({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <td className={cn("px-4 py-3 text-sm", className)}
      style={{ color: "var(--text-secondary)", borderBottom: "1px solid rgba(56,189,248,0.05)", ...style }}>
      {children}
    </td>
  );
}
export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tr className={cn("table-row-hover transition-colors", className)}>{children}</tr>;
}

// ─── Empty State ────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-xl icon-box-cyan flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-[#22d3ee]" />
        </div>
      )}
      <p className="text-sm font-semibold text-white">{title}</p>
      {description && <p className="text-xs mt-1 max-w-xs" style={{ color: "var(--text-muted)" }}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Simulated Data Label ───────────────────────────────────────
export function SimulatedDataLabel() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold badge-amber">
      ⚠ Demo
    </span>
  );
}

// ─── Risk Score Pill ────────────────────────────────────────────
export function RiskScorePill({ score, showBar }: { score: number; showBar?: boolean }) {
  const color = score >= 90 ? "#f43f5e" : score >= 70 ? "#f97316" : score >= 40 ? "#f59e0b" : "#10b981";
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold tabular-nums" style={{ color }}>{score}</span>
      {showBar && (
        <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

// ─── Spinner ────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className || "w-5 h-5 text-[#22d3ee]")} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  );
}

// ─── Loading state ──────────────────────────────────────────────
export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16 gap-3">
      <Spinner />
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{message}</span>
    </div>
  );
}

// ─── Connection status badge ────────────────────────────────────
export function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
      connected ? "badge-green" : "badge-amber")}>
      <span className={cn("w-1.5 h-1.5 rounded-full bg-current", connected ? "pulse-dot" : "")} />
      {connected ? "Live" : "Demo mode"}
    </div>
  );
}

// ─── Tab Bar ────────────────────────────────────────────────────
interface TabBarProps {
  tabs: { key: string; label: string; icon?: LucideIcon; count?: number }[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}
export function TabBar({ tabs, active, onChange, className }: TabBarProps) {
  return (
    <div className={cn("flex gap-1 p-1 rounded-xl", className)}
      style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(56,189,248,0.08)" }}>
      {tabs.map(({ key, label, icon: Icon, count }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
            active === key ? "bg-[#0a1628] text-white" : "text-[#94a3b8] hover:text-white"
          )}
          style={active === key ? { boxShadow: "0 1px 4px rgba(0,0,0,0.4)" } : {}}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
          {count !== undefined && count > 0 && (
            <span className="badge-amber px-1.5 py-0 rounded-full text-xs">{count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Inline alert ───────────────────────────────────────────────
interface AlertBannerProps {
  variant: "info" | "warning" | "error" | "success";
  children: React.ReactNode;
  className?: string;
  icon?: LucideIcon;
}
export function AlertBanner({ variant, children, className, icon: Icon }: AlertBannerProps) {
  const styles = {
    info:    { bg: "rgba(59,130,246,0.08)",   border: "rgba(59,130,246,0.25)",  text: "#60a5fa" },
    warning: { bg: "rgba(245,158,11,0.08)",   border: "rgba(245,158,11,0.25)",  text: "#fbbf24" },
    error:   { bg: "rgba(244,63,94,0.08)",    border: "rgba(244,63,94,0.25)",   text: "#f87171" },
    success: { bg: "rgba(16,185,129,0.08)",   border: "rgba(16,185,129,0.25)",  text: "#34d399" },
  };
  const s = styles[variant];
  return (
    <div className={cn("flex items-start gap-3 px-4 py-3 rounded-xl text-xs", className)}
      style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      {Icon && <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: s.text }} />}
      <span style={{ color: s.text }}>{children}</span>
    </div>
  );
}
