"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card, CardHeader, CardBody, Badge, Button, ProgressBar,
  Table, Th, Td, Tr, SimulatedDataLabel, RiskScorePill, SectionHeader,
  LoadingState, EmptyState, AlertBanner,
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";
import { useSSE } from "@/hooks/useSSE";
import { apiGet, apiPatch } from "@/lib/api-client";
import {
  Bot, Plus, ShieldAlert, Activity, Lock, Unlock,
  Calendar, Zap, AlertTriangle, CheckCircle2, RefreshCw,
} from "lucide-react";
import {
  formatUSD, formatRelativeTime, formatDateTime,
  agentStatusColor, txStatusColor, percentageOf, formatAddress,
} from "@/lib/utils";
import type { Agent, Transaction } from "@/lib/types";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [agentRes, txRes] = await Promise.all([
        apiGet<{ data: Agent[] }>("/api/agents"),
        apiGet<{ data: Transaction[] }>("/api/transactions"),
      ]);
      setAgents(agentRes.data ?? []);
      setTxs((txRes.data ?? []).slice(0, 50));
    } catch (err) {
      toast({ type: "error", title: "Load failed", message: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useSSE("owner", {
    init: () => {},
    agent_update: (e) => {
      const updated = e.payload as Agent;
      setAgents((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    },
    transaction_new: (e) => {
      const tx = e.payload as Transaction;
      setTxs((prev) => [tx, ...prev].slice(0, 50));
      setAgents((prev) => prev.map((a) => {
        if (a.id === tx.agentId && tx.status === "approved") {
          return {
            ...a,
            spendingBudget: {
              ...a.spendingBudget,
              dailySpentUSD: a.spendingBudget.dailySpentUSD + tx.amountUSD,
              monthlySpentUSD: a.spendingBudget.monthlySpentUSD + tx.amountUSD,
            },
            lastActive: tx.timestamp,
          };
        }
        return a;
      }));
    },
  });

  async function setAgentStatus(agentId: string, status: "active" | "paused") {
    setActionLoading(agentId);
    try {
      const res = await apiPatch<{ data: Agent }>(`/api/agents/${agentId}`, { status });
      setAgents((prev) => prev.map((a) => a.id === agentId ? res.data : a));
      toast({ type: "success", title: `Agent ${status}`, message: res.data.name });
    } catch (err) {
      toast({ type: "error", title: "Action failed", message: String(err) });
    } finally {
      setActionLoading(null);
    }
  }

  const activeAgents    = agents.filter((a) => a.status === "active").length;
  const pausedAgents    = agents.filter((a) => a.status === "paused").length;
  const suspendedAgents = agents.filter((a) => a.status === "suspended").length;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        title="AI Agent Management"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={loadData}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button variant="primary" size="sm">
              <Plus className="w-3.5 h-3.5" /> Add Agent
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6 fade-up">
        {/* Security notice */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-lg"
          style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.18)" }}
        >
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#60a5fa" }} />
          <p className="text-xs leading-relaxed" style={{ color: "#93c5fd" }}>
            <strong>Security Model:</strong> AI risk scores are <strong>advisory signals only</strong> — not the final security authority.
            Policy enforcement happens in the <strong>ERC-4337 smart wallet validation layer</strong>, not in the UI or AI model.
          </p>
        </div>

        {loading ? (
          <LoadingState message="Loading agent data from database…" />
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Agents",  value: agents.length,     icon: Bot,          color: "#8b5cf6",  bg: "rgba(139,92,246,0.12)" },
                { label: "Active",        value: activeAgents,       icon: CheckCircle2, color: "#10b981",  bg: "rgba(16,185,129,0.12)" },
                { label: "Paused",        value: pausedAgents,       icon: Activity,     color: "#f59e0b",  bg: "rgba(245,158,11,0.12)" },
                { label: "Suspended",     value: suspendedAgents,    icon: Lock,         color: "#ef4444",  bg: "rgba(239,68,68,0.12)" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label} className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div>
                    <p className="section-label">{label}</p>
                    <p className="text-xl font-bold text-white mt-1">{value}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Agent Cards */}
            <SectionHeader title="Registered Agents" subtitle="Live data from persistent database — updates via SSE" />
            {agents.length === 0 ? (
              <EmptyState icon={Bot} title="No agents registered" description="Create an agent to get started" />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {agents.map((agent) => {
                  const dailyPct   = percentageOf(agent.spendingBudget.dailySpentUSD,   agent.spendingBudget.dailyLimitUSD);
                  const monthlyPct = percentageOf(agent.spendingBudget.monthlySpentUSD, agent.spendingBudget.monthlyLimitUSD);
                  const agentTxs   = txs.filter((t) => t.agentId === agent.id);
                  const blocked    = agentTxs.filter((t) => t.status === "blocked").length;
                  const isSuspended = agent.status === "suspended";
                  const isActioning = actionLoading === agent.id;

                  return (
                    <Card key={agent.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center"
                              style={{
                                background: isSuspended ? "rgba(239,68,68,0.10)" :
                                  agent.status === "active" ? "rgba(139,92,246,0.12)" : "rgba(56,189,248,0.06)"
                              }}
                            >
                              <Bot className="w-5 h-5" style={{
                                color: isSuspended ? "#f87171" :
                                  agent.status === "active" ? "#a78bfa" : "#94a3b8"
                              }} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                                <Badge className={agentStatusColor(agent.status)} dot>{agent.status}</Badge>
                                <SimulatedDataLabel />
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: "#475569" }}>{agent.description}</p>
                            </div>
                          </div>
                          <RiskScorePill score={agent.riskScore} showBar />
                        </div>
                      </CardHeader>
                      <CardBody className="space-y-4">
                        {/* Wallet */}
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: "#475569" }}>Wallet</span>
                          <code className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(56,189,248,0.06)", color: "#94a3b8" }}>
                            {formatAddress(agent.walletAddress)}
                          </code>
                        </div>

                        {/* Spending */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span style={{ color: "#475569" }}>Daily: {formatUSD(agent.spendingBudget.dailySpentUSD)} / {formatUSD(agent.spendingBudget.dailyLimitUSD)}</span>
                            <span className={`font-semibold ${dailyPct > 80 ? "text-rose-400" : dailyPct > 50 ? "text-amber-400" : "text-emerald-400"}`}>{dailyPct}%</span>
                          </div>
                          <ProgressBar value={dailyPct} variant={dailyPct > 80 ? "danger" : dailyPct > 50 ? "warn" : "default"} />
                          <div className="flex items-center justify-between text-xs">
                            <span style={{ color: "#475569" }}>Monthly: {formatUSD(agent.spendingBudget.monthlySpentUSD)} / {formatUSD(agent.spendingBudget.monthlyLimitUSD)}</span>
                            <span className={`font-semibold ${monthlyPct > 80 ? "text-rose-400" : monthlyPct > 50 ? "text-amber-400" : "text-emerald-400"}`}>{monthlyPct}%</span>
                          </div>
                          <ProgressBar value={monthlyPct} variant={monthlyPct > 80 ? "danger" : monthlyPct > 50 ? "warn" : "default"} />
                          <p className="text-xs" style={{ color: "#475569" }}>Per-tx limit: {formatUSD(agent.spendingBudget.perTxLimitUSD)}</p>
                        </div>

                        {/* Permissions */}
                        <div>
                          <p className="text-xs font-medium mb-2" style={{ color: "#94a3b8" }}>Permissions</p>
                          <div className="flex flex-wrap gap-1.5">
                            {agent.permissions.map((perm) => {
                              const expired = perm.expiresAt && new Date(perm.expiresAt) < new Date();
                              return (
                                <div
                                  key={perm.id}
                                  className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                                  style={{
                                    background: expired ? "rgba(239,68,68,0.06)" : perm.granted ? "rgba(16,185,129,0.06)" : "rgba(56,189,248,0.04)",
                                    border: expired ? "1px solid rgba(239,68,68,0.20)" : perm.granted ? "1px solid rgba(16,185,129,0.20)" : "1px solid rgba(56,189,248,0.10)",
                                    color: expired ? "#f87171" : perm.granted ? "#34d399" : "#475569",
                                  }}
                                >
                                  {expired ? <AlertTriangle className="w-2.5 h-2.5" /> : perm.granted ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                                  {perm.type.replace("_", " ")}
                                  {expired && <span className="ml-1 opacity-70">expired</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between text-xs pt-1" style={{ borderTop: "1px solid rgba(56,189,248,0.08)" }}>
                          <div className="flex items-center gap-2" style={{ color: "#475569" }}>
                            <Calendar className="w-3 h-3" />
                            <span>Last active: {formatRelativeTime(agent.lastActive)}</span>
                          </div>
                          <div className="flex items-center gap-3" style={{ color: "#475569" }}>
                            <span>{agentTxs.length} txs</span>
                            {blocked > 0 && <span className="text-rose-400">{blocked} blocked</span>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1">
                          {agent.status === "active" && (
                            <Button variant="secondary" size="sm" className="flex-1" loading={isActioning} onClick={() => setAgentStatus(agent.id, "paused")}>
                              <Activity className="w-3 h-3" /> Pause
                            </Button>
                          )}
                          {agent.status === "paused" && (
                            <Button variant="primary" size="sm" className="flex-1" loading={isActioning} onClick={() => setAgentStatus(agent.id, "active")}>
                              <Zap className="w-3 h-3" /> Activate
                            </Button>
                          )}
                          {isSuspended && (
                            <Button variant="danger" size="sm" className="flex-1" disabled>
                              <Lock className="w-3 h-3" /> Suspended
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="flex-1">Edit Policy</Button>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Transaction log */}
            <Card>
              <CardHeader>
                <SectionHeader title="Agent Transaction Log" subtitle="Live data — updates via SSE when new transactions arrive" />
              </CardHeader>
              <CardBody className="p-0">
                {txs.length === 0 ? (
                  <div className="py-8">
                    <EmptyState icon={Activity} title="No transactions yet" description="Transactions will appear here as agents process requests" />
                  </div>
                ) : (
                  <Table>
                    <thead>
                      <tr><Th>Agent</Th><Th>Recipient</Th><Th>Amount</Th><Th>Status</Th><Th>Risk</Th><Th>Time</Th><Th>Data</Th></tr>
                    </thead>
                    <tbody>
                      {txs.map((tx) => (
                        <Tr key={tx.id}>
                          <Td><span className="text-xs font-semibold text-white">{tx.agentName}</span></Td>
                          <Td>
                            <span className="text-white font-medium text-xs">{tx.toLabel || "—"}</span>
                            <p className="text-xs font-mono" style={{ color: "#334155" }}>{formatAddress(tx.toAddress)}</p>
                          </Td>
                          <Td><span className={`font-semibold ${tx.status === "blocked" ? "text-rose-400" : "text-white"}`}>{formatUSD(tx.amountUSD)}</span></Td>
                          <Td>
                            <Badge className={txStatusColor(tx.status)}>{tx.status}</Badge>
                            {tx.blockReason && <p className="text-xs text-rose-400 mt-0.5 max-w-xs truncate">{tx.blockReason}</p>}
                          </Td>
                          <Td><RiskScorePill score={tx.riskScore} showBar /></Td>
                          <Td>
                            <p className="text-xs" style={{ color: "#475569" }}>{formatRelativeTime(tx.timestamp)}</p>
                            <p className="text-xs font-mono opacity-50" style={{ color: "#475569" }}>{tx.id}</p>
                          </Td>
                          <Td><SimulatedDataLabel /></Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
