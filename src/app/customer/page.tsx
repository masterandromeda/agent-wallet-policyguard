"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSSE } from "@/hooks/useSSE";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "@/components/ui/Toast";
import {
  Card, CardHeader, CardBody, Badge, Button, StatCard,
  TabBar, AlertBanner, LoadingState, EmptyState,
  ProgressBar, SimulatedDataLabel,
} from "@/components/ui/index";
import { TopBar } from "@/components/layout/TopBar";
import {
  ShoppingCart, CheckCircle2, Clock, XCircle, RefreshCw,
  Send, AlertTriangle, DollarSign, FileText, Download,
  Search, Filter, ChevronDown, Bot, TrendingUp, Shield,
  Info, FileJson, Printer, Eye, EyeOff, ChevronRight,
} from "lucide-react";
import {
  formatUSD, formatUSDPrecise, formatDateTime, formatRelativeTime,
  txStatusColor, agentStatusColor, percentageOf,
} from "@/lib/utils";
import type { Transaction, Agent, ApprovalRequest, AgentTask } from "@/lib/types";

// ─── Constants ─────────────────────────────────────────────────────────────────
const CUSTOMER = { id: "cust_01", name: "Marcus Rivera", email: "marcus@enterprise.io", role: "Finance Manager" };

const MERCHANT_PRESETS = [
  { label: "API Credits (OpenAI)",   address: "0xApiProvider0000000000000000000001", defaultAmt: 50 },
  { label: "Cloud Services (AWS)",   address: "0xCloudProvider000000000000000000001", defaultAmt: 120 },
  { label: "SaaS License",           address: "0xSaaS0000000000000000000000000000001", defaultAmt: 99 },
  { label: "Conference Tickets",     address: "0xTicketing000000000000000000000001", defaultAmt: 299 },
  { label: "Office Supplies",        address: "0xSupplier000000000000000000000001", defaultAmt: 75 },
];

type TabKey = "overview" | "submit" | "history" | "agents";
type FilterStatus = "all" | "approved" | "pending" | "blocked" | "failed";
const PAGE_SIZE = 10;

// ─── Detail Drawer ─────────────────────────────────────────────────────────────
interface TxDrawerProps {
  tx: Transaction | null;
  onClose: () => void;
}
function TxDrawer({ tx, onClose }: TxDrawerProps) {
  if (!tx) return null;
  const statusStyle = {
    approved: { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)", text: "#34d399" },
    blocked:  { bg: "rgba(244,63,94,0.08)",  border: "rgba(244,63,94,0.25)",  text: "#f87171" },
    pending:  { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", text: "#fbbf24" },
    failed:   { bg: "rgba(100,116,139,0.08)",border: "rgba(100,116,139,0.25)",text: "#94a3b8" },
  }[tx.status] ?? { bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.25)", text: "#94a3b8" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(2,8,24,0.85)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: "#080f1e", border: "1px solid rgba(56,189,248,0.15)", boxShadow: "0 0 60px rgba(34,211,238,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(56,189,248,0.08)" }}>
          <div>
            <p className="text-sm font-bold text-white">{tx.toLabel ?? tx.toAddress.slice(0, 20) + "…"}</p>
            <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>{tx.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Amount + status */}
          <div className="flex items-center justify-between">
            <p className="text-3xl font-bold text-white tabular-nums">{formatUSDPrecise(tx.amountUSD)}</p>
            <div className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: statusStyle.bg, border: `1px solid ${statusStyle.border}`, color: statusStyle.text }}>
              {tx.status.toUpperCase()}
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Agent",     value: tx.agentName },
              { label: "Network",   value: tx.network },
              { label: "Time",      value: formatDateTime(tx.timestamp) },
              { label: "Risk Score",value: String(tx.riskScore) },
              { label: "Simulated", value: tx.isSimulated ? "Yes — demo mode" : "No" },
              ...(tx.blockReason ? [{ label: "Block Reason", value: tx.blockReason }] : []),
              ...(tx.purpose ? [{ label: "Purpose", value: tx.purpose }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-xs text-white break-words">{value}</p>
              </div>
            ))}
          </div>

          {/* Policy flags */}
          {tx.riskFlags.length > 0 && (
            <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
              <p className="text-xs font-semibold text-amber-400 mb-1.5">Policy flags</p>
              <div className="space-y-1">
                {tx.riskFlags.map((f, i) => (
                  <p key={i} className="text-xs text-amber-300">· {f}</p>
                ))}
              </div>
            </div>
          )}

          {tx.status === "pending" && (
            <AlertBanner variant="warning" icon={Clock}>
              This request is awaiting owner approval. You will be notified when a decision is made.
            </AlertBanner>
          )}
          {tx.isSimulated && (
            <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
              ⚠ Simulated transaction — no real funds moved
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Live Task Progress Tracker ─────────────────────────────────────────────
function TaskProgressTracker({ task }: { task: AgentTask }) {
  const statusColors = {
    queued:            { bg: "rgba(56,189,248,0.06)",  border: "rgba(56,189,248,0.15)",  text: "#22d3ee" },
    parsing:           { bg: "rgba(56,189,248,0.06)",  border: "rgba(56,189,248,0.15)",  text: "#22d3ee" },
    policy_check:      { bg: "rgba(245,158,11,0.06)",  border: "rgba(245,158,11,0.18)",  text: "#fbbf24" },
    awaiting_approval: { bg: "rgba(245,158,11,0.06)",  border: "rgba(245,158,11,0.18)",  text: "#fbbf24" },
    executing:         { bg: "rgba(56,189,248,0.06)",  border: "rgba(56,189,248,0.15)",  text: "#22d3ee" },
    completed:         { bg: "rgba(16,185,129,0.06)",  border: "rgba(16,185,129,0.22)",  text: "#34d399" },
    blocked:           { bg: "rgba(244,63,94,0.06)",   border: "rgba(244,63,94,0.22)",   text: "#f87171" },
    rejected:          { bg: "rgba(244,63,94,0.06)",   border: "rgba(244,63,94,0.22)",   text: "#f87171" },
    failed:            { bg: "rgba(100,116,139,0.06)", border: "rgba(100,116,139,0.22)", text: "#94a3b8" },
  }[task.status] ?? { bg: "rgba(56,189,248,0.06)", border: "rgba(56,189,248,0.15)", text: "#22d3ee" };

  const iconMap: Partial<Record<string, React.ReactElement>> = {
    completed:         <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    blocked:           <XCircle className="w-4 h-4 text-rose-400" />,
    rejected:          <XCircle className="w-4 h-4 text-rose-400" />,
    awaiting_approval: <Clock className="w-4 h-4 text-amber-400" />,
  };
  const statusIcon = iconMap[task.status] ?? <Bot className="w-4 h-4 text-[#22d3ee]" />;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${statusColors.border}`, background: statusColors.bg }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${statusColors.border}` }}>
        {statusIcon}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold" style={{ color: statusColors.text }}>
            {task.status === "completed"         ? "✓ Payment Executed Successfully" :
             task.status === "blocked"           ? "✗ Blocked by Policy Engine" :
             task.status === "rejected"          ? "✗ Rejected by Owner" :
             task.status === "awaiting_approval" ? "⏳ Awaiting Owner Approval" :
             task.status === "failed"            ? "⚠ Task Failed" :
             "Processing…"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Task {task.id} · Agent: {task.agentName}
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: `${statusColors.text}15`, color: statusColors.text }}>
          {task.status.replace("_", " ")}
        </span>
      </div>

      {/* Execution Steps */}
      <div className="divide-y" style={{ borderColor: `${statusColors.border}` }}>
        {task.steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-2.5">
            <div className="flex-shrink-0 mt-0.5">
              {step.status === "done"    && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              {step.status === "error"   && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
              {step.status === "running" && <Bot className="w-3.5 h-3.5 text-[#22d3ee]" />}
              {step.status === "pending" && <Clock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium" style={{
                color: step.status === "done" ? "#34d399" : step.status === "error" ? "#f87171" : step.status === "running" ? "#22d3ee" : "var(--text-muted)"
              }}>{step.label}</p>
              {step.detail && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{step.detail}</p>}
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)", opacity: 0.5, fontSize: 10 }}>
              {new Date(step.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>

      {/* Policy checks */}
      {task.policyChecks && task.policyChecks.length > 0 && (
        <div className="px-4 py-3" style={{ borderTop: `1px solid ${statusColors.border}` }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Policy Checks</p>
          <div className="space-y-1">
            {task.policyChecks.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                {c.passed
                  ? <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                  : <XCircle className="w-3 h-3 text-rose-400 flex-shrink-0 mt-0.5" />}
                <span className={c.passed ? "text-emerald-400" : "text-rose-400"}>{c.rule}</span>
                <span className="ml-auto flex-shrink-0" style={{ color: "var(--text-muted)" }}>{c.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Block reason */}
      {task.blockReason && (
        <div className="px-4 py-3 border-t border-rose-900/30">
          <p className="text-xs font-semibold text-rose-400 mb-1">Block Reason</p>
          <p className="text-xs text-rose-300">{task.blockReason}</p>
        </div>
      )}

      {/* Result */}
      {task.result && (
        <div className="px-4 py-2.5" style={{ borderTop: `1px solid ${statusColors.border}` }}>
          <p className="text-xs" style={{ color: statusColors.text }}>{task.result}</p>
          {task.isSimulated && (
            <p className="text-xs mt-1 opacity-60" style={{ color: "var(--text-muted)" }}>
              ⚠ Simulated — no real funds transferred
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Submit Form ───────────────────────────────────────────────────────────────
interface SubmitFormProps {
  agents: Agent[];
  onSuccess: (task: AgentTask) => void;
}
function SubmitForm({ agents, onSuccess }: SubmitFormProps) {
  const [form, setForm] = useState({ agentId: "", merchant: "", merchantAddress: "", amount: "", purpose: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastTask, setLastTask] = useState<AgentTask | null>(null);

  const activeAgents = agents.filter((a) => a.status === "active");

  // Auto-select first active agent
  useEffect(() => {
    if (!form.agentId && activeAgents.length > 0) {
      setForm((f) => ({ ...f, agentId: activeAgents[0].id }));
    }
  }, [activeAgents]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAgent = agents.find((a) => a.id === form.agentId);

  function selectPreset(preset: typeof MERCHANT_PRESETS[0]) {
    setForm((f) => ({ ...f, merchant: preset.label, merchantAddress: preset.address, amount: String(preset.defaultAmt) }));
    setFormError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLastTask(null);
    const amount = parseFloat(form.amount);
    if (!form.agentId)              { setFormError("Select an AI agent to process this request"); return; }
    if (!form.merchant.trim())      { setFormError("Merchant / recipient name is required"); return; }
    if (isNaN(amount) || amount <= 0) { setFormError("Enter a valid positive amount"); return; }
    if (!form.purpose.trim())       { setFormError("Describe the purchase purpose"); return; }

    setSubmitting(true);
    try {
      // Use /api/tasks for full end-to-end workflow tracking
      const res = await apiPost<{ data: AgentTask }>("/api/tasks", {
        agentId: form.agentId,
        requesterId: CUSTOMER.id,
        requesterName: CUSTOMER.name,
        merchant: form.merchant,
        merchantAddress: form.merchantAddress || `0x${form.merchant.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20).padEnd(40, "0")}`,
        amountUSD: amount,
        purpose: form.purpose,
      });

      const task = res.data;
      setLastTask(task);
      onSuccess(task);

      const msgs: Record<string, string> = {
        completed:         "Payment executed — all policy checks passed",
        awaiting_approval: "Escalated — awaiting owner approval",
        blocked:           "Blocked by policy engine — see violation details",
        failed:            "Task failed — see error details",
      };
      toast({
        type: task.status === "completed" ? "success" : task.status === "blocked" || task.status === "rejected" ? "error" : "warning",
        title: `Task ${task.status.replace("_", " ")}`,
        message: msgs[task.status] ?? task.result ?? task.status,
      });

      // Reset form but keep agent selection
      setForm((f) => ({ agentId: f.agentId, merchant: "", merchantAddress: "", amount: "", purpose: "" }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(7,16,32,0.9)",
    border: "1px solid rgba(56,189,248,0.15)",
    borderRadius: "10px",
    color: "var(--text-primary)",
    fontSize: "13px",
    padding: "9px 12px",
    width: "100%",
    outline: "none",
    caretColor: "#22d3ee",
  };

  return (
    <div className="space-y-5">
      {/* Live task result tracker */}
      {lastTask && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Agent Execution Result</span>
            <button onClick={() => setLastTask(null)} style={{ color: "var(--text-muted)" }}>
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
          <TaskProgressTracker task={lastTask} />
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {/* Agent selector */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
            AI Agent <span className="text-rose-400">*</span>
          </label>
          <select value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} style={inputStyle} required>
            <option value="">Select an agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id} disabled={a.status !== "active"}>
                {a.name}{a.status !== "active" ? ` (${a.status})` : ""} — limit {formatUSD(a.spendingBudget.perTxLimitUSD)}/tx
              </option>
            ))}
          </select>
          {selectedAgent && (
            <div className="mt-1.5 flex items-center gap-3">
              <ProgressBar
                value={percentageOf(selectedAgent.spendingBudget.dailySpentUSD, selectedAgent.spendingBudget.dailyLimitUSD)}
                variant={percentageOf(selectedAgent.spendingBudget.dailySpentUSD, selectedAgent.spendingBudget.dailyLimitUSD) >= 85 ? "danger" : "default"}
                className="flex-1"
              />
              <span className="text-xs tabular-nums flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                {formatUSD(selectedAgent.spendingBudget.dailySpentUSD)} / {formatUSD(selectedAgent.spendingBudget.dailyLimitUSD)} daily
              </span>
            </div>
          )}
        </div>

        {/* Merchant presets */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Quick Select</label>
          <div className="flex flex-wrap gap-1.5">
            {MERCHANT_PRESETS.map((p) => {
              const active = form.merchant === p.label;
              return (
                <button
                  key={p.label} type="button" onClick={() => selectPreset(p)}
                  className="text-xs px-2.5 py-1 rounded-lg transition-all"
                  style={{
                    background: active ? "rgba(34,211,238,0.12)" : "rgba(7,16,32,0.6)",
                    border: `1px solid ${active ? "rgba(34,211,238,0.35)" : "rgba(56,189,248,0.12)"}`,
                    color: active ? "#22d3ee" : "var(--text-muted)",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Merchant name */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Merchant / Recipient <span className="text-rose-400">*</span>
          </label>
          <input
            value={form.merchant}
            onChange={(e) => setForm({ ...form, merchant: e.target.value })}
            style={inputStyle}
            placeholder="e.g. OpenAI, Stripe, AWS…"
            required
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Amount (USD) <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            <input
              type="number" min="0.01" step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              style={{ ...inputStyle, paddingLeft: 32 }}
              placeholder="0.00"
              required
            />
          </div>
          {selectedAgent && form.amount && !isNaN(parseFloat(form.amount)) && parseFloat(form.amount) > selectedAgent.spendingBudget.perTxLimitUSD && (
            <p className="text-xs mt-1 text-amber-400">
              ⚠ Exceeds per-tx limit of {formatUSD(selectedAgent.spendingBudget.perTxLimitUSD)} — will require owner approval
            </p>
          )}
        </div>

        {/* Purpose */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Purchase Purpose <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            style={{ ...inputStyle, resize: "none", minHeight: 76 }}
            placeholder="Describe what this payment is for…"
            rows={3}
            required
          />
        </div>

        {formError && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs text-rose-400"
            style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.20)" }}>
            <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {formError}
          </div>
        )}

        <Button type="submit" variant="primary" className="w-full" size="md" loading={submitting} disabled={activeAgents.length === 0}>
          <Send className="w-3.5 h-3.5" />
          {submitting ? "Processing…" : "Submit Payment Request"}
        </Button>

        {activeAgents.length === 0 && (
          <p className="text-xs text-center text-rose-400">No active agents available. Contact your administrator.</p>
        )}
      </form>

      {/* How it works */}
      <div className="pt-2" style={{ borderTop: "1px solid rgba(56,189,248,0.08)" }}>
        <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>How it works</p>
        <div className="space-y-2.5">
          {[
            { n: "1", title: "Submit request", desc: "Enter merchant, amount, and purpose" },
            { n: "2", title: "Policy engine checks", desc: "Server enforces limits, allowlists & time rules" },
            { n: "3", title: "Auto-approve or escalate", desc: "Small in-policy requests approve instantly" },
            { n: "4", title: "Owner reviews (if needed)", desc: "Out-of-policy requests escalate for human review" },
          ].map(({ n, title, desc }) => (
            <div key={n} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: "rgba(34,211,238,0.10)", color: "#22d3ee" }}>
                {n}
              </span>
              <div>
                <p className="text-xs font-semibold text-white">{title}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── History Table ─────────────────────────────────────────────────────────────
interface HistoryTableProps {
  requests: Transaction[];
  loading: boolean;
  onViewDetail: (tx: Transaction) => void;
}
function HistoryTable({ requests, loading, onViewDetail }: HistoryTableProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = requests.filter((r) => {
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || r.toLabel?.toLowerCase().includes(q) || r.purpose?.toLowerCase().includes(q) || String(r.amountUSD).includes(q);
    return matchStatus && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filterStatus]);

  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = ["ID", "Merchant", "Amount (USD)", "Purpose", "Status", "Policy Flags", "Agent", "Timestamp"];
    const rows = filtered.map((r) => [
      r.id, r.toLabel ?? r.toAddress, r.amountUSD.toFixed(2),
      (r.purpose ?? "").replace(/,/g, ";"), r.status,
      r.riskFlags.join("|"), r.agentName, r.timestamp,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `policyguard-my-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ type: "success", title: "CSV exported" });
  }

  function exportJSON() {
    if (filtered.length === 0) return;
    const report = {
      reportType: "Customer Payment History",
      generatedAt: new Date().toISOString(),
      customer: CUSTOMER,
      filters: { status: filterStatus, search },
      summary: {
        total: filtered.length,
        approved: filtered.filter((r) => r.status === "approved").length,
        blocked:  filtered.filter((r) => r.status === "blocked").length,
        pending:  filtered.filter((r) => r.status === "pending").length,
        totalSpentUSD: filtered.filter((r) => r.status === "approved").reduce((s, r) => s + r.amountUSD, 0),
      },
      transactions: filtered,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `policyguard-my-requests-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast({ type: "success", title: "JSON report exported" });
  }

  function exportPDF() {
    const approved = filtered.filter((r) => r.status === "approved");
    const totalSpent = approved.reduce((s, r) => s + r.amountUSD, 0);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Payment History — ${CUSTOMER.name}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#1a1a2e;padding:40px;font-size:13px}
      h1{font-size:22px;margin-bottom:4px;color:#0f172a}
      .meta{color:#64748b;font-size:12px;margin-bottom:24px}
      .kpi{display:flex;gap:24px;margin-bottom:28px}
      .kpi-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;flex:1}
      .kpi-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
      .kpi-value{font-size:22px;font-weight:700;margin-top:4px}
      table{width:100%;border-collapse:collapse}
      th{background:#f1f5f9;padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #e2e8f0}
      td{padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px}
      tr:hover td{background:#fafafe}
      .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
      .approved{background:#d1fae5;color:#065f46}
      .blocked{background:#fee2e2;color:#991b1b}
      .pending{background:#fef3c7;color:#92400e}
      .failed{background:#f1f5f9;color:#475569}
      .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
      @media print{body{padding:20px}h1{font-size:18px}}
    </style></head><body>
    <h1>Payment History Report</h1>
    <div class="meta">${CUSTOMER.name} · ${CUSTOMER.email} · Generated ${new Date().toLocaleString()}</div>
    <div class="kpi">
      <div class="kpi-box"><div class="kpi-label">Total Requests</div><div class="kpi-value">${filtered.length}</div></div>
      <div class="kpi-box"><div class="kpi-label">Approved</div><div class="kpi-value" style="color:#065f46">${approved.length}</div></div>
      <div class="kpi-box"><div class="kpi-label">Total Spent</div><div class="kpi-value" style="color:#0f766e">$${totalSpent.toFixed(2)}</div></div>
      <div class="kpi-box"><div class="kpi-label">Blocked</div><div class="kpi-value" style="color:#991b1b">${filtered.filter((r) => r.status === "blocked").length}</div></div>
    </div>
    <table><thead><tr><th>Merchant</th><th>Amount</th><th>Purpose</th><th>Status</th><th>Policy Flags</th><th>Time</th></tr></thead><tbody>
    ${filtered.map((r) => `<tr>
      <td><strong>${r.toLabel ?? r.toAddress.slice(0, 20)}</strong><br><span style="color:#94a3b8;font-size:11px">${r.agentName}</span></td>
      <td><strong>$${r.amountUSD.toFixed(2)}</strong></td>
      <td style="max-width:200px">${r.purpose ?? "—"}</td>
      <td><span class="badge ${r.status}">${r.status.toUpperCase()}</span>${r.blockReason ? `<br><span style="font-size:10px;color:#dc2626">${r.blockReason.slice(0, 60)}</span>` : ""}</td>
      <td>${r.riskFlags.length > 0 ? r.riskFlags.join(", ") : "✓ Passed"}</td>
      <td style="white-space:nowrap">${new Date(r.timestamp).toLocaleString()}</td>
    </tr>`).join("")}
    </tbody></table>
    <div class="footer">PolicyGuard — Agent Wallet · ERC-4337 Policy Enforcement · All policy decisions enforced server-side</div>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  const statusColors: Record<string, string> = {
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    blocked:  "bg-rose-500/10 text-rose-400 border-rose-500/20",
    pending:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
    failed:   "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchant, purpose…"
            className="w-full rounded-lg pl-9 pr-3 py-2 text-xs outline-none"
            style={{ background: "rgba(7,16,32,0.8)", border: "1px solid rgba(56,189,248,0.12)", color: "var(--text-primary)" }}
          />
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={{
            background: showFilters ? "rgba(34,211,238,0.10)" : "rgba(7,16,32,0.6)",
            border: "1px solid rgba(56,189,248,0.12)",
            color: showFilters ? "#22d3ee" : "var(--text-muted)",
          }}
        >
          <Filter className="w-3 h-3" />
          Filters
          <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>

        <div className="flex gap-1 ml-auto">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs"
            style={{ background: "rgba(7,16,32,0.6)", border: "1px solid rgba(56,189,248,0.12)", color: "var(--text-muted)" }}>
            <Download className="w-3 h-3" /> CSV
          </button>
          <button onClick={exportJSON} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs"
            style={{ background: "rgba(7,16,32,0.6)", border: "1px solid rgba(56,189,248,0.12)", color: "var(--text-muted)" }}>
            <FileJson className="w-3 h-3" /> JSON
          </button>
          <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs"
            style={{ background: "rgba(7,16,32,0.6)", border: "1px solid rgba(56,189,248,0.12)", color: "var(--text-muted)" }}>
            <Printer className="w-3 h-3" /> PDF
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 px-4 py-3 rounded-xl" style={{ background: "rgba(7,16,32,0.6)", border: "1px solid rgba(56,189,248,0.08)" }}>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Status</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="rounded-lg px-2 py-1 text-xs outline-none"
              style={{ background: "rgba(7,16,32,0.9)", border: "1px solid rgba(56,189,248,0.15)", color: "var(--text-primary)" }}
            >
              <option value="all">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="blocked">Blocked</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setFilterStatus("all"); setSearch(""); }}
              className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-muted)" }}>
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          {(search || filterStatus !== "all") && " (filtered)"}
        </span>
        <SimulatedDataLabel />
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState message="Loading your requests…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={search || filterStatus !== "all" ? "No matching requests" : "No requests yet"}
          description={search || filterStatus !== "all" ? "Try adjusting your filters" : "Submit your first payment request above"}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(56,189,248,0.08)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "rgba(7,16,32,0.8)", borderBottom: "1px solid rgba(56,189,248,0.08)" }}>
                  {["Merchant", "Amount", "Purpose", "Status", "Policy", "Time", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.map((tx, i) => (
                  <tr
                    key={tx.id}
                    className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: i < pageData.length - 1 ? "1px solid rgba(56,189,248,0.05)" : undefined }}
                    onClick={() => onViewDetail(tx)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white truncate max-w-[130px]">{tx.toLabel ?? tx.toAddress.slice(0, 16) + "…"}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{tx.agentName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold tabular-nums ${tx.status === "blocked" ? "text-rose-400" : "text-white"}`}>
                        {formatUSD(tx.amountUSD)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="truncate block max-w-[140px]" style={{ color: "var(--text-secondary)" }}>
                        {tx.purpose ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[tx.status] ?? ""}`}>
                          {tx.status}
                        </span>
                        {tx.status === "pending" && (
                          <p className="text-xs text-amber-400 mt-0.5">Awaiting owner</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {tx.riskFlags.length > 0 ? (
                        <p className="text-amber-400 truncate max-w-[140px]">{tx.riskFlags[0]}{tx.riskFlags.length > 1 ? ` +${tx.riskFlags.length - 1}` : ""}</p>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Passed</span>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                      {formatRelativeTime(tx.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</Button>
                <Button variant="ghost" size="xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function CustomerPage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [myRequests, setMyRequests] = useState<Transaction[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const mountedRef = useRef(true);

  const loadData = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const [txRes, agentRes, approvalRes] = await Promise.allSettled([
        apiGet<{ data: Transaction[] }>(`/api/transactions?role=customer&requesterId=${CUSTOMER.id}`),
        apiGet<{ data: Agent[] }>("/api/agents"),
        apiGet<{ data: ApprovalRequest[] }>(`/api/approvals?requesterId=${CUSTOMER.id}`),
      ]);
      if (txRes.status === "fulfilled") {
        setMyRequests(txRes.value.data.filter((t) => t.requesterId === CUSTOMER.id));
      }
      if (agentRes.status === "fulfilled") {
        setAgents(agentRes.value.data);
      }
      if (approvalRes.status === "fulfilled") {
        setPendingApprovals(approvalRes.value.data.filter((a) => a.status === "pending"));
      }
    } catch (err: unknown) {
      toast({ type: "error", title: "Failed to load data", message: String(err) });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, [loadData]);

  useSSE("customer", {
    init: () => setSseConnected(true),
    transaction_new: (e) => {
      const tx = e.payload as Transaction;
      if (tx.requesterId === CUSTOMER.id) {
        setMyRequests((prev) => [tx, ...prev.filter((r) => r.id !== tx.id)]);
      }
    },
    transaction_update: () => { loadData(); },
    approval_update: () => { loadData(); },
    stats_update: () => { loadData(); },
  });

  function handleNewTask(task: AgentTask) {
    // After a task is created, refresh transaction list to show the linked transaction
    loadData();
    // Switch to history tab to show the result
    setTab("history");
  }

  // ── Derived stats ──────────────────────────────────────────────
  const approved   = myRequests.filter((r) => r.status === "approved");
  const pending    = myRequests.filter((r) => r.status === "pending");
  const blocked    = myRequests.filter((r) => r.status === "blocked");
  const totalSpent = approved.reduce((s, t) => s + t.amountUSD, 0);
  const activeAgents = agents.filter((a) => a.status === "active");

  const tabs = [
    { key: "overview" as TabKey, label: "Overview" },
    { key: "submit"   as TabKey, label: "Submit Request" },
    { key: "history"  as TabKey, label: "My Requests", count: pending.length },
    { key: "agents"   as TabKey, label: "My Agents" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Customer Portal"
        title={CUSTOMER.name}
        subtitle={`${CUSTOMER.role} · ${CUSTOMER.email}`}
        actions={
          <div className="flex items-center gap-2">
            {/* SSE status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sseConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full bg-current ${sseConnected ? "animate-pulse" : ""}`} />
              {sseConnected ? "Live" : "Demo"}
            </div>
            <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      <div className="page-content space-y-5 fade-up">

        {/* Demo notice */}
        <AlertBanner variant="warning" icon={AlertTriangle}>
          <strong>Demo Mode — Simulated Transactions:</strong> Requests are enforced by the server-side policy engine. No real payments are executed or blockchain transactions created.
        </AlertBanner>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Requests" value={myRequests.length} icon={FileText}   accent="cyan"  subtext="All time" />
          <StatCard label="Approved"        value={approved.length}   icon={CheckCircle2} accent="green" subtext="Policy passed" />
          <StatCard label="Pending Review"  value={pending.length}    icon={Clock}      accent="amber" subtext="Awaiting owner" />
          <StatCard label="Total Spent"     value={formatUSD(totalSpent)} icon={DollarSign} accent="teal" subtext="Approved payments" />
        </div>

        {/* Pending approval alert */}
        {pending.length > 0 && (
          <div
            className="flex items-center gap-4 px-5 py-4 rounded-xl"
            style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.22)" }}
          >
            <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300">{pending.length} request{pending.length !== 1 ? "s" : ""} awaiting owner approval</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>You will be notified when the owner responds.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setTab("history")}>View</Button>
          </div>
        )}

        {/* Tab bar */}
        <TabBar tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="space-y-5">
            {/* Recent requests */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#22d3ee]" />
                    Recent Requests
                  </h2>
                  <Button variant="ghost" size="xs" onClick={() => setTab("history")}>
                    View all <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {loading ? (
                  <div className="p-5"><LoadingState message="Loading requests…" /></div>
                ) : myRequests.length === 0 ? (
                  <div className="p-5">
                    <EmptyState icon={ShoppingCart} title="No requests yet" description="Submit your first payment request" action={
                      <Button variant="primary" size="sm" onClick={() => setTab("submit")}>
                        <Send className="w-3.5 h-3.5" /> Submit Request
                      </Button>
                    } />
                  </div>
                ) : (
                  <div>
                    {myRequests.slice(0, 5).map((tx, i) => (
                      <div
                        key={tx.id}
                        className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: i < Math.min(myRequests.length, 5) - 1 ? "1px solid rgba(56,189,248,0.05)" : undefined }}
                        onClick={() => setDetailTx(tx)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{tx.toLabel ?? tx.toAddress.slice(0, 16) + "…"}</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{tx.purpose ?? "—"}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={`font-bold text-xs tabular-nums ${tx.status === "blocked" ? "text-rose-400" : "text-white"}`}>
                            {formatUSD(tx.amountUSD)}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${txStatusColor(tx.status)}`}>
                            {tx.status}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatRelativeTime(tx.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Agent summary */}
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[#22d3ee]" />
                  Assigned AI Agents
                </h2>
              </CardHeader>
              <CardBody className="space-y-3">
                {loading ? <LoadingState message="Loading agents…" /> : agents.length === 0 ? (
                  <EmptyState icon={Bot} title="No agents assigned" description="Contact your administrator to assign an agent" />
                ) : (
                  agents.slice(0, 3).map((a) => {
                    const dailyPct = percentageOf(a.spendingBudget.dailySpentUSD, a.spendingBudget.dailyLimitUSD);
                    return (
                      <div key={a.id} className="flex items-start gap-4 px-4 py-3 rounded-xl"
                        style={{ background: "rgba(7,16,32,0.6)", border: "1px solid rgba(56,189,248,0.08)" }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <p className="text-xs font-semibold text-white">{a.name}</p>
                            <Badge className={agentStatusColor(a.status)} dot>{a.status}</Badge>
                          </div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Daily budget</span>
                            <span className="text-xs tabular-nums text-white">{formatUSD(a.spendingBudget.dailySpentUSD)} / {formatUSD(a.spendingBudget.dailyLimitUSD)}</span>
                          </div>
                          <ProgressBar value={dailyPct} variant={dailyPct >= 90 ? "danger" : dailyPct >= 75 ? "warn" : "default"} />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardBody>
            </Card>

            {/* Policy status */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
              <div>
                <p className="text-xs font-semibold text-blue-400">Policy enforcement active</p>
                <p className="text-xs mt-0.5 text-blue-400 leading-relaxed">
                  All requests are validated server-side against spending limits, approved recipients, and time windows before processing.
                  AI risk scores are advisory — the policy engine is the authority.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Submit ── */}
        {tab === "submit" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-[#22d3ee]" />
                  New Payment Request
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Requests are processed by the policy engine in real time.
                </p>
              </CardHeader>
              <CardBody>
                {loading ? (
                  <LoadingState message="Loading agents…" />
                ) : activeAgents.length === 0 ? (
                  <AlertBanner variant="error" icon={AlertTriangle}>
                    No active agents available. Contact your administrator to activate an agent.
                  </AlertBanner>
                ) : (
                  <SubmitForm agents={agents} onSuccess={handleNewTask} />
                )}
              </CardBody>
            </Card>

            {/* Policy rules summary */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#22d3ee]" />
                    Policy Engine Rules
                  </h2>
                </CardHeader>
                <CardBody className="space-y-2.5">
                  {[
                    { label: "Per-transaction limit",     desc: "Max amount per single payment" },
                    { label: "Daily spending limit",      desc: "Total allowed per calendar day" },
                    { label: "Monthly spending limit",    desc: "Cumulative cap per month" },
                    { label: "Approved recipients",       desc: "Only allowlisted addresses allowed" },
                    { label: "Contract allowlist",        desc: "Smart contracts must be pre-approved" },
                    { label: "Time window",               desc: "Payments only within business hours" },
                    { label: "Require approval",          desc: "Large amounts escalate to owner review" },
                    { label: "Permission expiry",         desc: "Agent permissions expire automatically" },
                    { label: "Agent status",              desc: "Suspended agents are blocked" },
                  ].map(({ label, desc }) => (
                    <div key={label} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(7,16,32,0.6)", border: "1px solid rgba(56,189,248,0.08)" }}>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-white">{label}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</p>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {/* ── History ── */}
        {tab === "history" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#22d3ee]" />
                  My Payment Requests
                  {myRequests.length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(34,211,238,0.10)", color: "#22d3ee" }}>
                      {myRequests.length}
                    </span>
                  )}
                </h2>
                <Info className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              </div>
            </CardHeader>
            <CardBody>
              <HistoryTable requests={myRequests} loading={loading} onViewDetail={setDetailTx} />
            </CardBody>
          </Card>
        )}

        {/* ── Agents ── */}
        {tab === "agents" && (
          <div className="space-y-4">
            {loading ? (
              <Card><CardBody><LoadingState message="Loading agents…" /></CardBody></Card>
            ) : agents.length === 0 ? (
              <Card><CardBody><EmptyState icon={Bot} title="No agents assigned" description="Contact your administrator to assign agents" /></CardBody></Card>
            ) : (
              agents.map((agent) => {
                const dailyPct   = percentageOf(agent.spendingBudget.dailySpentUSD,   agent.spendingBudget.dailyLimitUSD);
                const monthlyPct = percentageOf(agent.spendingBudget.monthlySpentUSD, agent.spendingBudget.monthlyLimitUSD);
                return (
                  <Card key={agent.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "rgba(34,211,238,0.10)" }}>
                            <Bot className="w-4 h-4 text-[#22d3ee]" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{agent.name}</p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{agent.description}</p>
                          </div>
                        </div>
                        <Badge className={agentStatusColor(agent.status)} dot>{agent.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardBody className="space-y-4">
                      {/* Budgets */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { label: "Daily Budget",   spent: agent.spendingBudget.dailySpentUSD,   limit: agent.spendingBudget.dailyLimitUSD,   pct: dailyPct },
                          { label: "Monthly Budget", spent: agent.spendingBudget.monthlySpentUSD, limit: agent.spendingBudget.monthlyLimitUSD, pct: monthlyPct },
                          { label: "Per-Tx Limit",   spent: 0, limit: agent.spendingBudget.perTxLimitUSD, pct: 0 },
                        ].map(({ label, spent, limit, pct }) => (
                          <div key={label}>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{label}</span>
                              <span className="text-xs tabular-nums text-white">
                                {label === "Per-Tx Limit" ? formatUSD(limit) : `${formatUSD(spent)} / ${formatUSD(limit)}`}
                              </span>
                            </div>
                            {label !== "Per-Tx Limit" && (
                              <ProgressBar value={pct} variant={pct >= 90 ? "danger" : pct >= 75 ? "warn" : "default"} showLabel />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Permissions */}
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Permissions</p>
                        <div className="flex flex-wrap gap-2">
                          {agent.permissions.map((p) => (
                            <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                              style={{
                                background: p.granted ? "rgba(16,185,129,0.07)" : "rgba(244,63,94,0.06)",
                                border: `1px solid ${p.granted ? "rgba(16,185,129,0.18)" : "rgba(244,63,94,0.15)"}`,
                                color: p.granted ? "#34d399" : "#f87171",
                              }}>
                              {p.granted ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {p.type.replace(/_/g, " ")}
                              {p.expiresAt && (
                                <span className="text-amber-400 ml-1">· expires {formatRelativeTime(p.expiresAt)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1" style={{ borderTop: "1px solid rgba(56,189,248,0.06)" }}>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Risk score: <span className={agent.riskScore >= 70 ? "text-rose-400" : agent.riskScore >= 40 ? "text-amber-400" : "text-emerald-400"}>{agent.riskScore}</span>
                          <span className="ml-1" style={{ color: "var(--text-muted)" }}>(advisory only)</span>
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>·</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Last active {formatRelativeTime(agent.lastActive)}
                        </span>
                      </div>
                    </CardBody>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <TxDrawer tx={detailTx} onClose={() => setDetailTx(null)} />
    </div>
  );
}
