"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card, CardHeader, CardBody, Badge, Button,
  SimulatedDataLabel, RiskScorePill, AlertBanner, LoadingState, EmptyState,
} from "@/components/ui/index";
import { useSSE } from "@/hooks/useSSE";
import { toast } from "@/components/ui/Toast";
import { apiGet } from "@/lib/api-client";
import { History, Download, ExternalLink, ShieldX, CheckCircle2, Clock,
  RefreshCw, Search, Filter, TrendingUp, AlertTriangle } from "lucide-react";
import {
  formatUSD, formatDateTime, formatRelativeTime, formatAddress, txStatusColor,
} from "@/lib/utils";
import type { Transaction } from "@/lib/types";

type FilterStatus = "all" | "approved" | "blocked" | "pending";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const loadTransactions = useCallback(async () => {
    try {
      const res = await apiGet<{ data: Transaction[] }>("/api/transactions");
      setTransactions(res.data ?? []);
    } catch (err: unknown) {
      toast({ type: "error", title: "Failed to load transactions", message: String(err) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  useSSE("transactions-page", {
    transaction_new: (e) => {
      const tx = e.payload as Transaction;
      setTransactions((prev) => [tx, ...prev]);
      toast({ type: "info", title: "New transaction", message: `${tx.agentName} — ${formatUSD(tx.amountUSD)}` });
    },
    transaction_update: () => loadTransactions(),
  });

  // Derived stats
  const approved = transactions.filter((t) => t.status === "approved");
  const blocked  = transactions.filter((t) => t.status === "blocked");
  const pending  = transactions.filter((t) => t.status === "pending");
  const totalApproved = approved.reduce((a, t) => a + t.amountUSD, 0);
  const totalBlocked  = blocked.reduce((a, t) => a + t.amountUSD, 0);

  // Unique agent names for filter
  const agentNames = Array.from(new Set(transactions.map((t) => t.agentName)));

  // Filter + search
  const filtered = transactions.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (agentFilter !== "all" && t.agentName !== agentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.agentName.toLowerCase().includes(q) ||
        (t.toLabel ?? "").toLowerCase().includes(q) ||
        t.toAddress.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.blockReason ?? "").toLowerCase().includes(q) ||
        (t.purpose ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCSV() {
    // Uses real /api/export — pulls directly from persistent DB
    const params = new URLSearchParams({ format: "csv" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    const a = document.createElement("a");
    a.href = `/api/export?${params.toString()}`;
    a.download = `policyguard-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast({ type: "success", title: "CSV export started", message: "Downloading from real database records" });
  }

  function exportPDF() {
    // Opens HTML report in new tab — can be printed to PDF
    const params = new URLSearchParams({ format: "pdf" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    window.open(`/api/export?${params.toString()}`, "_blank");
    toast({ type: "success", title: "PDF report opened", message: "Use browser Print → Save as PDF" });
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        title="Transaction History"
        subtitle={`${transactions.length} total records`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={loadTransactions} className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <Button variant="secondary" size="sm" onClick={exportCSV}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={exportPDF}>
              <Download className="w-3.5 h-3.5" /> PDF Report
            </Button>
          </div>
        }
      />

      <div className="page-content fade-up">
        {/* Demo banner */}
        <AlertBanner variant="warning" icon={AlertTriangle}>
          <strong>Audit Trail:</strong> All records are <strong>simulated demo data</strong>. No real on-chain transactions exist until ERC-4337 contracts are deployed on Sepolia.
        </AlertBanner>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Transactions",  value: transactions.length, sub: "All time",             color: "#22d3ee",  Icon: TrendingUp },
            { label: "Approved Volume",      value: formatUSD(totalApproved), sub: `${approved.length} txs`, color: "#10b981", Icon: CheckCircle2 },
            { label: "Blocked Volume",       value: formatUSD(totalBlocked),  sub: `${blocked.length} blocked`, color: "#f43f5e", Icon: ShieldX },
            { label: "Pending",              value: pending.length,           sub: "Awaiting approval",  color: "#f59e0b",  Icon: Clock },
          ].map(({ label, value, sub, color, Icon }) => (
            <div key={label} className="kpi-card p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="section-label">{label}</p>
                <div className="icon-box w-8 h-8" style={{ background: `${color}20` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
              </div>
              <p className="text-xl font-bold leading-none" style={{ color }}>{value}</p>
              <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* Filters row */}
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search by agent, recipient, ID, reason…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="input-dark pl-9 py-2 text-xs w-full"
                />
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                {(["all","approved","blocked","pending"] as FilterStatus[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setStatusFilter(f); setPage(1); }}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all"
                    style={{
                      background: statusFilter === f ? "rgba(34,211,238,0.12)" : "transparent",
                      color: statusFilter === f ? "#22d3ee" : "var(--text-muted)",
                      border: statusFilter === f ? "1px solid rgba(34,211,238,0.25)" : "1px solid transparent",
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Agent filter */}
              {agentNames.length > 1 && (
                <select
                  value={agentFilter}
                  onChange={(e) => { setAgentFilter(e.target.value); setPage(1); }}
                  className="input-dark py-2 text-xs"
                  style={{ width: 160 }}
                >
                  <option value="all">All agents</option>
                  {agentNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              )}

              <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
                {filtered.length} results
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Main table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" style={{ color: "var(--cyan)" }} />
                <h3 className="text-sm font-semibold text-white">All Transactions</h3>
              </div>
              <SimulatedDataLabel />
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {isLoading ? <LoadingState /> : filtered.length === 0 ? (
              <EmptyState icon={History} title="No transactions" description="No transactions match your current filters." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(56,189,248,0.08)" }}>
                        {["TX ID","Agent","Recipient","Amount","Status","Policy","Risk","Network","Time","Hash"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((tx) => (
                        <tr key={tx.id} className="table-row-hover" style={{ borderBottom: "1px solid rgba(56,189,248,0.05)" }}>
                          <td className="px-4 py-3">
                            <code className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{tx.id.slice(0,14)}…</code>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-xs font-semibold text-white">{tx.agentName}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white font-medium text-xs">{(tx as Transaction & {toLabel?:string}).toLabel ?? "—"}</p>
                            <code className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{formatAddress(tx.toAddress)}</code>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`font-bold text-sm ${tx.status === "blocked" ? "text-rose-400" : "text-white"}`}>
                              {formatUSD(tx.amountUSD)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={txStatusColor(tx.status)}>{tx.status}</Badge>
                            {tx.blockReason && (
                              <p className="text-xs text-rose-400 mt-0.5 max-w-[160px] truncate">{tx.blockReason}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{tx.policyName ?? "—"}</p>
                          </td>
                          <td className="px-4 py-3"><RiskScorePill score={tx.riskScore} showBar /></td>
                          <td className="px-4 py-3">
                            <Badge className={tx.network === "simulated" ? "badge-gray" : "badge-cyan"}>{tx.network}</Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatRelativeTime(tx.timestamp)}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)", fontSize: 10 }}>{formatDateTime(tx.timestamp)}</p>
                          </td>
                          <td className="px-4 py-3">
                            {tx.hash ? (
                              <a href={`https://sepolia.etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs" style={{ color: "#22d3ee" }}>
                                {formatAddress(tx.hash, 4)} <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>— (sim)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid rgba(56,189,248,0.07)" }}>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Page {page} of {totalPages} · {filtered.length} records
                    </span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</Button>
                      <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        {/* Blocked breakdown */}
        {blocked.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldX className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-white">Policy Enforcement Log — Blocked Transactions</h3>
                <Badge className="badge-red">{blocked.length}</Badge>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {blocked.map((tx, i) => (
                <div key={tx.id} className="px-5 py-3" style={{ borderBottom: i < blocked.length - 1 ? "1px solid rgba(56,189,248,0.06)" : "none" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <ShieldX className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                        <span className="text-xs font-semibold text-white">{tx.agentName}</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>→</span>
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{(tx as Transaction & {toLabel?:string}).toLabel ?? formatAddress(tx.toAddress)}</span>
                      </div>
                      <p className="text-xs text-rose-400 mt-1">{tx.blockReason}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {tx.riskFlags.map((f, idx) => (
                          <span key={idx} className="text-xs px-1.5 py-0.5 rounded badge-red">{f}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-rose-400">{formatUSD(tx.amountUSD)}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{formatRelativeTime(tx.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
