"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card, CardHeader, CardBody, Badge, Button, RiskScorePill, SimulatedDataLabel,
  LoadingState, EmptyState,
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";
import { apiGet, apiPatch } from "@/lib/api-client";
import { useSSE } from "@/hooks/useSSE";
import {
  AlertTriangle, CheckCircle2, Eye, Info, ShieldAlert, Activity, Lock, Bot, RefreshCw,
} from "lucide-react";
import { formatRelativeTime, formatDateTime, riskLevelBg, formatUSD } from "@/lib/utils";
import type { RiskAlert, Agent } from "@/lib/types";

export default function RiskPage() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [ackLoading, setAckLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [alertRes, agentRes] = await Promise.all([
        apiGet<{ data: RiskAlert[] }>("/api/anomaly"),
        apiGet<{ data: Agent[] }>("/api/agents"),
      ]);
      // Also fetch risk alerts from stats endpoint
      const statsRes = await apiGet<{ riskAlerts: RiskAlert[] }>("/api/stats");
      const combinedAlerts = statsRes.riskAlerts ?? alertRes.data ?? [];
      setAlerts(combinedAlerts);
      setAgents(agentRes.data ?? []);
    } catch (err) {
      toast({ type: "error", title: "Load failed", message: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useSSE("owner", {
    init: () => {},
    risk_alert: (e) => {
      const alert = e.payload as RiskAlert;
      setAlerts((prev) => [alert, ...prev]);
      toast({ type: "error", title: `Risk Alert: ${alert.level.toUpperCase()}`, message: alert.title });
    },
    agent_update: (e) => {
      const updated = e.payload as Agent;
      setAgents((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    },
  });

  async function acknowledge(id: string) {
    setAckLoading(id);
    try {
      await apiPatch("/api/anomaly", { eventId: id });
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, acknowledged: true } : a));
      toast({ type: "success", title: "Alert acknowledged" });
    } catch (err) {
      toast({ type: "error", title: "Failed", message: String(err) });
    } finally {
      setAckLoading(null);
    }
  }

  const unacknowledged = alerts.filter((a) => !a.acknowledged);
  const critical = alerts.filter((a) => a.level === "critical");
  const high     = alerts.filter((a) => a.level === "high");
  const medium   = alerts.filter((a) => a.level === "medium");

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        title="Risk Monitor"
        actions={
          <Button variant="ghost" size="sm" onClick={loadData}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6 fade-up">
        {/* AI disclaimer */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-lg"
          style={{ background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.14)" }}
        >
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#22d3ee]" />
          <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
            <strong className="text-[#22d3ee]">AI Risk Model Disclaimer:</strong> Risk scores are <strong>advisory signals</strong> only — not the final security authority.
            Transactions are blocked by <strong>server-side policy rules</strong> and, when deployed, by the{" "}
            <strong>ERC-4337 smart wallet validation layer</strong>.
          </p>
        </div>

        {loading ? (
          <LoadingState message="Loading risk data from database…" />
        ) : (
          <>
            {/* Alert counts */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Critical",        count: critical.length,        bg: "rgba(239,68,68,0.12)",  color: "#f87171"  },
                { label: "High",            count: high.length,            bg: "rgba(249,115,22,0.12)", color: "#fb923c"  },
                { label: "Medium",          count: medium.length,          bg: "rgba(245,158,11,0.12)", color: "#fbbf24"  },
                { label: "Unacknowledged",  count: unacknowledged.length,  bg: "rgba(56,189,248,0.06)", color: "#94a3b8"  },
              ].map(({ label, count, bg, color }) => (
                <Card key={label} className="p-4">
                  <div className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center" style={{ background: bg }}>
                    <AlertTriangle className="w-4 h-4" style={{ color }} />
                  </div>
                  <p className="section-label">{label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color }}>{count}</p>
                </Card>
              ))}
            </div>

            {/* Alert list */}
            {alerts.length === 0 ? (
              <EmptyState icon={ShieldAlert} title="No risk alerts" description="Alerts appear when the policy engine blocks a high-risk transaction" />
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <Card
                    key={alert.id}
                    className={
                      alert.level === "critical" ? "border-rose-800/50" :
                      alert.level === "high"     ? "border-orange-800/40" : ""
                    }
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background:
                                alert.level === "critical" ? "rgba(239,68,68,0.10)" :
                                alert.level === "high"     ? "rgba(249,115,22,0.10)" :
                                alert.level === "medium"   ? "rgba(245,158,11,0.10)" : "rgba(16,185,129,0.10)"
                            }}
                          >
                            <AlertTriangle className={`w-4 h-4 ${alert.level === "critical" ? "pulse-dot" : ""}`} style={{
                              color:
                                alert.level === "critical" ? "#f87171" :
                                alert.level === "high"     ? "#fb923c" :
                                alert.level === "medium"   ? "#fbbf24" : "#34d399"
                            }} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-semibold text-white">{alert.title}</h3>
                              <Badge className={riskLevelBg(alert.level)}>{alert.level}</Badge>
                              {!alert.acknowledged && (
                                <Badge className="badge-gray">Unread</Badge>
                              )}
                              <SimulatedDataLabel />
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: "#475569" }}>{alert.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs" style={{ color: "#475569" }}>{formatRelativeTime(alert.timestamp)}</span>
                          {!alert.acknowledged && (
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={ackLoading === alert.id}
                              onClick={() => acknowledge(alert.id)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardBody className="space-y-4">
                      <div
                        className="px-4 py-3 rounded-lg"
                        style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.10)" }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Eye className="w-3.5 h-3.5 text-[#22d3ee]" />
                          <span className="text-xs font-semibold text-[#22d3ee]">Explainability</span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{alert.explanation}</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        {alert.agentName && (
                          <div>
                            <p className="mb-0.5" style={{ color: "#475569" }}>Agent</p>
                            <p className="flex items-center gap-1" style={{ color: "#94a3b8" }}>
                              <Bot className="w-3 h-3" /> {alert.agentName}
                            </p>
                          </div>
                        )}
                        {alert.policyViolated && (
                          <div>
                            <p className="mb-0.5" style={{ color: "#475569" }}>Policy Violated</p>
                            <p style={{ color: "#94a3b8" }}>{alert.policyViolated}</p>
                          </div>
                        )}
                        <div>
                          <p className="mb-0.5" style={{ color: "#475569" }}>Time</p>
                          <p style={{ color: "#94a3b8" }}>{formatDateTime(alert.timestamp)}</p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}

            {/* Agent risk summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#22d3ee]" />
                  <h3 className="text-sm font-semibold text-white">Agent Risk Summary</h3>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "#475569" }}>AI risk scores are advisory — policy enforcement is server-side</p>
              </CardHeader>
              <CardBody className="space-y-3">
                {agents.length === 0 ? (
                  <EmptyState icon={Bot} title="No agents" description="Agents will appear here once created" />
                ) : (
                  agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-4 p-3 rounded-lg"
                      style={{
                        background:
                          agent.riskScore > 75 ? "rgba(239,68,68,0.05)" :
                          agent.riskScore > 40 ? "rgba(245,158,11,0.05)" : "rgba(56,189,248,0.04)",
                        border:
                          agent.riskScore > 75 ? "1px solid rgba(239,68,68,0.18)" :
                          agent.riskScore > 40 ? "1px solid rgba(245,158,11,0.18)" : "1px solid rgba(56,189,248,0.08)",
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: agent.status === "suspended" ? "rgba(239,68,68,0.15)" : "rgba(56,189,248,0.08)" }}
                      >
                        {agent.status === "suspended" ? (
                          <Lock className="w-3.5 h-3.5 text-rose-400" />
                        ) : (
                          <Bot className="w-3.5 h-3.5" style={{ color: "#94a3b8" }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{agent.name}</p>
                        <p className="text-xs" style={{ color: "#475569" }}>
                          {agent.spendingBudget.dailySpentUSD > 0
                            ? `${formatUSD(agent.spendingBudget.dailySpentUSD)} spent today`
                            : "No activity today"}
                        </p>
                      </div>
                      <div className="flex items-center gap-6 text-xs">
                        <div className="text-center">
                          <p className="mb-0.5" style={{ color: "#475569" }}>Risk Score</p>
                          <RiskScorePill score={agent.riskScore} showBar />
                          <p className="mt-0.5" style={{ color: "#334155" }}>advisory</p>
                        </div>
                        <div className="text-center">
                          <p className="mb-0.5" style={{ color: "#475569" }}>Status</p>
                          <Badge className={
                            agent.status === "active"    ? "badge-green" :
                            agent.status === "suspended" ? "badge-red" : "badge-amber"
                          } dot>{agent.status}</Badge>
                        </div>
                        <Button variant="ghost" size="sm">
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
