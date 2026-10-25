"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardHeader, CardBody, Badge, AlertBanner, LoadingState, EmptyState } from "@/components/ui/index";
import { apiGet } from "@/lib/api-client";
import { formatRelativeTime, riskLevelBg, txStatusColor } from "@/lib/utils";
import type { Transaction, RiskAlert } from "@/lib/types";
import { FileSearch, AlertTriangle, Clock, ShieldCheck, ShieldX } from "lucide-react";

export default function AuditPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      apiGet<{ data: Transaction[] }>("/api/transactions"),
      apiGet<{ data: RiskAlert[] }>("/api/anomaly"),
    ]).then(([txRes, alertRes]) => {
      if (txRes.status === "fulfilled") setTransactions(txRes.value.data ?? []);
      if (alertRes.status === "fulfilled") setAlerts(alertRes.value.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const blocked = transactions.filter((t) => t.status === "blocked");
  const approved = transactions.filter((t) => t.status === "approved");
  const unacknowledged = alerts.filter((a) => !a.acknowledged);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Security Testing"
        title="Audit Logs & Reports"
        subtitle="Complete transaction audit trail and security events"
      />
      <div className="page-content space-y-6 fade-up">
        <AlertBanner variant="info" icon={FileSearch}>
          All agent transactions, policy decisions, and risk alerts are logged here.
          For a full analytics overview, see the <strong>Owner Dashboard</strong>.
          On-chain audit trail requires contract deployment.
        </AlertBanner>

        {/* Summary stats */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Transactions", value: transactions.length, color: "#22d3ee" },
              { label: "Approved",           value: approved.length,     color: "#10b981" },
              { label: "Blocked",            value: blocked.length,      color: "#f43f5e" },
              { label: "Unresolved Alerts",  value: unacknowledged.length, color: "#f59e0b" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="px-4 py-4 rounded-xl"
                style={{ background: "rgba(7,16,32,0.8)", border: "1px solid rgba(56,189,248,0.10)" }}
              >
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <LoadingState message="Loading audit logs…" />
        ) : (
          <>
            {/* Recent transactions */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#22d3ee]" />
                  <h2 className="text-sm font-semibold text-white">Transaction Audit Trail</h2>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    ({transactions.length} total)
                  </span>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {transactions.length === 0 ? (
                  <div className="p-5">
                    <EmptyState icon={FileSearch} title="No transactions" description="Run some agent tasks to see the audit trail." />
                  </div>
                ) : (
                  <div>
                    {transactions.slice(0, 20).map((tx, i) => (
                      <div
                        key={tx.id}
                        className="flex items-center gap-3 px-5 py-3"
                        style={{
                          borderBottom: i < Math.min(transactions.length, 20) - 1 ? "1px solid rgba(56,189,248,0.05)" : undefined,
                        }}
                      >
                        {tx.status === "blocked" ? (
                          <ShieldX className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate font-mono">{tx.id}</p>
                          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                            {tx.agentName} → {tx.toLabel ?? tx.toAddress.slice(0, 16)}…
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={txStatusColor(tx.status)}>{tx.status}</Badge>
                          <span className="text-xs tabular-nums text-white">${tx.amountUSD.toFixed(0)}</span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatRelativeTime(tx.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Risk alerts */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-semibold text-white">Security Events</h2>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>({alerts.length} total)</span>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {alerts.length === 0 ? (
                  <div className="p-5">
                    <EmptyState icon={AlertTriangle} title="No security events" description="Risk alerts and anomaly detections will appear here." />
                  </div>
                ) : (
                  <div>
                    {alerts.slice(0, 10).map((alert, i) => (
                      <div
                        key={alert.id}
                        className="flex items-start gap-3 px-5 py-3"
                        style={{ borderBottom: i < Math.min(alerts.length, 10) - 1 ? "1px solid rgba(56,189,248,0.05)" : undefined }}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: alert.level === "critical" ? "#f43f5e" : "#f59e0b" }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-xs font-semibold text-white">{alert.title}</p>
                            <Badge className={riskLevelBg(alert.level)}>{alert.level}</Badge>
                            {!alert.acknowledged && <Badge className="badge-amber">Unresolved</Badge>}
                          </div>
                          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{alert.description}</p>
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                          {formatRelativeTime(alert.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
