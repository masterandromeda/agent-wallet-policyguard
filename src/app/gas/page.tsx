"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap,
  RefreshCw,
  Info,
  Pencil,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Button,
  AlertBanner,
  LoadingState,
  EmptyState,
  ProgressBar,
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";
import { apiGet, apiPatch } from "@/lib/api-client";
import { formatUSD, percentageOf } from "@/lib/utils";
import type { Agent, GasQuota } from "@/lib/types";

// ─── Per-Agent Gas Card ────────────────────────────────────────────────────────

interface GasCardProps {
  agent: Agent;
  quota: GasQuota | null;
  onSave: (agentId: string, daily: number, monthly: number) => Promise<void>;
}

function GasCard({ agent, quota, onSave }: GasCardProps) {
  const [editing, setEditing] = useState(false);
  const [dailyInput, setDailyInput] = useState("");
  const [monthlyInput, setMonthlyInput] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDailyInput(String(quota?.dailyGasLimitUSD ?? 10));
    setMonthlyInput(String(quota?.monthlyGasLimitUSD ?? 200));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    const daily = parseFloat(dailyInput);
    const monthly = parseFloat(monthlyInput);
    if (isNaN(daily) || isNaN(monthly) || daily <= 0 || monthly <= 0) {
      toast({ type: "error", title: "Invalid values", message: "Limits must be positive numbers" });
      return;
    }
    setSaving(true);
    try {
      await onSave(agent.id, daily, monthly);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const dailyPct = quota
    ? percentageOf(quota.dailyGasUsedUSD, quota.dailyGasLimitUSD)
    : 0;
  const monthlyPct = quota
    ? percentageOf(quota.monthlyGasUsedUSD, quota.monthlyGasLimitUSD)
    : 0;

  const inputStyle = {
    background: "rgba(7,16,32,0.9)",
    border: "1px solid rgba(56,189,248,0.18)",
    color: "var(--text-primary)" as const,
    caretColor: "#22d3ee",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{agent.name}</p>
            <Badge
              className={
                quota?.paymasterConfigured
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-slate-500/10 text-slate-400 border-slate-500/20"
              }
            >
              {quota?.paymasterConfigured ? "Paymaster: Active" : "Paymaster: Not configured"}
            </Badge>
          </div>
          {!editing ? (
            <Button variant="ghost" size="xs" onClick={startEdit}>
              <Pencil className="w-3 h-3" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="secondary" size="xs" loading={saving} onClick={handleSave}>
                <Check className="w-3 h-3" />
                Save
              </Button>
              <Button variant="ghost" size="xs" disabled={saving} onClick={cancelEdit}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        {/* Daily */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Daily Gas Limit
            </span>
            {editing ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span>
                <input
                  type="number"
                  className="w-20 rounded px-2 py-0.5 text-xs outline-none text-right"
                  style={inputStyle}
                  value={dailyInput}
                  onChange={(e) => setDailyInput(e.target.value)}
                  min="0"
                  step="1"
                />
              </div>
            ) : (
              <span className="text-xs tabular-nums text-white font-semibold">
                {formatUSD(quota?.dailyGasUsedUSD ?? 0)}{" "}
                <span style={{ color: "var(--text-muted)" }}>
                  / {formatUSD(quota?.dailyGasLimitUSD ?? 10)}
                </span>
              </span>
            )}
          </div>
          <ProgressBar value={dailyPct} showLabel />
        </div>

        {/* Monthly */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Monthly Gas Limit
            </span>
            {editing ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span>
                <input
                  type="number"
                  className="w-20 rounded px-2 py-0.5 text-xs outline-none text-right"
                  style={inputStyle}
                  value={monthlyInput}
                  onChange={(e) => setMonthlyInput(e.target.value)}
                  min="0"
                  step="10"
                />
              </div>
            ) : (
              <span className="text-xs tabular-nums text-white font-semibold">
                {formatUSD(quota?.monthlyGasUsedUSD ?? 0)}{" "}
                <span style={{ color: "var(--text-muted)" }}>
                  / {formatUSD(quota?.monthlyGasLimitUSD ?? 200)}
                </span>
              </span>
            )}
          </div>
          <ProgressBar value={monthlyPct} showLabel />
        </div>

        {/* Total sponsored */}
        {quota && quota.totalSponsoredUSD > 0 && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Total sponsored:{" "}
            <span className="text-white font-semibold tabular-nums">
              {formatUSD(quota.totalSponsoredUSD)}
            </span>
          </p>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GasPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [quotas, setQuotas] = useState<Record<string, GasQuota>>({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const agentRes = await apiGet<{ data: Agent[] }>("/api/agents");
      const agentList = agentRes.data ?? [];
      setAgents(agentList);

      // Fetch quotas in parallel for all agents
      const quotaResults = await Promise.allSettled(
        agentList.map((a) =>
          apiGet<{ data: GasQuota }>("/api/gas", { agentId: a.id }).then((r) => ({
            agentId: a.id,
            quota: r.data,
          }))
        )
      );

      const map: Record<string, GasQuota> = {};
      for (const result of quotaResults) {
        if (result.status === "fulfilled") {
          map[result.value.agentId] = result.value.quota;
        }
      }
      setQuotas(map);
    } catch {
      toast({ type: "error", title: "Failed to load gas data" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = useCallback(
    async (agentId: string, dailyGasLimitUSD: number, monthlyGasLimitUSD: number) => {
      try {
        const res = await apiPatch<{ data: GasQuota }>("/api/gas", {
          agentId,
          dailyGasLimitUSD,
          monthlyGasLimitUSD,
        });
        setQuotas((prev) => ({ ...prev, [agentId]: res.data }));
        toast({ type: "success", title: "Gas quota updated" });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Update failed";
        toast({ type: "error", title: "Update failed", message: msg });
        throw err;
      }
    },
    []
  );

  // Summary
  const allQuotas = Object.values(quotas);
  const totalSponsoredThisMonth = allQuotas.reduce((s, q) => s + q.monthlyGasUsedUSD, 0);
  const totalMonthlyLimit = allQuotas.reduce((s, q) => s + q.monthlyGasLimitUSD, 0);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Finance"
        title="Gas Sponsorship & Quotas"
        subtitle="Paymaster configuration and gas budgets"
        actions={
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="page-content space-y-5 fade-up">
        {/* Disclaimer */}
        <AlertBanner variant="warning" icon={AlertTriangle}>
          Gas sponsorship requires a configured ERC-4337 Paymaster. Set{" "}
          <code className="font-mono text-amber-300">PAYMASTER_ADDRESS</code> in{" "}
          <code className="font-mono text-amber-300">.env.local</code> to enable on-chain gas
          sponsorship.
        </AlertBanner>

        {/* Summary card */}
        {!loading && allQuotas.length > 0 && (
          <div
            className="flex items-center gap-6 px-5 py-4 rounded-xl"
            style={{
              background: "rgba(34,211,238,0.05)",
              border: "1px solid rgba(34,211,238,0.12)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(34,211,238,0.12)" }}
              >
                <Zap className="w-5 h-5 text-[#22d3ee]" />
              </div>
              <div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Total Sponsored This Month
                </p>
                <p className="text-xl font-bold text-white tabular-nums">
                  {formatUSD(totalSponsoredThisMonth)}
                </p>
              </div>
            </div>
            <div className="h-10 w-px" style={{ background: "rgba(56,189,248,0.12)" }} />
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Monthly Limit (all agents)
              </p>
              <p className="text-xl font-bold text-white tabular-nums">
                {formatUSD(totalMonthlyLimit)}
              </p>
            </div>
            <div className="flex-1" />
            <div className="text-right">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Agents with quotas</p>
              <p className="text-xl font-bold text-white">{allQuotas.length}</p>
            </div>
          </div>
        )}

        {/* Per-agent gas cards */}
        {loading ? (
          <LoadingState message="Loading gas quotas…" />
        ) : agents.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={Zap}
                title="No agents found"
                description="Create an agent first to configure gas quotas."
              />
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <GasCard
                key={agent.id}
                agent={agent}
                quota={quotas[agent.id] ?? null}
                onSave={handleSave}
              />
            ))}
          </div>
        )}

        {/* Info note */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{
            background: "rgba(59,130,246,0.05)",
            border: "1px solid rgba(59,130,246,0.15)",
          }}
        >
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
          <p className="text-xs leading-relaxed text-blue-400">
            <strong>ERC-4337 Paymaster:</strong> Gas fees are paid by the Paymaster contract on
            behalf of agents. Daily limits reset at 00:00 UTC. Monthly limits reset on the 1st.
            Quotas are enforced before each UserOperation is submitted to the bundler.
          </p>
        </div>
      </div>
    </div>
  );
}
