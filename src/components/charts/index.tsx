"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { TimeSeriesPoint, SpendingByAgent } from "@/lib/types";

// ─── Transaction Volume Area Chart ───────────────────────────
interface VolumeChartProps {
  data: TimeSeriesPoint[];
}
export function VolumeChart({ data }: VolumeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradBlocked" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={2}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#94a3b8" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#64748b", paddingTop: 8 }}
        />
        <Area type="monotone" dataKey="approved" stroke="#3b82f6" strokeWidth={2} fill="url(#gradApproved)" name="Approved" dot={false} />
        <Area type="monotone" dataKey="blocked" stroke="#f43f5e" strokeWidth={2} fill="url(#gradBlocked)" name="Blocked" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Spending by Agent Bar Chart ─────────────────────────────
interface SpendingChartProps {
  data: SpendingByAgent[];
}
export function SpendingChart({ data }: SpendingChartProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
        <YAxis type="category" dataKey="agentName" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [`$${Number(v ?? 0).toLocaleString()}`, ""]}
        />
        <Bar dataKey="limitUSD" fill="#1e293b" radius={[0, 4, 4, 0]} name="Limit" />
        <Bar dataKey="spentUSD" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Spent" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Status Donut Chart ───────────────────────────────────────
const STATUS_COLORS = ["#3b82f6", "#f43f5e", "#f59e0b", "#64748b"];

interface StatusDonutProps {
  approved: number;
  blocked: number;
  pending: number;
}
export function StatusDonut({ approved, blocked, pending }: StatusDonutProps) {
  const data = [
    { name: "Approved", value: approved },
    { name: "Blocked", value: blocked },
    { name: "Pending", value: pending },
  ].filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={48}
          outerRadius={68}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={STATUS_COLORS[index]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
