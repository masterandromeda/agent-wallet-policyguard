"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card, CardHeader, CardBody, Badge, Button, AlertBanner, LoadingState,
  StatCard,
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";
import { apiGet } from "@/lib/api-client";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  BarChart3, Download, Filter, RefreshCw, TrendingUp, ShieldX,
  CheckCircle2, Clock, Bot, AlertTriangle, FileText, FileJson,
  Calendar,
} from "lucide-react";
import {
  formatUSD, formatDateTime, formatRelativeTime, txStatusColor,
} from "@/lib/utils";
import type { Transaction, Agent } from "@/lib/types";

// ── Chart tooltip ─────────────────────────────────────────────
function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="solid-card px-3 py-2 text-xs space-y-1 min-w-[120px]">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-bold">{typeof p.value === "number" && p.name.toLowerCase().includes("usd") ? formatUSD(p.value) : p.value}</span></p>
      ))}
    </div>
  );
}

// ── Date range helper ─────────────────────────────────────────
function withinRange(ts: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const t = new Date(ts).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to   && t > new Date(to + "T23:59:59Z").getTime()) return false;
  return true;
}

const DONUT_COLORS = ["#10b981", "#f43f5e", "#f59e0b", "#8b5cf6"];

export default function AnalyticsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [agents, setAgents]             = useState<Agent[]>([]);
  const [isLoading, setIsLoading]       = useState(true);

  // Filters
  const [fromDate, setFromDate]       = useState("");
  const [toDate, setToDate]           = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [txRes, agentRes] = await Promise.all([
        apiGet<{ data: Transaction[] }>("/api/transactions"),
        apiGet<{ data: Agent[] }>("/api/agents"),
      ]);
      setTransactions(txRes.data ?? []);
      setAgents(agentRes.data ?? []);
    } catch (err: unknown) {
      toast({ type: "error", title: "Failed to load data", message: String(err) });
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtered dataset
  const filtered = transactions.filter((t) => {
    if (!withinRange(t.timestamp, fromDate, toDate)) return false;
    if (agentFilter !== "all" && t.agentName !== agentFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  // Derived metrics
  const approved  = filtered.filter((t) => t.status === "approved");
  const blocked   = filtered.filter((t) => t.status === "blocked");
  const pending   = filtered.filter((t) => t.status === "pending");
  const totalVol  = approved.reduce((a, t) => a + t.amountUSD, 0);
  const blockedVol = blocked.reduce((a, t) => a + t.amountUSD, 0);
  const blockRate = filtered.length > 0 ? ((blocked.length / filtered.length) * 100).toFixed(1) : "0.0";
  const agentNames = Array.from(new Set(transactions.map((t) => t.agentName)));

  // Daily volume chart (last 7 days)
  const dailyMap: Record<string, { approved: number; blocked: number; volume: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dailyMap[key] = { approved: 0, blocked: 0, volume: 0 };
  }
  filtered.forEach((t) => {
    const key = new Date(t.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (dailyMap[key]) {
      if (t.status === "approved") { dailyMap[key].approved++; dailyMap[key].volume += t.amountUSD; }
      if (t.status === "blocked")  dailyMap[key].blocked++;
    }
  });
  const dailyData = Object.entries(dailyMap).map(([day, v]) => ({ day, ...v }));

  // Agent spend bar
  const agentSpend = agents.map((a) => ({
    name: a.name.length > 12 ? a.name.slice(0, 12) + "…" : a.name,
    spent: a.spendingBudget.monthlySpentUSD,
    limit: a.spendingBudget.monthlyLimitUSD,
  }));

  // Donut data
  const donutData = [
    { name: "Approved", value: approved.length },
    { name: "Blocked",  value: blocked.length  },
    { name: "Pending",  value: pending.length  },
  ].filter((d) => d.value > 0);

  // Risk distribution
  const riskBuckets = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  filtered.forEach((t) => {
    if      (t.riskScore < 25) riskBuckets.Low++;
    else if (t.riskScore < 50) riskBuckets.Medium++;
    else if (t.riskScore < 75) riskBuckets.High++;
    else                        riskBuckets.Critical++;
  });
  const riskData = Object.entries(riskBuckets).map(([name, value]) => ({ name, value }));

  // ── JSON Export ───────────────────────────────────────────────
  function exportJSON() {
    const report = {
      metadata: {
        title: "PolicyGuard Analytics Report",
        generatedAt: new Date().toISOString(),
        filters: { fromDate, toDate, agentFilter, statusFilter },
        version: "1.0",
      },
      summary: {
        totalTransactions: filtered.length,
        approved: approved.length,
        blocked: blocked.length,
        pending: pending.length,
        approvedVolumeUSD: totalVol,
        blockedVolumeUSD: blockedVol,
        blockRatePercent: parseFloat(blockRate),
      },
      transactions: filtered.map((t) => ({
        id: t.id, agentId: t.agentId, agentName: t.agentName,
        toAddress: t.toAddress, toLabel: t.toLabel,
        amountUSD: t.amountUSD, status: t.status,
        policyName: t.policyName, blockReason: t.blockReason,
        riskScore: t.riskScore, riskFlags: t.riskFlags,
        network: t.network, timestamp: t.timestamp,
        isSimulated: t.isSimulated,
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `policyguard-report-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast({ type: "success", title: "JSON report exported", message: `${filtered.length} records · policyguard-report-${new Date().toISOString().slice(0,10)}.json` });
  }

  // ── PDF Export (browser print) ────────────────────────────────
  function exportPDF() {
    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PolicyGuard Analytics Report</title>
  <style>
    body { font-family: -apple-system, Arial, sans-serif; color: #1e293b; margin: 0; padding: 24px; font-size: 13px; }
    .header { background: #0a1628; color: white; padding: 24px; border-radius: 8px; margin-bottom: 24px; }
    .header h1 { margin: 0 0 4px; font-size: 20px; color: #22d3ee; }
    .header p { margin: 0; color: #94a3b8; font-size: 12px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .kpi .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .kpi .value { font-size: 24px; font-weight: 700; margin-top: 4px; }
    .kpi .sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    h2 { font-size: 14px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin: 20px 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f8fafc; padding: 8px 10px; text-align: left; border-bottom: 2px solid #e2e8f0; font-weight: 600; color: #475569; }
    td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
    .badge-approved { background: #dcfce7; color: #15803d; }
    .badge-blocked  { background: #fee2e2; color: #dc2626; }
    .badge-pending  { background: #fef3c7; color: #d97706; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
    .simulated { background: #fef3c7; border: 1px solid #f59e0b; padding: 8px 12px; border-radius: 6px; margin-bottom: 16px; font-size: 11px; color: #92400e; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>PolicyGuard — Analytics Report</h1>
    <p>Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Filters: ${fromDate || "all"} → ${toDate || "all"} &nbsp;|&nbsp; Agent: ${agentFilter} &nbsp;|&nbsp; Status: ${statusFilter}</p>
  </div>

  <div class="simulated">⚠ DEMO MODE: All transaction data is simulated. No real blockchain activity is represented.</div>

  <div class="kpi-grid">
    <div class="kpi"><div class="label">Total Transactions</div><div class="value" style="color:#0ea5e9">${filtered.length}</div><div class="sub">Filtered period</div></div>
    <div class="kpi"><div class="label">Approved Volume</div><div class="value" style="color:#10b981">${formatUSD(totalVol)}</div><div class="sub">${approved.length} transactions</div></div>
    <div class="kpi"><div class="label">Blocked Volume</div><div class="value" style="color:#ef4444">${formatUSD(blockedVol)}</div><div class="sub">${blocked.length} blocked</div></div>
    <div class="kpi"><div class="label">Block Rate</div><div class="value" style="color:#f59e0b">${blockRate}%</div><div class="sub">Policy enforcement</div></div>
  </div>

  <h2>Transaction Detail</h2>
  <table>
    <thead><tr><th>ID</th><th>Agent</th><th>Recipient</th><th>Amount</th><th>Status</th><th>Policy</th><th>Risk</th><th>Time</th></tr></thead>
    <tbody>
      ${filtered.slice(0, 100).map((t) => `
        <tr>
          <td style="font-family:monospace;font-size:10px">${t.id.slice(0,16)}…</td>
          <td>${t.agentName}</td>
          <td>${t.toLabel ?? t.toAddress.slice(0,14)}…</td>
          <td style="font-weight:600;color:${t.status === "blocked" ? "#dc2626" : "#1e293b"}">${formatUSD(t.amountUSD)}</td>
          <td><span class="badge badge-${t.status}">${t.status}</span></td>
          <td style="font-size:10px">${t.policyName ?? "—"}</td>
          <td>${t.riskScore}/100</td>
          <td style="font-size:10px">${formatDateTime(t.timestamp)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  ${filtered.length > 100 ? `<p style="font-size:11px;color:#94a3b8;margin-top:8px">Showing first 100 of ${filtered.length} records. Export JSON for full dataset.</p>` : ""}

  <div class="footer">
    <span>PolicyGuard · Agent Wallet ERC-4337</span>
    <span>Report generated ${new Date().toISOString()}</span>
  </div>
</body>
</html>`;
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) { toast({ type: "error", title: "Pop-up blocked", message: "Allow pop-ups to generate PDF" }); return; }
    w.document.write(printContent); w.document.close();
    setTimeout(() => { w.print(); }, 500);
    toast({ type: "success", title: "PDF ready", message: "Print dialog opened — save as PDF" });
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        title="Analytics & Reports"
        subtitle="Business insights from real transaction data"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <Button variant="secondary" size="sm" onClick={exportJSON}>
              <FileJson className="w-3.5 h-3.5" /> Export JSON
            </Button>
            <Button variant="primary" size="sm" onClick={exportPDF}>
              <FileText className="w-3.5 h-3.5" /> Generate PDF
            </Button>
          </div>
        }
      />

      <div className="page-content fade-up">
        <AlertBanner variant="warning" icon={AlertTriangle}>
          <strong>Demo Mode:</strong> All metrics are derived from simulated data. PDF and JSON exports reflect actual persisted records in the database.
        </AlertBanner>

        {/* ── Filter bar ─────────────────────────────────────────── */}
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Date Range</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                  className="input-dark py-1.5 text-xs" style={{ width: 140 }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>to</span>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                  className="input-dark py-1.5 text-xs" style={{ width: 140 }} />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}
                  className="input-dark py-1.5 text-xs" style={{ width: 160 }}>
                  <option value="all">All Agents</option>
                  {agentNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="input-dark py-1.5 text-xs" style={{ width: 140 }}>
                  <option value="all">All Status</option>
                  <option value="approved">Approved</option>
                  <option value="blocked">Blocked</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              {(fromDate || toDate || agentFilter !== "all" || statusFilter !== "all") && (
                <button
                  onClick={() => { setFromDate(""); setToDate(""); setAgentFilter("all"); setStatusFilter("all"); }}
                  className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{ color: "#f43f5e", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.20)" }}
                >
                  Clear filters
                </button>
              )}
              <span className="ml-auto text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                {filtered.length} / {transactions.length} records
              </span>
            </div>
          </CardBody>
        </Card>

        {isLoading ? <LoadingState /> : (
          <>
            {/* ── KPI row ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Transactions" value={filtered.length} icon={TrendingUp} accent="cyan" subtext="Filtered period" />
              <StatCard label="Approved Volume" value={formatUSD(totalVol)} icon={CheckCircle2} accent="green" subtext={`${approved.length} transactions`} />
              <StatCard label="Blocked Volume" value={formatUSD(blockedVol)} icon={ShieldX} accent="red" subtext={`${blocked.length} blocked`} />
              <StatCard label="Block Rate" value={`${blockRate}%`} icon={AlertTriangle} accent="amber" subtext="Policy enforcement" />
            </div>

            {/* ── Charts row ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Daily activity area chart */}
              <Card className="xl:col-span-2">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" style={{ color: "var(--cyan)" }} />
                    <h3 className="text-sm font-semibold text-white">Daily Transaction Activity</h3>
                    <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>Last 7 days</span>
                  </div>
                </CardHeader>
                <CardBody>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={dailyData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="gApproved" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gBlocked" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.20} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.06)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: "#4a5568", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#4a5568", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="approved" stroke="#22d3ee" strokeWidth={2} fill="url(#gApproved)" dot={false} name="Approved" />
                      <Area type="monotone" dataKey="blocked"  stroke="#f43f5e" strokeWidth={2} fill="url(#gBlocked)"  dot={false} name="Blocked" />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 justify-center mt-2">
                    <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-[#22d3ee]" /><span className="text-xs" style={{ color: "var(--text-muted)" }}>Approved</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-[#f43f5e]" /><span className="text-xs" style={{ color: "var(--text-muted)" }}>Blocked</span></div>
                  </div>
                </CardBody>
              </Card>

              {/* Status donut */}
              <Card>
                <CardHeader>
                  <h3 className="text-sm font-semibold text-white">Transaction Status Breakdown</h3>
                </CardHeader>
                <CardBody className="space-y-4">
                  {donutData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie data={donutData} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={3} dataKey="value">
                            {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 8, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {donutData.map(({ name, value }, i) => (
                          <div key={name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: DONUT_COLORS[i] }} />
                              <span style={{ color: "var(--text-secondary)" }}>{name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{value}</span>
                              <span style={{ color: "var(--text-muted)" }}>({filtered.length > 0 ? ((value / filtered.length) * 100).toFixed(0) : 0}%)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>No data for selected filters</p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* ── Agent spend + risk dist ─────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Agent monthly spend */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4" style={{ color: "var(--cyan)" }} />
                    <h3 className="text-sm font-semibold text-white">Agent Monthly Spending</h3>
                  </div>
                </CardHeader>
                <CardBody>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={agentSpend} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.06)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#4a5568", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 8, fontSize: 11 }} formatter={(v) => formatUSD(Number(v))} />
                      <Bar dataKey="limit" fill="rgba(56,189,248,0.10)" radius={[3, 3, 0, 0]} name="Limit (USD)" />
                      <Bar dataKey="spent" fill="#22d3ee" radius={[3, 3, 0, 0]} name="Spent (USD)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>

              {/* Risk score distribution */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" style={{ color: "var(--cyan)" }} />
                    <h3 className="text-sm font-semibold text-white">Risk Score Distribution</h3>
                    <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>Advisory only</span>
                  </div>
                </CardHeader>
                <CardBody>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={riskData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.06)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#4a5568", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#4a5568", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="value" name="Transactions" radius={[4, 4, 0, 0]}>
                        {riskData.map((entry, i) => (
                          <Cell key={i} fill={["#10b981","#f59e0b","#f97316","#f43f5e"][i] ?? "#22d3ee"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs mt-2 text-center" style={{ color: "var(--text-muted)" }}>
                    AI risk scores are advisory signals — policy enforcement is independent
                  </p>
                </CardBody>
              </Card>
            </div>

            {/* ── Export panel ───────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4" style={{ color: "var(--cyan)" }} />
                  <h3 className="text-sm font-semibold text-white">Export Reports</h3>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* PDF */}
                  <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.12)" }}>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" style={{ color: "var(--cyan)" }} />
                      <span className="text-sm font-semibold text-white">PDF Business Report</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      Professional branded report with executive summary, KPI cards, transaction table, policy results, and timestamps. Opens print dialog — save as PDF.
                    </p>
                    <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                      <p>✓ PolicyGuard branding + report metadata</p>
                      <p>✓ KPI summary cards + transaction table</p>
                      <p>✓ Applied filters embedded in report</p>
                      <p>✓ First 100 records (export JSON for full set)</p>
                    </div>
                    <Button variant="primary" size="sm" onClick={exportPDF}>
                      <FileText className="w-3.5 h-3.5" /> Generate PDF Report
                    </Button>
                  </div>

                  {/* JSON */}
                  <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)" }}>
                    <div className="flex items-center gap-2">
                      <FileJson className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-semibold text-white">JSON Data Export</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      Structured JSON with report metadata, filters, summary metrics, and all filtered transaction records. Use for compliance audits and integrations.
                    </p>
                    <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                      <p>✓ Report metadata + generation timestamp</p>
                      <p>✓ Applied filters + summary statistics</p>
                      <p>✓ Full transaction dataset (no record limit)</p>
                      <p>✓ Policy results + risk flags per transaction</p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={exportJSON}>
                      <FileJson className="w-3.5 h-3.5" /> Export JSON ({filtered.length} records)
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
