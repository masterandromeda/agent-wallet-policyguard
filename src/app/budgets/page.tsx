"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DollarSign, RefreshCw, Pencil, Check, X, AlertTriangle, TrendingUp,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card, CardHeader, CardBody, Badge, Button, StatCard,
  AlertBanner, LoadingState, EmptyState, ProgressBar,
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";
import { apiGet, apiPatch } from "@/lib/api-client";
import { formatUSD, percentageOf } from "@/lib/utils";
import type { Agent } from "@/lib/types";

// ─── Inline edit row ──────────────────────────────────────────────────────────

interface BudgetRowProps {
  agent: Agent;
  onSave: (id: string, daily: number, monthly: number, perTx: number) => Promise<void>;
}

function BudgetRow({ agent, onSave }: BudgetRowProps) {
  const [editing, setEditing] = useState(false);
  const [daily, setDaily] = useState(String(agent.spendingBudget.dailyLimitUSD));
  const [monthly, setMonthly] = useState(String(agent.spendingBudget.monthlyLimitUSD));
  const [perTx, setPerTx] = useState(String(agent.spendingBudget.perTxLimitUSD));
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDaily(String(agent.spendingBudget.dailyLimitUSD));
    setMonthly(String(agent.spendingBudget.monthlyLimitUSD));
    setPerTx(String(agent.spendingBudget.perTxLimitUSD));
    setEditing(true);
  };

  const handleSave = async () => {
    const d = parseFloat(daily);
    const m = parseFloat(monthly);
    const p = parseFloat(perTx);
    if ([d, m, p].some((v) => isNaN(v) || v <= 0)) {
      toast({ type: "error", title: "Invalid values", message: "All limits must be positive numbers" });
      return;
    }
    setSaving(true);
    try {
      await onSave(agent.id, d, m, p);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const budget = agent.spendingBudget;
  const dailyPct   = percentageOf(budget.dailySpentUSD,   budget.dailyLimitUSD);
  const monthlyPct = percentageOf(budget.monthlySpentUSD, budget.monthlyLimitUSD);

  const inputStyle = {
    background: "rgba(7,16,32,0.9)",
    border: "1px solid rgba(56,189,248,0.18)",
    color: "var(--text-primary)" as const,
    caretColor: "#22d3ee",
  };

  const isNearLimit = dailyPct >= 85 || monthlyPct >= 85;
  const statusClass = agent.status === "active"
    ? "badge-green" : agent.status === "suspended"
    ? "badge-red" : "badge-amber";

  return (
    <div
      className="px-5 py-4 rounded-xl transition-all"
      style={{
        background: isNearLimit ? "rgba(245,158,11,0.04)" : "rgba(7,16,32,0.6)",
        border: `1px solid ${isNearLimit ? "rgba(245,158,11,0.20)" : "rgba(56,189,248,0.08)"}`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{agent.name}</p>
          <Badge className={statusClass} dot>{agent.status}</Badge>
          {isNearLimit && (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" aria-label="Near spending limit" />
          )}
        </div>
        {!editing ? (
          <Button variant="ghost" size="xs" onClick={startEdit} disabled={agent.status === "suspended"}>
            <Pencil className="w-3 h-3" /> Edit
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button variant="secondary" size="xs" loading={saving} onClick={handleSave}>
              <Check className="w-3 h-3" /> Save
            </Button>
            <Button variant="ghost" size="xs" disabled={saving} onClick={() => setEditing(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Budget bars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Daily */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Daily</span>
            {editing ? (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span>
                <input
                  type="number" className="w-20 rounded px-2 py-0.5 text-xs outline-none text-right"
                  style={inputStyle} value={daily} onChange={(e) => setDaily(e.target.value)} min="1" step="100"
                />
              </div>
            ) : (
              <span className="text-xs tabular-nums text-white">
                {formatUSD(budget.dailySpentUSD)}{" "}
                <span style={{ color: "var(--text-muted)" }}>/ {formatUSD(budget.dailyLimitUSD)}</span>
              </span>
            )}
          </div>
          <ProgressBar
            value={dailyPct}
            variant={dailyPct >= 90 ? "danger" : dailyPct >= 75 ? "warn" : "default"}
            showLabel
          />
        </div>

        {/* Monthly */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Monthly</span>
            {editing ? (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span>
                <input
                  type="number" className="w-20 rounded px-2 py-0.5 text-xs outline-none text-right"
                  style={inputStyle} value={monthly} onChange={(e) => setMonthly(e.target.value)} min="1" step="500"
                />
              </div>
            ) : (
              <span className="text-xs tabular-nums text-white">
                {formatUSD(budget.monthlySpentUSD)}{" "}
                <span style={{ color: "var(--text-muted)" }}>/ {formatUSD(budget.monthlyLimitUSD)}</span>
              </span>
            )}
          </div>
          <ProgressBar
            value={monthlyPct}
            variant={monthlyPct >= 90 ? "danger" : monthlyPct >= 75 ? "warn" : "default"}
            showLabel
          />
        </div>

        {/* Per-transaction */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Per-Tx Limit</span>
            {editing ? (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span>
                <input
                  type="number" className="w-20 rounded px-2 py-0.5 text-xs outline-none text-right"
                  style={inputStyle} value={perTx} onChange={(e) => setPerTx(e.target.value)} min="1" step="50"
                />
              </div>
            ) : (
              <span className="text-xs tabular-nums font-semibold text-white">
                {formatUSD(budget.perTxLimitUSD)}
              </span>
            )}
          </div>
          <div className="h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: "100%", background: "rgba(34,211,238,0.3)" }} />
          </div>
          {!editing && (
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>max per transaction</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ data: Agent[] }>("/api/agents");
      setAgents(res.data ?? []);
    } catch {
      toast({ type: "error", title: "Failed to load agents" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleSave = useCallback(
    async (agentId: string, dailyLimitUSD: number, monthlyLimitUSD: number, perTxLimitUSD: number) => {
      try {
        const agent = agents.find((a) => a.id === agentId);
        if (!agent) return;
        const updated = {
          ...agent,
          spendingBudget: {
            ...agent.spendingBudget,
            dailyLimitUSD,
            monthlyLimitUSD,
            perTxLimitUSD,
          },
        };
        await apiPatch(`/api/agents/${agentId}`, { spendingBudget: updated.spendingBudget });
        setAgents((prev) => prev.map((a) => (a.id === agentId ? updated : a)));
        toast({ type: "success", title: "Budget updated", message: agent.name });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Update failed";
        toast({ type: "error", title: "Update failed", message: msg });
        throw err;
      }
    },
    [agents]
  );

  // Aggregate stats
  const active = agents.filter((a) => a.status === "active");
  const totalDaily   = active.reduce((s, a) => s + a.spendingBudget.dailyLimitUSD, 0);
  const totalSpent   = active.reduce((s, a) => s + a.spendingBudget.dailySpentUSD, 0);
  const nearLimit    = active.filter((a) =>
    percentageOf(a.spendingBudget.dailySpentUSD, a.spendingBudget.dailyLimitUSD) >= 80
  ).length;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Finance"
        title="Spending Budgets"
        subtitle="Daily, monthly and per-transaction limits per agent"
        actions={
          <Button variant="ghost" size="sm" onClick={loadAgents} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="page-content space-y-5 fade-up">
        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Daily Budget"
            value={loading ? "—" : formatUSD(totalDaily)}
            icon={DollarSign}
            accent="cyan"
            subtext={`Across ${active.length} active agents`}
          />
          <StatCard
            label="Spent Today"
            value={loading ? "—" : formatUSD(totalSpent)}
            icon={TrendingUp}
            accent="amber"
            subtext={`${totalDaily > 0 ? ((totalSpent / totalDaily) * 100).toFixed(0) : 0}% of daily budget used`}
          />
          <StatCard
            label="Near Limit"
            value={loading ? "—" : String(nearLimit)}
            icon={AlertTriangle}
            accent={nearLimit > 0 ? "red" : "green"}
            subtext="Agents ≥80% of daily limit"
          />
        </div>

        {nearLimit > 0 && (
          <AlertBanner variant="warning" icon={AlertTriangle}>
            <strong>{nearLimit} agent{nearLimit > 1 ? "s are" : " is"} near the daily spending limit.</strong>{" "}
            Review budgets or the agent will be blocked when the limit is reached.
          </AlertBanner>
        )}

        {/* Per-agent budget cards */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#22d3ee]" />
              Agent Budgets
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(34,211,238,0.10)", color: "#22d3ee" }}>
                {agents.length}
              </span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Click Edit to update limits. Changes take effect immediately on the server-side policy engine.
            </p>
          </CardHeader>
          <CardBody className="space-y-3">
            {loading ? (
              <LoadingState message="Loading agent budgets…" />
            ) : agents.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title="No agents found"
                description="Create an agent in AI Agent Management to configure spending budgets."
              />
            ) : (
              agents.map((agent) => (
                <BudgetRow key={agent.id} agent={agent} onSave={handleSave} />
              ))
            )}
          </CardBody>
        </Card>

        <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)" }}>
          <DollarSign className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
          <p className="text-xs leading-relaxed text-blue-400">
            <strong>Policy enforcement:</strong> Daily and per-transaction limits are enforced server-side in the
            policy engine (9 rules). On-chain enforcement is available once PolicyEnforcer contracts are deployed.
            Limits reset daily at 00:00 UTC and monthly on the 1st.
          </p>
        </div>
      </div>
    </div>
  );
}
