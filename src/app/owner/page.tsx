"use client";

import { useState, useEffect, useCallback } from "react";
import { useSSE } from "@/hooks/useSSE";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { toast } from "@/components/ui/Toast";
import {
  Card, CardHeader, CardBody, Badge, Button, ProgressBar, GlassCard,
  StatCard, Table, Th, Td, Tr, SimulatedDataLabel, RiskScorePill,
  SectionHeader, AlertBanner, TabBar, EmptyState, LoadingState, Spinner,
} from "@/components/ui/index";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ShieldCheck, Bot, Clock, CheckCircle2, XCircle, AlertTriangle,
  Activity, RefreshCw, Plus, Lock, Unlock, TrendingUp, Users,
  DollarSign, Zap, Bell, Filter, Download, Eye, ChevronRight,
  ArrowUpRight, BarChart2, ShieldX,
} from "lucide-react";
import {
  formatUSD, formatRelativeTime, formatAddress,
  agentStatusColor, txStatusColor, percentageOf,
} from "@/lib/utils";
import type { Agent, Transaction, ApprovalRequest } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────
interface Stats {
  totalTransactions: number; approvedPayments: number; blockedPayments: number;
  pendingApprovals: number; totalVolumeUSD: number; blockedVolumeUSD: number;
  activeAgents: number; activePolicies: number; criticalAlerts: number;
}

// ── Chart data ────────────────────────────────────────────────
const CHART_DATA_7D = [
  { day: "Mon", approved: 3, blocked: 1, volume: 4200 },
  { day: "Tue", approved: 5, blocked: 0, volume: 8100 },
  { day: "Wed", approved: 2, blocked: 3, volume: 3400 },
  { day: "Thu", approved: 8, blocked: 1, volume: 15600 },
  { day: "Fri", approved: 6, blocked: 2, volume: 11200 },
  { day: "Sat", approved: 4, blocked: 0, volume: 6800 },
  { day: "Sun", approved: 9, blocked: 1, volume: 18200 },
];
const CHART_DATA_30D = [
  { day: "Jan 1",  approved: 12, blocked: 2,  volume: 18400 },
  { day: "Jan 5",  approved: 8,  blocked: 4,  volume: 9200  },
  { day: "Jan 10", approved: 15, blocked: 3,  volume: 24100 },
  { day: "Jan 15", approved: 5,  blocked: 3,  volume: 9800  },
  { day: "Jan 20", approved: 22, blocked: 1,  volume: 38900 },
  { day: "Jan 25", approved: 14, blocked: 5,  volume: 19600 },
  { day: "Jan 30", approved: 18, blocked: 2,  volume: 32100 },
];

const DONUT_COLORS = ["#22d3ee", "#f43f5e", "#f59e0b", "#8b5cf6"];

// ── Create Agent Modal ────────────────────────────────────────
function CreateAgentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (a: Agent) => void }) {
  const [form, setForm] = useState({ name: "", description: "", dailyLimit: "5000", perTxLimit: "1000", monthlyLimit: "50000" });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const res = await apiPost<{ data: Agent }>("/api/agents", {
        name: form.name, description: form.description, ownerId: "usr_01",
        spendingBudget: {
          dailyLimitUSD: parseFloat(form.dailyLimit),
          monthlyLimitUSD: parseFloat(form.monthlyLimit),
          perTxLimitUSD: parseFloat(form.perTxLimit),
        },
        permissions: [{ id: `perm_${Date.now()}`, type: "transfer", description: "Send payments", granted: true }],
      });
      toast({ type: "success", title: "Agent created", message: res.data.name });
      onCreated(res.data);
      onClose();
    } catch (err: unknown) {
      toast({ type: "error", title: "Failed to create agent", message: String(err) });
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(2,8,24,0.80)", backdropFilter: "blur(8px)" }}>
      <div className="solid-card w-full max-w-md fade-up">
        <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: "1px solid rgba(56,189,248,0.08)" }}>
          <div>
            <p className="section-label mb-1">Command Center</p>
            <h3 className="text-base font-bold text-white">Create AI Agent</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="px-6 pb-6 pt-5 space-y-4">
          {[
            { key: "name", label: "Agent Name *", placeholder: "e.g. PayBot Beta" },
            { key: "description", label: "Description", placeholder: "Purpose of this agent" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
              <input value={form[key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="input-dark" placeholder={placeholder} />
            </div>
          ))}
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "perTxLimit", label: "Per-Tx Limit ($)" },
              { key: "dailyLimit", label: "Daily Limit ($)" },
              { key: "monthlyLimit", label: "Monthly Limit ($)" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
                <input type="number" min="0" step="0.01"
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="input-dark" />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" className="flex-1" loading={loading}>Create Agent</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Approval Card ─────────────────────────────────────────────
function ApprovalCard({ apr, onAction }: { apr: ApprovalRequest; onAction: () => void }) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");

  async function act(action: "approve" | "reject") {
    setLoading(action);
    try {
      await apiPost("/api/approvals", { approvalId: apr.id, action, notes, ownerId: "usr_01" });
      toast({ type: action === "approve" ? "success" : "warning", title: action === "approve" ? "✓ Approved" : "✗ Rejected", message: `${apr.agentName} — ${formatUSD(apr.requestedAmount)}` });
      onAction();
    } catch (err: unknown) {
      toast({ type: "error", title: "Action failed", message: String(err) });
    } finally { setLoading(null); }
  }

  return (
    <div className="rounded-xl p-4 space-y-3 fade-up" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.20)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg icon-box-amber flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white">{apr.agentName}</span>
              <Badge className="badge-amber">Pending</Badge>
              <SimulatedDataLabel />
            </div>
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>{apr.reason}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold" style={{ color: "#fbbf24" }}>{formatUSD(apr.requestedAmount)}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>→ {apr.toLabel || formatAddress(apr.toAddress)}</p>
        </div>
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Owner notes (optional)..."
        rows={2}
        className="input-dark resize-none text-xs"
      />
      <div className="flex gap-2">
        <Button variant="primary" size="sm" className="flex-1" loading={loading === "approve"} onClick={() => act("approve")}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
        </Button>
        <Button variant="danger" size="sm" className="flex-1" loading={loading === "reject"} onClick={() => act("reject")}>
          <XCircle className="w-3.5 h-3.5" /> Reject
        </Button>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Expires {formatRelativeTime(apr.expiresAt)}</p>
    </div>
  );
}

// ── Chart Tooltip ─────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="solid-card px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.name === "approved" ? "#22d3ee" : p.name === "blocked" ? "#f43f5e" : "#8b5cf6" }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Main Owner Page ───────────────────────────────────────────
export default function OwnerPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [activeTab, setActiveTab] = useState<"approvals" | "transactions" | "agents">("approvals");
  const [chartPeriod, setChartPeriod] = useState<"7d" | "30d">("7d");
  const [txFilter, setTxFilter] = useState<"all" | "approved" | "blocked" | "pending">("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [txRes, aprRes, agentRes] = await Promise.all([
        apiGet<{ data: Transaction[]; stats: Stats }>("/api/transactions"),
        apiGet<{ data: ApprovalRequest[] }>("/api/approvals?status=pending"),
        apiGet<{ data: Agent[] }>("/api/agents?ownerId=usr_01"),
      ]);
      setTransactions(txRes.data);
      setStats(txRes.stats);
      setApprovals(aprRes.data);
      setAgents(agentRes.data);
    } catch (err: unknown) {
      toast({ type: "error", title: "Failed to load", message: String(err) });
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useSSE("owner", {
    init: (e) => { if (e.payload && typeof e.payload === "object" && "stats" in e.payload) setStats((e.payload as { stats: Stats }).stats); },
    stats_update: (e) => setStats(e.payload as Stats),
    task_new: (e) => {
      const task = e.payload as { agentName: string; amountUSD: number; merchant: string; requesterName: string };
      toast({ type: "info", title: "New customer request", message: `${task.requesterName} → ${task.agentName}: ${formatUSD(task.amountUSD)} to ${task.merchant}` });
    },
    task_update: (e) => {
      const task = e.payload as { status: string; agentName: string; amountUSD: number; merchant: string; requesterName: string };
      if (task.status === "awaiting_approval") {
        toast({ type: "warning", title: "⏳ Owner approval required", message: `${task.requesterName} — ${formatUSD(task.amountUSD)} to ${task.merchant}` });
        setActiveTab("approvals");
        loadAll();
      }
    },
    transaction_new: (e) => {
      const tx = e.payload as Transaction;
      setTransactions((prev) => [tx, ...prev]);
      toast({ type: "info", title: "New transaction", message: `${tx.agentName} — ${formatUSD(tx.amountUSD)}` });
    },
    transaction_update: () => loadAll(),
    approval_new: (e) => {
      const apr = e.payload as ApprovalRequest;
      setApprovals((prev) => [apr, ...prev]);
      toast({ type: "warning", title: "⏳ Approval required", message: `${apr.agentName} — ${formatUSD(apr.requestedAmount)}` });
      setActiveTab("approvals");
    },
    approval_update: () => loadAll(),
    agent_update: (e) => {
      const a = e.payload as Agent;
      setAgents((prev) => prev.map((x) => x.id === a.id ? a : x));
    },
  });

  async function toggleAgent(agent: Agent) {
    const newStatus = agent.status === "active" ? "paused" : "active";
    try {
      await apiPatch(`/api/agents/${agent.id}`, { status: newStatus });
      toast({ type: "success", title: `Agent ${newStatus}`, message: agent.name });
      loadAll();
    } catch (err: unknown) {
      toast({ type: "error", title: "Update failed", message: String(err) });
    }
  }

  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const filteredTx = txFilter === "all" ? transactions : transactions.filter((t) => t.status === txFilter);
  const chartData = chartPeriod === "7d" ? CHART_DATA_7D : CHART_DATA_30D;
  const donutData = stats ? [
    { name: "Approved", value: stats.approvedPayments },
    { name: "Blocked", value: stats.blockedPayments },
    { name: "Pending", value: stats.pendingApprovals },
  ] : [];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* ── Top bar ──────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-6 flex-shrink-0"
        style={{ height: "var(--topbar-height)", background: "rgba(2,8,24,0.90)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(34,211,238,0.07)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>PolicyGuard</span>
          <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          <span className="text-sm font-semibold text-white truncate">Owner Dashboard</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {pendingApprovals.length > 0 && (
            <button onClick={() => setActiveTab("approvals")} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold badge-amber flex-shrink-0">
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{pendingApprovals.length} pending</span>
              <span className="sm:hidden">{pendingApprovals.length}</span>
            </button>
          )}
          <button onClick={loadAll} className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button variant="primary" size="sm" onClick={() => setShowCreateAgent(true)}>
            <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">New Agent</span>
          </Button>
        </div>
      </header>

        <div className="page-content">
          {/* Demo notice */}
          <AlertBanner variant="warning" icon={AlertTriangle}>
            <strong>Demo / Pending On-Chain Integration</strong> — Policy enforcement is server-side only. Blockchain confirmation requires ERC-4337 smart contract deployment on Sepolia.
          </AlertBanner>

          {/* ── KPI Row ───────────────────────────────────── */}
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
            </div>
          ) : stats && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard label="Total Transactions" value={stats.totalTransactions} icon={TrendingUp} accent="cyan" subtext="All time" />
              <StatCard label="Approved" value={stats.approvedPayments} icon={CheckCircle2} accent="green" subtext={formatUSD(stats.totalVolumeUSD)} />
              <StatCard label="Blocked" value={stats.blockedPayments} icon={ShieldX} accent="red" subtext={`${formatUSD(stats.blockedVolumeUSD)} protected`} />
              <StatCard label="Pending Approval" value={stats.pendingApprovals} icon={Clock} accent="amber" subtext="Need owner action" />
              <StatCard label="Active Agents" value={stats.activeAgents} icon={Bot} accent="violet" subtext={`of ${agents.length} total`} />
              <StatCard label="Critical Alerts" value={stats.criticalAlerts} icon={AlertTriangle} accent={stats.criticalAlerts > 0 ? "red" : "green"} subtext="Unacknowledged" />
            </div>
          )}

          {/* ── Charts Row ────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Area chart */}
            <Card className="xl:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <SectionHeader title="Transaction Activity" subtitle="Approved vs blocked over time (demo data)" />
                  <div className="flex gap-1">
                    {(["7d", "30d"] as const).map((p) => (
                      <button key={p} onClick={() => setChartPeriod(p)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${chartPeriod === p ? "text-[#22d3ee] bg-[rgba(34,211,238,0.10)]" : "hover:bg-white/5"}`}
                        style={{ color: chartPeriod === p ? "#22d3ee" : "var(--text-muted)" }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradBlocked" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.20} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.06)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#4a5568", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#4a5568", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="approved" stroke="#22d3ee" strokeWidth={2} fill="url(#gradApproved)" dot={false} name="approved" />
                    <Area type="monotone" dataKey="blocked" stroke="#f43f5e" strokeWidth={2} fill="url(#gradBlocked)" dot={false} name="blocked" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-[#22d3ee]" /><span className="text-xs" style={{ color: "var(--text-muted)" }}>Approved</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-[#f43f5e]" /><span className="text-xs" style={{ color: "var(--text-muted)" }}>Blocked</span></div>
                </div>
              </CardBody>
            </Card>

            {/* Donut + legend */}
            <Card>
              <CardHeader>
                <SectionHeader title="Transaction Status" subtitle="Current period breakdown" />
              </CardHeader>
              <CardBody className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={3} dataKey="value">
                      {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 w-full mt-1">
                  {donutData.map(({ name, value }, i) => (
                    <div key={name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i] }} />
                        <span style={{ color: "var(--text-secondary)" }}>{name}</span>
                      </div>
                      <span className="font-bold text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* ── Main content + sidebar ────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left: Tabs */}
            <div className="xl:col-span-2 space-y-4">
              <TabBar
                tabs={[
                  { key: "approvals", label: "Approvals", icon: Clock, count: pendingApprovals.length },
                  { key: "transactions", label: "Transactions", icon: Activity },
                  { key: "agents", label: "Agents", icon: Bot },
                ]}
                active={activeTab}
                onChange={(k) => setActiveTab(k as typeof activeTab)}
              />

              {/* ── Approvals ────────────────────────────── */}
              {activeTab === "approvals" && (
                <div className="space-y-3">
                  {isLoading ? <LoadingState /> :
                    pendingApprovals.length === 0 ? (
                      <Card><CardBody>
                        <EmptyState icon={CheckCircle2} title="No pending approvals" description="All requests have been reviewed. You're all caught up!" />
                      </CardBody></Card>
                    ) : pendingApprovals.map((apr) => (
                      <ApprovalCard key={apr.id} apr={apr} onAction={loadAll} />
                    ))
                  }
                </div>
              )}

              {/* ── Transactions ─────────────────────────── */}
              {activeTab === "transactions" && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <SectionHeader title="Transaction History" subtitle={`${transactions.length} total records`} />
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {(["all", "approved", "blocked", "pending"] as const).map((f) => (
                            <button key={f} onClick={() => setTxFilter(f)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${txFilter === f ? "text-[#22d3ee] bg-[rgba(34,211,238,0.10)]" : "hover:bg-white/5"}`}
                              style={{ color: txFilter === f ? "#22d3ee" : "var(--text-muted)" }}>
                              {f}
                            </button>
                          ))}
                        </div>
                        <Button variant="ghost" size="xs"><Download className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody className="p-0">
                    {isLoading ? <LoadingState /> : filteredTx.length === 0 ? (
                      <EmptyState icon={Activity} title="No transactions" description="Transactions matching this filter will appear here." />
                    ) : (
                      <Table>
                        <thead><tr>
                          <Th>Agent</Th><Th>Recipient</Th><Th>Amount</Th>
                          <Th>Status</Th><Th>Risk</Th><Th>Time</Th>
                        </tr></thead>
                        <tbody>
                          {filteredTx.slice(0, 10).map((tx) => (
                            <Tr key={tx.id}>
                              <Td><span className="text-xs font-semibold text-white">{tx.agentName}</span></Td>
                              <Td>
                                <div>
                                  <p className="text-white text-xs font-medium">{tx.toLabel || "—"}</p>
                                  <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{formatAddress(tx.toAddress, 5)}</p>
                                </div>
                              </Td>
                              <Td>
                                <span className="font-bold" style={{ color: tx.status === "blocked" ? "#f43f5e" : "var(--text-primary)" }}>
                                  {formatUSD(tx.amountUSD)}
                                </span>
                              </Td>
                              <Td>
                                <div className="space-y-0.5">
                                  <Badge className={
                                    tx.status === "approved" ? "badge-green" :
                                    tx.status === "blocked" ? "badge-red" :
                                    tx.status === "pending" ? "badge-amber" : "badge-gray"
                                  }>{tx.status}</Badge>
                                  {tx.blockReason && <p className="text-xs line-clamp-1 mt-0.5" style={{ color: "#f87171" }}>{tx.blockReason}</p>}
                                </div>
                              </Td>
                              <Td><RiskScorePill score={tx.riskScore} showBar /></Td>
                              <Td><span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatRelativeTime(tx.timestamp)}</span></Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </CardBody>
                </Card>
              )}

              {/* ── Agents ───────────────────────────────── */}
              {activeTab === "agents" && (
                <div className="space-y-3">
                  {agents.map((agent) => {
                    const d = percentageOf(agent.spendingBudget.dailySpentUSD, agent.spendingBudget.dailyLimitUSD);
                    const m = percentageOf(agent.spendingBudget.monthlySpentUSD, agent.spendingBudget.monthlyLimitUSD);
                    return (
                      <Card key={agent.id}>
                        <CardBody>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${agent.status === "suspended" ? "icon-box-red" : "icon-box-violet"}`}>
                                <Bot className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-white">{agent.name}</p>
                                  <Badge className={agent.status === "active" ? "badge-green" : agent.status === "suspended" ? "badge-red" : "badge-amber"} dot>{agent.status}</Badge>
                                </div>
                                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{agent.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <RiskScorePill score={agent.riskScore} showBar />
                              <Button
                                variant={agent.status === "active" ? "secondary" : "primary"}
                                size="xs"
                                onClick={() => toggleAgent(agent)}
                                disabled={agent.status === "suspended"}
                              >
                                {agent.status === "active" ? <><Activity className="w-3 h-3" />Pause</> : <><Zap className="w-3 h-3" />Activate</>}
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span style={{ color: "var(--text-muted)" }}>Daily</span>
                                <span className="text-white">{formatUSD(agent.spendingBudget.dailySpentUSD)} / {formatUSD(agent.spendingBudget.dailyLimitUSD)}</span>
                              </div>
                              <ProgressBar value={d} />
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span style={{ color: "var(--text-muted)" }}>Monthly</span>
                                <span className="text-white">{formatUSD(agent.spendingBudget.monthlySpentUSD)} / {formatUSD(agent.spendingBudget.monthlyLimitUSD)}</span>
                              </div>
                              <ProgressBar value={m} />
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-wrap mt-3">
                            {agent.permissions.map((p) => (
                              <span key={p.id} className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${p.granted ? "badge-green" : "badge-gray"}`}>
                                {p.granted ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                                {p.type}
                              </span>
                            ))}
                          </div>
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Live activity + budgets */}
            <div className="space-y-4">
              {/* Live activity feed */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <SectionHeader title="Live Activity" subtitle="Real-time via SSE" />
                    <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#34d399" }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
                      Live
                    </span>
                  </div>
                </CardHeader>
                <div className="max-h-80 overflow-y-auto">
                  {transactions.length === 0 ? (
                    <div className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>No transactions yet</div>
                  ) : transactions.slice(0, 12).map((tx) => (
                    <div key={tx.id} className="flex items-start gap-3 px-4 py-3 table-row-hover transition-colors" style={{ borderBottom: "1px solid rgba(56,189,248,0.05)" }}>
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${tx.status === "approved" ? "bg-emerald-400" : tx.status === "blocked" ? "bg-rose-400" : "bg-amber-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white">{tx.agentName}</p>
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {tx.toLabel || formatAddress(tx.toAddress)} · {formatUSD(tx.amountUSD)}
                        </p>
                        {tx.blockReason && <p className="text-xs truncate" style={{ color: "#f87171" }}>{tx.blockReason}</p>}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <Badge className={tx.status === "approved" ? "badge-green" : tx.status === "blocked" ? "badge-red" : "badge-amber"}>
                          {tx.status}
                        </Badge>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{formatRelativeTime(tx.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Agent budgets */}
              <Card>
                <CardHeader><SectionHeader title="Agent Budgets" subtitle="Daily utilization" /></CardHeader>
                <CardBody className="space-y-4">
                  {agents.map((a) => {
                    const pct = percentageOf(a.spendingBudget.dailySpentUSD, a.spendingBudget.dailyLimitUSD);
                    return (
                      <div key={a.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-white">{a.name}</span>
                          <span style={{ color: pct > 80 ? "#f87171" : "var(--text-muted)" }}>
                            {formatUSD(a.spendingBudget.dailySpentUSD)} / {formatUSD(a.spendingBudget.dailyLimitUSD)}
                          </span>
                        </div>
                        <ProgressBar value={pct} />
                      </div>
                    );
                  })}
                  {agents.length === 0 && <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>No agents configured</p>}
                </CardBody>
              </Card>
            </div>
          </div>
        </div>

      {showCreateAgent && (
        <CreateAgentModal onClose={() => setShowCreateAgent(false)} onCreated={(a) => { setAgents((prev) => [a, ...prev]); }} />
      )}
    </div>
  );
}
