"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  StatCard, Card, CardHeader, CardBody, Badge, SimulatedDataLabel,
  AlertBanner, LoadingState, EmptyState,
} from "@/components/ui/index";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { apiGet } from "@/lib/api-client";
import { useSSE } from "@/hooks/useSSE";
import {
  TrendingUp, ShieldX, CheckCircle2, Clock, Bot, ShieldCheck,
  AlertTriangle, DollarSign, ArrowUpRight, RefreshCw,
  Activity, Shield,
} from "lucide-react";
import {
  formatUSD, formatRelativeTime, txStatusColor, agentStatusColor,
  riskLevelBg,
} from "@/lib/utils";
import Link from "next/link";
import type { Agent, Transaction, RiskAlert } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalTransactions: number;
  approvedPayments: number;
  blockedPayments: number;
  pendingApprovals: number;
  totalVolumeUSD: number;
  blockedVolumeUSD: number;
  activeAgents: number;
  activePolicies: number;
  criticalAlerts: number;
}

interface ChartDay {
  day: string;
  approved: number;
  blocked: number;
  volume: number;
}

interface ApiResponse {
  data: DashboardStats;
  stats: DashboardStats;
  recentTransactions: Transaction[];
  agents: Agent[];
  riskAlerts: RiskAlert[];
  chart7d: ChartDay[];
  pendingApprovals: number;
  unacknowledgedAlerts: number;
}

const DONUT_COLORS = ["#22d3ee", "#f43f5e", "#f59e0b"];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="solid-card px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.name === "approved" ? "#22d3ee" : "#f43f5e" }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await apiGet<ApiResponse>("/api/stats");
      setData(res);
    } catch {
      // keep previous data if refresh fails
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // SSE live updates — reload stats on any event
  useSSE("owner", {
    transaction_update: () => loadData(),
    approval_update:    () => loadData(),
    agent_update:       () => loadData(),
    stats_update:       () => loadData(),
    risk_alert:         () => loadData(),
  });

  const stats = data?.stats ?? data?.data ?? null;
  const recentTx = data?.recentTransactions ?? [];
  const agents = data?.agents ?? [];
  const riskAlerts = data?.riskAlerts ?? [];
  const chart7d = data?.chart7d ?? [];

  const donutData = stats
    ? [
        { name: "Approved", value: stats.approvedPayments },
        { name: "Blocked",  value: stats.blockedPayments },
        { name: "Pending",  value: stats.pendingApprovals },
      ]
    : [];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        title="Owner Dashboard"
        subtitle="Live overview · policy enforcement · agent activity"
        actions={
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: "var(--text-muted)" }}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <div className="page-content fade-up">
        <AlertBanner variant="warning" icon={AlertTriangle}>
          <strong>Demo Mode — Simulated Transactions:</strong> All data is server-side enforced policy simulation.
          No real blockchain transactions or payments are active.
        </AlertBanner>

        {/* ── KPI Row 1 ── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Transactions"
                value={stats.totalTransactions}
                subtext="All time"
                icon={TrendingUp}
                accent="cyan"
              />
              <StatCard
                label="Approved Payments"
                value={stats.approvedPayments}
                subtext={formatUSD(stats.totalVolumeUSD) + " volume"}
                icon={CheckCircle2}
                accent="green"
              />
              <StatCard
                label="Blocked by Policy"
                value={stats.blockedPayments}
                subtext={formatUSD(stats.blockedVolumeUSD) + " protected"}
                icon={ShieldX}
                accent="red"
              />
              <StatCard
                label="Pending Approvals"
                value={stats.pendingApprovals}
                subtext="Require owner action"
                icon={Clock}
                accent="amber"
              />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Active Agents"
                value={stats.activeAgents}
                icon={Bot}
                accent="violet"
                subtext={`of ${agents.length} total`}
              />
              <StatCard
                label="Active Policies"
                value={stats.activePolicies}
                icon={ShieldCheck}
                accent="teal"
              />
              <StatCard
                label="Critical Alerts"
                value={stats.criticalAlerts}
                subtext="Unacknowledged"
                icon={AlertTriangle}
                accent={stats.criticalAlerts > 0 ? "red" : "green"}
              />
              <StatCard
                label="Monthly Volume"
                value={formatUSD(stats.totalVolumeUSD)}
                icon={DollarSign}
                accent="blue"
              />
            </div>
          </>
        ) : null}

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transaction Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Transaction Activity</h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Approved vs blocked · last 7 days
                  </p>
                </div>
                <SimulatedDataLabel />
              </div>
            </CardHeader>
            <CardBody>
              {chart7d.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Submit agent transactions to see activity
                  </p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chart7d} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.20} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.06)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: "#4a5568", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#4a5568", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="approved" stroke="#22d3ee" strokeWidth={2} fill="url(#gA)" dot={false} name="approved" />
                      <Area type="monotone" dataKey="blocked"  stroke="#f43f5e" strokeWidth={2} fill="url(#gB)" dot={false} name="blocked" />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-4 mt-2 justify-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 rounded bg-[#22d3ee]" />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Approved</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 rounded bg-[#f43f5e]" />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Blocked</span>
                    </div>
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          {/* Donut */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-white">Transaction Status</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Current breakdown</p>
            </CardHeader>
            <CardBody className="space-y-4">
              {donutData.every((d) => d.value === 0) ? (
                <div className="flex flex-col items-center py-6">
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>No transactions yet</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%" cy="50%"
                        innerRadius={42} outerRadius={60}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#0a1628",
                          border: "1px solid rgba(56,189,248,0.15)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {donutData.map(({ name, value }, i) => (
                      <div key={name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i] }} />
                          <span style={{ color: "var(--text-secondary)" }}>{name}</span>
                        </div>
                        <span className="text-white font-semibold tabular-nums">{value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── Risk Alerts + Agent Status ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk alerts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">Active Risk Alerts</h3>
                  {riskAlerts.length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full badge-amber">
                      {riskAlerts.length}
                    </span>
                  )}
                </div>
                <Link href="/risk" className="flex items-center gap-1 text-xs font-medium" style={{ color: "#22d3ee" }}>
                  View all <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {loading ? (
                <div className="p-4"><LoadingState message="Loading alerts…" /></div>
              ) : riskAlerts.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Shield className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs text-emerald-400 font-semibold">No active alerts</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>All agents operating within policy</p>
                </div>
              ) : (
                <div>
                  {riskAlerts.map((alert, i) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 px-5 py-3"
                      style={{ borderBottom: i < riskAlerts.length - 1 ? "1px solid rgba(56,189,248,0.06)" : undefined }}
                    >
                      <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        alert.level === "critical" ? "bg-rose-500 pulse-dot" :
                        alert.level === "high"     ? "bg-orange-500" :
                        alert.level === "medium"   ? "bg-amber-500" : "bg-emerald-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white">{alert.title}</p>
                        <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>
                          {alert.description}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                          {formatRelativeTime(alert.timestamp)}
                        </p>
                      </div>
                      <Badge className={riskLevelBg(alert.level)}>{alert.level}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Agent status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[#22d3ee]" />
                  <h3 className="text-sm font-semibold text-white">Agent Status</h3>
                </div>
                <Link href="/agents" className="flex items-center gap-1 text-xs font-medium" style={{ color: "#22d3ee" }}>
                  Manage <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardBody className="space-y-3 py-3">
              {loading ? (
                <LoadingState message="Loading agents…" />
              ) : agents.length === 0 ? (
                <EmptyState icon={Bot} title="No agents" description="Create an agent to get started" />
              ) : (
                agents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(7,16,32,0.5)", border: "1px solid rgba(56,189,248,0.06)" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 icon-box-violet">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{agent.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Risk:{" "}
                        <span className={`font-semibold ${
                          agent.riskScore > 75 ? "text-rose-400" :
                          agent.riskScore > 40 ? "text-amber-400" : "text-emerald-400"
                        }`}>
                          {agent.riskScore}
                        </span>
                        <span style={{ color: "var(--text-muted)", opacity: 0.5 }}> (advisory)</span>
                      </p>
                    </div>
                    <Badge className={agentStatusColor(agent.status)} dot>
                      {agent.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── Recent Transactions ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#22d3ee]" />
                <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Latest policy-enforced activity</p>
              </div>
              <Link href="/transactions" className="flex items-center gap-1 text-xs font-medium" style={{ color: "#22d3ee" }}>
                Full history <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <div>
            {loading ? (
              <div className="p-5"><LoadingState message="Loading transactions…" /></div>
            ) : recentTx.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Activity}
                  title="No transactions yet"
                  description="Transactions appear here after agents process payments via the workspace"
                />
              </div>
            ) : (
              recentTx.map((tx, i) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 px-5 py-3 table-row-hover"
                  style={{ borderBottom: i < recentTx.length - 1 ? "1px solid rgba(56,189,248,0.06)" : undefined }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-white">{tx.agentName}</span>
                      <Badge className={txStatusColor(tx.status)}>{tx.status}</Badge>
                      {tx.isSimulated && <SimulatedDataLabel />}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      → {tx.toLabel ?? tx.toAddress.slice(0, 18) + "…"} · {formatRelativeTime(tx.timestamp)}
                    </p>
                    {tx.blockReason && (
                      <p className="text-xs mt-0.5 text-rose-400 truncate">⛔ {tx.blockReason}</p>
                    )}
                  </div>
                  <p className={`text-sm font-bold tabular-nums flex-shrink-0 ${
                    tx.status === "blocked" ? "text-rose-400" : "text-white"
                  }`}>
                    {formatUSD(tx.amountUSD)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
