"use client";

import { useState, useEffect, useCallback } from "react";
import { useSSE } from "@/hooks/useSSE";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "@/components/ui/Toast";
import {
  Card, CardHeader, CardBody, Badge, Button, ProgressBar,
  Table, Th, Td, Tr, SimulatedDataLabel, RiskScorePill,
} from "@/components/ui/index";
import { TopBar } from "@/components/layout/TopBar";
import {
  Bot, Send, ShieldAlert, Lock, Unlock,
  CheckCircle2, XCircle, RefreshCw, DollarSign, Wallet, Activity,
  Zap, Clock, Shield,
} from "lucide-react";
import {
  formatUSD, formatRelativeTime, formatAddress,
  agentStatusColor, txStatusColor, percentageOf,
} from "@/lib/utils";
import type { Agent, Transaction } from "@/lib/types";

// In a real app, the agent ID comes from the agent's own auth token — never from the UI
const ACTIVE_AGENT_ID = "agt_01"; // PayBot Alpha (demo)

interface PaymentForm {
  toLabel: string;
  toAddress: string;
  amountUSD: string;
  purpose: string;
}

export default function AgentPage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [txHistory, setTxHistory] = useState<Transaction[]>([]);
  const [form, setForm] = useState<PaymentForm>({ toLabel: "", toAddress: "", amountUSD: "", purpose: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [agentRes, txRes] = await Promise.all([
        apiGet<{ data: Agent }>(`/api/agents/${ACTIVE_AGENT_ID}`),
        apiGet<{ data: Transaction[] }>(`/api/transactions?agentId=${ACTIVE_AGENT_ID}`),
      ]);
      setAgent(agentRes.data);
      setTxHistory(txRes.data);
    } catch (err: unknown) {
      toast({ type: "error", title: "Failed to load agent data", message: String(err) });
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useSSE("agent", {
    agent_update: (e) => {
      const updated = e.payload as Agent;
      if (updated.id === ACTIVE_AGENT_ID) setAgent(updated);
    },
    transaction_new: (e) => {
      const tx = e.payload as Transaction;
      if (tx.agentId === ACTIVE_AGENT_ID) {
        setTxHistory((prev) => [tx, ...prev]);
      }
    },
    approval_update: () => loadData(),
    transaction_update: () => loadData(),
  });

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!agent) return;

    const amount = parseFloat(form.amountUSD);
    if (!form.toLabel.trim()) { setFormError("Recipient is required"); return; }
    if (isNaN(amount) || amount <= 0) { setFormError("Amount must be a positive number"); return; }
    if (!form.purpose.trim()) { setFormError("Purpose is required"); return; }

    setSubmitting(true);
    try {
      const res = await apiPost<{ data: Transaction; status: string }>("/api/transactions", {
        agentId: agent.id,
        toLabel: form.toLabel,
        toAddress: form.toAddress || `0x${form.toLabel.replace(/\s/g, "").slice(0, 20).padEnd(20, "0")}`,
        amountUSD: amount,
        purpose: form.purpose,
        role: "agent",
      });

      const msgs: Record<string, string> = {
        approved: "Payment processed successfully",
        pending: "Submitted — awaiting owner approval",
        blocked: "Blocked by policy enforcement",
      };
      toast({
        type: res.status === "approved" ? "success" : res.status === "blocked" ? "error" : "warning",
        title: `Payment ${res.status}`,
        message: msgs[res.status] ?? res.status,
      });

      setTxHistory((prev) => [res.data, ...prev]);
      setForm({ toLabel: "", toAddress: "", amountUSD: "", purpose: "" });
      loadData();
    } catch (err: unknown) {
      setFormError(String(err));
    } finally { setSubmitting(false); }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "var(--cyan)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading agent data…</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Agent not found</p>
      </div>
    );
  }

  const dailyPct = percentageOf(agent.spendingBudget.dailySpentUSD, agent.spendingBudget.dailyLimitUSD);
  const monthlyPct = percentageOf(agent.spendingBudget.monthlySpentUSD, agent.spendingBudget.monthlyLimitUSD);
  const isSuspended = agent.status === "suspended";
  const approvedTxs = txHistory.filter((t) => t.status === "approved").length;
  const blockedTxs  = txHistory.filter((t) => t.status === "blocked").length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <TopBar
        title={agent.name}
        subtitle="Agent Portal · ERC-4337 Wallet Demo"
        actions={
          <div className="flex items-center gap-2">
            <Badge className={agentStatusColor(agent.status)} dot>{agent.status}</Badge>
            <SimulatedDataLabel />
            <button onClick={loadData} className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <div className="page-content">

        {/* Security notice */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl border"
          style={{
            background: "rgba(59,130,246,0.06)",
            borderColor: "rgba(59,130,246,0.20)",
          }}
        >
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#60a5fa" }} />
          <p className="text-xs leading-relaxed" style={{ color: "#93c5fd" }}>
            <strong>Security Model:</strong> This agent <strong>cannot modify its own policies, permissions, or
            spending limits</strong>. All enforcement is server-side. On-chain ERC-4337 validation (when deployed)
            enforces the same rules independently, making policy bypass impossible even if this interface is
            compromised.
          </p>
        </div>

        {/* Suspended banner */}
        {isSuspended && (
          <div
            className="flex items-center gap-3 p-4 rounded-xl border"
            style={{ background: "var(--danger-dim)", borderColor: "rgba(239,68,68,0.30)" }}
          >
            <Lock className="w-5 h-5 flex-shrink-0" style={{ color: "var(--danger)" }} />
            <div>
              <p className="text-sm font-bold" style={{ color: "#fca5a5" }}>Agent Suspended</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--danger)" }}>
                This agent has been suspended by the owner. All payment submissions are blocked.
                Contact the owner to reactivate.
              </p>
            </div>
          </div>
        )}

        {/* Top stat row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Per-Tx Limit",  value: formatUSD(agent.spendingBudget.perTxLimitUSD),     icon: Zap,      iconBg: "var(--cyan-dim)",    iconColor: "var(--cyan)" },
            { label: "Daily Limit",   value: formatUSD(agent.spendingBudget.dailyLimitUSD),      icon: Clock,    iconBg: "var(--blue-dim)",    iconColor: "var(--blue)" },
            { label: "Monthly Limit", value: formatUSD(agent.spendingBudget.monthlyLimitUSD),    icon: Activity, iconBg: "var(--teal-dim)",    iconColor: "var(--teal)" },
            { label: "Approved TXs",  value: `${approvedTxs} / ${txHistory.length}`,             icon: Shield,   iconBg: "rgba(16,185,129,0.10)", iconColor: "var(--success)" },
          ].map(({ label, value, icon: Icon, iconBg, iconColor }) => (
            <div
              key={label}
              className="rounded-xl border p-4"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="section-label">{label}</p>
                  <p className="mt-1.5 text-lg font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                </div>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: iconBg }}
                >
                  <Icon className="w-4 h-4" style={{ color: iconColor }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* ── Identity Card ── */}
          <Card className="md:col-span-1">
            <CardHeader>
              <h3 className="section-label">Identity</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="space-y-2.5 text-xs">
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Agent ID</p>
                  <code className="font-mono mt-0.5 block" style={{ color: "var(--text-secondary)" }}>{agent.id}</code>
                </div>
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Wallet Address</p>
                  <code className="font-mono mt-0.5 block" style={{ color: "var(--text-secondary)" }}>
                    {formatAddress(agent.walletAddress)}
                  </code>
                </div>
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Owner</p>
                  <span style={{ color: "var(--text-secondary)" }}>Alexandra Chen (usr_01)</span>
                </div>
                <div>
                  <p style={{ color: "var(--text-muted)" }} className="mb-1">Risk Score (advisory)</p>
                  <RiskScorePill score={agent.riskScore} showBar />
                </div>
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Last Active</p>
                  <span style={{ color: "var(--text-secondary)" }}>{formatRelativeTime(agent.lastActive)}</span>
                </div>
              </div>

              <div className="pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <p className="section-label mb-2">Network</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--warning-dim)" }}
                  >
                    <Wallet className="w-3.5 h-3.5" style={{ color: "var(--warning)" }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: "#fcd34d" }}>Simulated</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Blockchain: not connected</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* ── Spending Budgets + Permissions ── */}
          <Card className="md:col-span-2">
            <CardHeader>
              <h3 className="section-label">Spending Budget</h3>
            </CardHeader>
            <CardBody className="space-y-5">
              {/* Daily spend bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--text-secondary)" }}>
                    Daily: <strong style={{ color: "var(--text-primary)" }}>{formatUSD(agent.spendingBudget.dailySpentUSD)}</strong> of {formatUSD(agent.spendingBudget.dailyLimitUSD)}
                  </span>
                  <span
                    className="font-bold"
                    style={{ color: dailyPct > 80 ? "var(--danger)" : dailyPct > 50 ? "var(--warning)" : "var(--text-muted)" }}
                  >
                    {dailyPct}%
                  </span>
                </div>
                <ProgressBar
                  value={dailyPct}
                  variant={dailyPct > 80 ? "danger" : dailyPct > 50 ? "warn" : "default"}
                />
              </div>

              {/* Monthly spend bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--text-secondary)" }}>
                    Monthly: <strong style={{ color: "var(--text-primary)" }}>{formatUSD(agent.spendingBudget.monthlySpentUSD)}</strong> of {formatUSD(agent.spendingBudget.monthlyLimitUSD)}
                  </span>
                  <span
                    className="font-bold"
                    style={{ color: monthlyPct > 80 ? "var(--danger)" : monthlyPct > 50 ? "var(--warning)" : "var(--text-muted)" }}
                  >
                    {monthlyPct}%
                  </span>
                </div>
                <ProgressBar
                  value={monthlyPct}
                  variant={monthlyPct > 80 ? "danger" : monthlyPct > 50 ? "warn" : "default"}
                />
              </div>

              {/* Blocked TX note */}
              {blockedTxs > 0 && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                  style={{ background: "var(--danger-dim)", color: "var(--danger)" }}
                >
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {blockedTxs} transaction{blockedTxs > 1 ? "s" : ""} blocked by policy this session
                </div>
              )}

              {/* Permissions */}
              <div className="pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <p className="section-label mb-2.5">Permissions <span style={{ color: "var(--text-muted)", fontWeight: 400, textTransform: "none", fontSize: "0.65rem" }}>(read-only — set by owner)</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.permissions.map((perm) => (
                    <div
                      key={perm.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border"
                      style={perm.granted ? {
                        background: "var(--success-dim)",
                        color: "var(--success)",
                        borderColor: "rgba(16,185,129,0.25)",
                      } : {
                        background: "rgba(255,255,255,0.03)",
                        color: "var(--text-muted)",
                        borderColor: "var(--border-subtle)",
                      }}
                    >
                      {perm.granted
                        ? <Unlock className="w-3 h-3" />
                        : <Lock className="w-3 h-3" />
                      }
                      {perm.type.replace("_", " ")}
                      {!perm.granted && <span style={{ color: "var(--text-muted)", opacity: 0.6 }}>(denied)</span>}
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ── Submit Payment ── */}
        <Card className={isSuspended ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <Send className="w-4 h-4" style={{ color: "var(--cyan)" }} />
                Submit Payment Request
              </h3>
              {isSuspended && (
                <Badge className="bg-[rgba(239,68,68,0.10)] text-rose-400 border border-[rgba(239,68,68,0.25)]">
                  Suspended — no submissions allowed
                </Badge>
              )}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              All fields validated server-side against assigned policy. This agent cannot bypass or modify its own limits.
            </p>
          </CardHeader>
          <CardBody>
            <form onSubmit={submitPayment} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recipient */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Recipient / Merchant *
                </label>
                <input
                  value={form.toLabel}
                  onChange={(e) => setForm({ ...form, toLabel: e.target.value })}
                  className="input-base w-full"
                  placeholder="e.g. Supplier Corp, API Provider…"
                  disabled={isSuspended}
                />
              </div>

              {/* Recipient address */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Recipient Address <span style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input
                  value={form.toAddress}
                  onChange={(e) => setForm({ ...form, toAddress: e.target.value })}
                  className="input-base w-full font-mono text-xs"
                  placeholder="0x…"
                  disabled={isSuspended}
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Amount (USD) *
                </label>
                <div className="relative">
                  <DollarSign
                    className="absolute left-3 top-2.5 w-3.5 h-3.5"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <input
                    type="number" min="0.01" step="0.01"
                    value={form.amountUSD}
                    onChange={(e) => setForm({ ...form, amountUSD: e.target.value })}
                    className="input-base w-full pl-8"
                    placeholder="0.00"
                    disabled={isSuspended}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Per-tx limit: {formatUSD(agent.spendingBudget.perTxLimitUSD)}
                </p>
              </div>

              {/* Purpose */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Purpose / Justification *
                </label>
                <textarea
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  className="input-base w-full resize-none"
                  placeholder="Why is this payment needed?"
                  rows={3}
                  disabled={isSuspended}
                />
              </div>

              {formError && (
                <div
                  className="md:col-span-2 flex items-start gap-2 p-3 rounded-lg border text-xs"
                  style={{ background: "var(--danger-dim)", borderColor: "rgba(239,68,68,0.25)", color: "#fca5a5" }}
                >
                  <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--danger)" }} />
                  {formError}
                </div>
              )}

              <div className="md:col-span-2 flex items-center gap-4">
                <Button type="submit" variant="primary" loading={submitting} disabled={isSuspended}>
                  <Send className="w-3.5 h-3.5" /> Submit Payment
                </Button>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  ⚠ This agent cannot approve its own requests. Blocked or pending transactions require owner action.
                </p>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* ── Transaction History ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Transaction History
              </h3>
              <div className="flex items-center gap-2">
                {txHistory.length > 0 && (
                  <>
                    <Badge className="bg-[rgba(16,185,129,0.10)] text-emerald-400 border border-[rgba(16,185,129,0.25)]">
                      <CheckCircle2 className="w-2.5 h-2.5" /> {approvedTxs} approved
                    </Badge>
                    {blockedTxs > 0 && (
                      <Badge className="bg-[rgba(239,68,68,0.10)] text-rose-400 border border-[rgba(239,68,68,0.25)]">
                        <XCircle className="w-2.5 h-2.5" /> {blockedTxs} blocked
                      </Badge>
                    )}
                  </>
                )}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{txHistory.length} records</span>
              </div>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {txHistory.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No transactions yet</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                  Submit a payment to see history
                </p>
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Recipient</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>Policy Result</Th>
                    <Th>Time</Th>
                  </tr>
                </thead>
                <tbody>
                  {txHistory.map((tx) => (
                    <Tr key={tx.id}>
                      <Td>
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {(tx as Transaction & { toLabel?: string }).toLabel || formatAddress(tx.toAddress)}
                        </span>
                      </Td>
                      <Td>
                        <span
                          className="font-bold text-sm"
                          style={{ color: tx.status === "blocked" ? "var(--danger)" : "var(--text-primary)" }}
                        >
                          {formatUSD(tx.amountUSD)}
                        </span>
                      </Td>
                      <Td>
                        <Badge className={txStatusColor(tx.status)}>{tx.status}</Badge>
                      </Td>
                      <Td>
                        <div className="space-y-0.5 max-w-xs">
                          {tx.blockReason && (
                            <p className="text-xs" style={{ color: "var(--danger)" }}>{tx.blockReason}</p>
                          )}
                          {tx.riskFlags.map((f, i) => (
                            <p key={i} className="text-xs" style={{ color: "var(--warning)" }}>{f}</p>
                          ))}
                          {!tx.blockReason && tx.riskFlags.length === 0 && (
                            <span className="text-xs flex items-center gap-1" style={{ color: "var(--success)" }}>
                              <CheckCircle2 className="w-3 h-3" /> All checks passed
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {formatRelativeTime(tx.timestamp)}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
