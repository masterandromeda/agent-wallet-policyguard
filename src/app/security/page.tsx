"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert, RefreshCw, Play, AlertTriangle, CheckCircle2,
  XCircle, Activity, Bug, Eye, EyeOff,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card, CardHeader, CardBody, Badge, Button,
  AlertBanner, LoadingState, EmptyState,
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";
import type { AttackScenario, AnomalyEvent } from "@/lib/types";

// ─── Attack Scenario Card ──────────────────────────────────────────────────────

interface ScenarioCardProps {
  scenario: AttackScenario;
  onRun: (id: string) => void;
  running: boolean;
}

function ScenarioCard({ scenario, onRun, running }: ScenarioCardProps) {
  // Map from actual AttackScenario fields: actualOutcome + status
  const resultColor =
    scenario.actualOutcome === "blocked"  ? "#10b981" :
    scenario.actualOutcome === "approved" ? "#f43f5e" :
    "var(--text-muted)";

  const resultLabel =
    scenario.actualOutcome === "blocked"  ? "✓ Blocked (expected)" :
    scenario.actualOutcome === "approved" ? "✗ Passed through — policy gap!" :
    scenario.status === "idle"            ? "Not yet run" :
    scenario.actualOutcome === "pending"  ? "⚠ Pending approval" :
    "Not yet run";

  // severity derived from attackType
  const severity =
    scenario.attackType === "excessive_spend" || scenario.attackType === "rapid_fire"
      ? "critical"
      : "high";

  return (
    <div
      className="px-4 py-4 rounded-xl"
      style={{
        background: "rgba(7,16,32,0.6)",
        border: scenario.actualOutcome === "approved"
          ? "1px solid rgba(244,63,94,0.30)"
          : "1px solid rgba(56,189,248,0.08)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-semibold text-white">{scenario.name}</p>
            <Badge className={
              severity === "critical" ? "badge-red" :
              "bg-orange-500/10 text-orange-400 border-orange-500/20"
            }>{severity}</Badge>
            {scenario.passed === true && (
              <Badge className="badge-green">Blocked ✓</Badge>
            )}
            {scenario.passed === false && (
              <Badge className="badge-red">Policy gap ✗</Badge>
            )}
          </div>
          <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--text-muted)" }}>
            {scenario.description}
          </p>
          {scenario.actualOutcome && (
            <p className="text-xs font-semibold" style={{ color: resultColor }}>{resultLabel}</p>
          )}
          {scenario.ranAt && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Last run {formatRelativeTime(scenario.ranAt)}
            </p>
          )}
        </div>
        <Button
          variant={scenario.passed === false ? "danger" : "secondary"}
          size="xs"
          loading={running}
          onClick={() => onRun(scenario.id)}
        >
          <Play className="w-3 h-3" />
          Run
        </Button>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const [scenarios, setScenarios] = useState<AttackScenario[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [scenRes, anomRes] = await Promise.allSettled([
        apiGet<{ data: AttackScenario[] }>("/api/attack"),
        apiGet<{ data: AnomalyEvent[] }>("/api/anomaly"),
      ]);
      if (scenRes.status === "fulfilled") setScenarios(scenRes.value.data ?? []);
      if (anomRes.status === "fulfilled") setAnomalies(anomRes.value.data ?? []);
    } catch {
      toast({ type: "error", title: "Failed to load security data" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRunScenario = useCallback(async (scenarioId: string) => {
    setRunningId(scenarioId);
    try {
      const res = await apiPost<{ data: { scenario: AttackScenario; passed: boolean } }>("/api/attack", {
        scenarioId,
        agentId: "agt_01",
      });
      const { scenario: result, passed } = res.data;
      toast({
        type: passed ? "success" : "error",
        title: passed
          ? "Attack blocked — policy held"
          : "Attack passed through — review policy",
        message: result.name,
      });
      setScenarios((prev) => prev.map((s) => (s.id === scenarioId ? result : s)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scenario run failed";
      toast({ type: "error", title: "Run failed", message: msg });
    } finally {
      setRunningId(null);
    }
  }, []);

  const handleAcknowledge = useCallback(async (anomalyId: string) => {
    try {
      await apiPatch("/api/anomaly", { eventId: anomalyId });
      setAnomalies((prev) =>
        prev.map((a) => (a.id === anomalyId ? { ...a, acknowledged: true } : a))
      );
      toast({ type: "success", title: "Anomaly acknowledged" });
    } catch {
      toast({ type: "error", title: "Failed to acknowledge" });
    }
  }, []);

  const blockedCount   = scenarios.filter((s) => s.passed === true).length;
  const passedCount    = scenarios.filter((s) => s.passed === false).length;
  const unrunCount     = scenarios.filter((s) => s.status === "idle").length;
  const criticalAlerts = anomalies.filter((a) => !a.acknowledged).length;

  const visibleAnomalies = showAcknowledged
    ? anomalies
    : anomalies.filter((a) => !a.acknowledged);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Security"
        title="Security & Attack Testing"
        subtitle="Run adversarial scenarios and monitor anomaly detection"
        actions={
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="page-content space-y-6 fade-up">
        {criticalAlerts > 0 && (
          <AlertBanner variant="error" icon={AlertTriangle}>
            <strong>{criticalAlerts} critical security alert{criticalAlerts > 1 ? "s" : ""} require attention.</strong>{" "}
            Review and acknowledge the anomaly events below.
          </AlertBanner>
        )}

        <AlertBanner variant="info" icon={ShieldAlert}>
          Attack scenarios run against the <strong>server-side policy engine</strong> — not a live blockchain.
          Blockchain-level testing requires deployed contracts + Foundry invariant suites. See{" "}
          <code className="font-mono">/contracts/</code>.
        </AlertBanner>

        {/* Summary stats */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Scenarios",     value: scenarios.length, color: "#22d3ee" },
              { label: "Blocked",       value: blockedCount,     color: "#10b981" },
              { label: "Passed Through",value: passedCount,      color: "#f43f5e" },
              { label: "Not Yet Run",   value: unrunCount,       color: "#94a3b8" },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-4 py-4 rounded-xl"
                style={{ background: "rgba(7,16,32,0.8)", border: "1px solid rgba(56,189,248,0.10)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Attack scenarios */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-[#22d3ee]" />
              <h2 className="text-sm font-semibold text-white">Adversarial Attack Scenarios</h2>
              <Badge className="badge-amber">Policy engine only — not on-chain</Badge>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Each scenario attempts to bypass policy enforcement. Expected result: <strong className="text-emerald-400">Blocked</strong>.
              A pass-through means a policy gap needs fixing.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            {loading ? (
              <LoadingState message="Loading attack scenarios…" />
            ) : scenarios.length === 0 ? (
              <EmptyState
                icon={Bug}
                title="No scenarios loaded"
                description="Attack scenarios are seeded automatically. Try refreshing."
              />
            ) : (
              scenarios.map((scenario) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  onRun={handleRunScenario}
                  running={runningId === scenario.id}
                />
              ))
            )}
          </CardBody>
        </Card>

        {/* Anomaly detection / risk alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">Anomaly Detection Events</h2>
                {visibleAnomalies.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                    {visibleAnomalies.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowAcknowledged((v) => !v)}
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                {showAcknowledged ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showAcknowledged ? "Hide acknowledged" : "Show all"}
              </button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {loading ? (
              <div className="p-5"><LoadingState message="Loading anomaly events…" /></div>
            ) : visibleAnomalies.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={CheckCircle2}
                  title="No unacknowledged events"
                  description="No active anomaly events. Run attack scenarios to generate security events."
                />
              </div>
            ) : (
              <div>
                {visibleAnomalies.map((event, i) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 px-5 py-3"
                    style={{ borderBottom: i < visibleAnomalies.length - 1 ? "1px solid rgba(56,189,248,0.05)" : undefined }}
                  >
                    {event.acknowledged
                      ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-500" />
                      : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-xs font-semibold text-white">
                          {event.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </p>
                        <Badge className="badge-amber">{event.type}</Badge>
                        {event.agentName && (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{event.agentName}</span>
                        )}
                        {event.autoFroze && (
                          <Badge className="badge-red">Auto-frozen</Badge>
                        )}
                        {event.acknowledged && (
                          <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">Acknowledged</Badge>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{event.description}</p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatRelativeTime(event.detectedAt)}
                      </span>
                      {!event.acknowledged && (
                        <Button variant="ghost" size="xs" onClick={() => handleAcknowledge(event.id)}>
                          <XCircle className="w-3 h-3" /> Dismiss
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Foundry testing note */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)" }}>
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
          <p className="text-xs leading-relaxed text-blue-400">
            <strong>On-chain invariant testing:</strong> Deploy contracts and run{" "}
            <code className="font-mono">forge test --match-contract Invariant</code> to test
            the PolicyEnforcer and SmartWallet against invariant violations and fuzz inputs.
            See <code className="font-mono">/contracts/</code> for Foundry test suites.
          </p>
        </div>
      </div>
    </div>
  );
}
