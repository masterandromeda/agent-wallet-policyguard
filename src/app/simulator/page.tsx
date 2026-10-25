"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Button,
  AlertBanner,
  LoadingState,
  Spinner,
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";
import { apiGet, apiPost } from "@/lib/api-client";
import { formatUSD, formatRelativeTime } from "@/lib/utils";
import type { AttackScenario, Transaction } from "@/lib/types";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Play,
  PlayCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  Clock,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScenarioResult {
  scenario: AttackScenario;
  transaction: Transaction;
  passed: boolean;
}

interface ScenarioState {
  scenario: AttackScenario;
  running: boolean;
  result: ScenarioResult | null;
  error: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ATTACK_TYPE_LABELS: Record<AttackScenario["attackType"], string> = {
  excessive_spend: "Excessive Spend",
  unapproved_recipient: "Unapproved Recipient",
  expired_permission: "Expired Permission",
  prohibited_contract: "Prohibited Contract",
  rapid_fire: "Rapid-Fire",
};

const ATTACK_TYPE_COLORS: Record<AttackScenario["attackType"], string> = {
  excessive_spend: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  unapproved_recipient: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  expired_permission: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  prohibited_contract: "bg-red-500/10 text-red-400 border-red-500/20",
  rapid_fire: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

const AGENT_ID = "agt_01";

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SimulatorPage() {
  const [scenarios, setScenarios] = useState<ScenarioState[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAll, setRunningAll] = useState(false);

  // Fetch scenarios on mount
  useEffect(() => {
    apiGet<{ data: AttackScenario[] }>("/api/attack")
      .then((res) => {
        setScenarios(
          res.data.map((s) => ({ scenario: s, running: false, result: null, error: null }))
        );
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load scenarios";
        toast({ type: "error", title: "Failed to load scenarios", message: msg });
      })
      .finally(() => setLoading(false));
  }, []);

  const runScenario = useCallback(
    async (scenarioId: string) => {
      setScenarios((prev) =>
        prev.map((s) =>
          s.scenario.id === scenarioId
            ? { ...s, running: true, result: null, error: null }
            : s
        )
      );

      try {
        const res = await apiPost<{ data: ScenarioResult }>("/api/attack", {
          scenarioId,
          agentId: AGENT_ID,
        });

        const result = res.data;
        setScenarios((prev) =>
          prev.map((s) =>
            s.scenario.id === scenarioId
              ? { ...s, running: false, result, scenario: result.scenario }
              : s
          )
        );

        if (result.passed) {
          toast({
            type: "success",
            title: "Attack blocked ✓",
            message: result.scenario.name,
          });
        } else {
          toast({
            type: "error",
            title: "Policy bypass detected!",
            message: result.scenario.name,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Attack run failed";
        setScenarios((prev) =>
          prev.map((s) =>
            s.scenario.id === scenarioId
              ? { ...s, running: false, error: msg }
              : s
          )
        );
        toast({ type: "error", title: "Run failed", message: msg });
      }
    },
    []
  );

  const runAllScenarios = useCallback(async () => {
    setRunningAll(true);
    for (const s of scenarios) {
      await runScenario(s.scenario.id);
    }
    setRunningAll(false);
    toast({ type: "info", title: "All scenarios complete", message: "Check results above" });
  }, [scenarios, runScenario]);

  // Summary stats
  const ran = scenarios.filter((s) => s.result !== null);
  const passed = scenarios.filter((s) => s.result?.passed === true).length;
  const failed = scenarios.filter((s) => s.result?.passed === false).length;
  const allPassed = ran.length === scenarios.length && failed === 0;
  const anyFailed = failed > 0;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Security"
        title="Hijack Attack Simulator"
        subtitle="Adversarial policy testing"
        actions={
          <Button
            variant="primary"
            size="sm"
            loading={runningAll}
            disabled={loading || runningAll || scenarios.length === 0}
            onClick={runAllScenarios}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            {runningAll ? "Running All…" : "Run All Scenarios"}
          </Button>
        }
      />

      <div className="page-content space-y-5 fade-up">
        {/* Disclaimer */}
        <AlertBanner variant="info" icon={Info}>
          <strong>Controlled test scenarios — no real funds are at risk.</strong>{" "}
          Policy engine blocks are verified against expected outcomes. Each scenario
          targets a specific attack vector in the agent&apos;s authorization layer.
        </AlertBanner>

        {/* Summary Bar */}
        {ran.length > 0 && (
          <div
            className="flex items-center gap-4 px-5 py-3 rounded-xl"
            style={{
              background: anyFailed
                ? "rgba(244,63,94,0.07)"
                : "rgba(16,185,129,0.07)",
              border: `1px solid ${anyFailed ? "rgba(244,63,94,0.2)" : "rgba(16,185,129,0.2)"}`,
            }}
          >
            {anyFailed ? (
              <ShieldX className="w-5 h-5 text-rose-400 flex-shrink-0" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">
                {allPassed && ran.length === scenarios.length
                  ? "All attacks blocked — policy engine is enforcing correctly"
                  : anyFailed
                  ? `Policy bypass detected in ${failed} scenario${failed > 1 ? "s" : ""}!`
                  : `${passed}/${ran.length} scenarios passed`}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {ran.length} of {scenarios.length} scenarios run · {passed} passed · {failed} failed
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-center">
                <p className="text-xl font-bold text-emerald-400">{passed}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Passed</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-rose-400">{failed}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Failed</p>
              </div>
            </div>
          </div>
        )}

        {/* Scenarios Grid */}
        {loading ? (
          <LoadingState message="Loading attack scenarios…" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {scenarios.map(({ scenario, running, result, error }) => {
              const statusIcon =
                running ? (
                  <Loader2 className="w-4 h-4 text-[#22d3ee] animate-spin" />
                ) : result?.passed === true ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : result?.passed === false ? (
                  <XCircle className="w-4 h-4 text-rose-400" />
                ) : error ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <Clock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                );

              const cardBorder =
                result?.passed === true
                  ? "rgba(16,185,129,0.25)"
                  : result?.passed === false
                  ? "rgba(244,63,94,0.25)"
                  : running
                  ? "rgba(34,211,238,0.25)"
                  : "rgba(56,189,248,0.08)";

              return (
                <div
                  key={scenario.id}
                  className="solid-card flex flex-col overflow-hidden"
                  style={{ border: `1px solid ${cardBorder}`, transition: "border-color 0.3s" }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {statusIcon}
                        <h3 className="text-sm font-semibold text-white leading-tight">
                          {scenario.name}
                        </h3>
                      </div>
                      <Badge className={ATTACK_TYPE_COLORS[scenario.attackType]}>
                        {ATTACK_TYPE_LABELS[scenario.attackType]}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardBody className="flex flex-col gap-3 flex-1">
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {scenario.description}
                    </p>

                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Expected:
                      </span>
                      <Badge
                        className={
                          scenario.expectedOutcome === "blocked"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : scenario.expectedOutcome === "approved"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }
                      >
                        {scenario.expectedOutcome.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Result display */}
                    {running && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.15)" }}>
                        <Spinner className="w-3.5 h-3.5 text-[#22d3ee]" />
                        <span className="text-xs text-[#22d3ee]">Running attack simulation…</span>
                      </div>
                    )}

                    {result && !running && (
                      <div
                        className="px-3 py-2.5 rounded-lg"
                        style={{
                          background: result.passed
                            ? "rgba(16,185,129,0.07)"
                            : "rgba(244,63,94,0.07)",
                          border: `1px solid ${result.passed ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.2)"}`,
                        }}
                      >
                        <p
                          className="text-xs font-bold mb-1"
                          style={{ color: result.passed ? "#34d399" : "#f87171" }}
                        >
                          {result.passed ? "✓ BLOCKED AS EXPECTED" : "✗ POLICY BYPASS DETECTED"}
                        </p>
                        <div className="space-y-0.5">
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Amount:{" "}
                            <span className="text-white font-semibold">
                              {formatUSD(result.transaction.amountUSD)}
                            </span>
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Recipient:{" "}
                            <span className="text-white font-mono text-xs">
                              {result.transaction.toLabel ?? result.transaction.toAddress.slice(0, 14)}…
                            </span>
                          </p>
                          {result.transaction.blockReason && (
                            <p className="text-xs text-rose-400 mt-1 leading-snug">
                              {result.transaction.blockReason}
                            </p>
                          )}
                          {scenario.ranAt && (
                            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                              Ran {formatRelativeTime(scenario.ranAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {error && !running && (
                      <AlertBanner variant="error">
                        {error}
                      </AlertBanner>
                    )}

                    <div className="mt-auto pt-1">
                      <Button
                        variant={result?.passed === false ? "danger" : "secondary"}
                        size="sm"
                        loading={running}
                        disabled={running || runningAll}
                        onClick={() => runScenario(scenario.id)}
                        className="w-full"
                      >
                        <Play className="w-3 h-3" />
                        {result ? "Re-run Attack" : "Run Attack"}
                      </Button>
                    </div>
                  </CardBody>
                </div>
              );
            })}
          </div>
        )}

        {/* Security note */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-lg"
          style={{
            background: "rgba(139,92,246,0.06)",
            border: "1px solid rgba(139,92,246,0.18)",
          }}
        >
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#a78bfa" }} />
          <p className="text-xs leading-relaxed" style={{ color: "#a78bfa" }}>
            <strong>How this works:</strong> Each scenario POSTs to the real{" "}
            <code>/api/attack</code> endpoint, which runs the policy engine against
            crafted malicious parameters. A scenario &quot;passes&quot; when the engine produces
            the expected outcome (blocked / pending). Results are stored server-side and can
            be reviewed in the Transaction History.
          </p>
        </div>
      </div>
    </div>
  );
}
