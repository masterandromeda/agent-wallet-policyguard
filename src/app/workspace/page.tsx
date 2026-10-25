"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card, CardHeader, CardBody, Badge, Button,
  AlertBanner, LoadingState, ProgressBar,
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";
import { useSSE } from "@/hooks/useSSE";
import { apiGet, apiPost } from "@/lib/api-client";
import { formatUSD, formatRelativeTime, txStatusColor, agentStatusColor } from "@/lib/utils";
import type { Agent, Transaction } from "@/lib/types";
import {
  Bot, Play, CheckCircle2, XCircle, Clock, Loader2, Info, Zap,
  ChevronRight, History, ShieldCheck, ShieldX, AlertTriangle,
  RefreshCw, Activity, ArrowRight,
} from "lucide-react";

// ─── Task Parser ─────────────────────────────────────────────────────────────

interface ParsedTask {
  amount: number;
  recipient: string;
  purpose: string;
  toAddress: string;
}

function parseTask(task: string): ParsedTask | null {
  const dollarMatch = task.match(/\$(\d+(?:\.\d+)?)/);
  const wordMatch   = task.match(/(\d+(?:\.\d+)?)\s*(?:USD|dollars?|usd)/i);
  const amountStr   = dollarMatch ? dollarMatch[1] : wordMatch ? wordMatch[1] : null;
  if (!amountStr) return null;
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return null;

  const toMatch   = task.match(/\bto\s+([A-Za-z0-9._\-]+(?:\s+[A-Za-z0-9._\-]+){0,2})/i);
  const recipient = toMatch ? toMatch[1].trim() : "Unknown Recipient";
  const forMatch  = task.match(/\bfor\s+(.+)/i);
  const purpose   = forMatch ? forMatch[1].trim() : "general payment";
  const seed      = recipient.toLowerCase().replace(/\s+/g, "").slice(0, 8).padEnd(8, "0");
  const toAddress = `0xDEMO${seed.toUpperCase()}0000000000000000000000`;

  return { amount, recipient, purpose, toAddress };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExecutionStep {
  id: number;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
  timestamp?: string;
}

interface TaskRun {
  id: string;
  task: string;
  amount: number;
  recipient: string;
  purpose: string;
  outcome: "approved" | "blocked" | "pending" | "error";
  blockReason?: string;
  riskScore?: number;
  riskFlags?: string[];
  ranAt: string;
}

// ─── Live Activity Event ─────────────────────────────────────────────────────

interface ActivityEvent {
  id: string;
  type: "task_received" | "parsing" | "policy_check" | "decision" | "error" | "budget_update";
  label: string;
  detail?: string;
  status: "info" | "success" | "warning" | "error";
  timestamp: string;
}

// ─── Step Row ────────────────────────────────────────────────────────────────

function StepRow({ step }: { step: ExecutionStep }) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl"
      style={{
        background:
          step.status === "error"   ? "rgba(244,63,94,0.06)"   :
          step.status === "done"    ? "rgba(16,185,129,0.06)"  :
          step.status === "running" ? "rgba(34,211,238,0.05)"  :
          "rgba(7,16,32,0.5)",
        border: `1px solid ${
          step.status === "error"   ? "rgba(244,63,94,0.15)"  :
          step.status === "done"    ? "rgba(16,185,129,0.15)" :
          step.status === "running" ? "rgba(34,211,238,0.12)" :
          "rgba(56,189,248,0.06)"
        }`,
      }}
    >
      <div className="flex-shrink-0 mt-0.5">
        {step.status === "running" && <Loader2 className="w-4 h-4 text-[#22d3ee] animate-spin" />}
        {step.status === "done"    && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        {step.status === "error"   && <XCircle className="w-4 h-4 text-rose-400" />}
        {step.status === "pending" && <Clock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" style={{
          color:
            step.status === "error"   ? "#f87171" :
            step.status === "done"    ? "#34d399" :
            step.status === "running" ? "#22d3ee" :
            "var(--text-muted)",
        }}>
          {step.label}
        </p>
        {step.detail && (
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {step.detail}
          </p>
        )}
      </div>
      {step.timestamp && (
        <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
          {new Date(step.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      )}
    </div>
  );
}

// ─── Policy Decision Card ─────────────────────────────────────────────────────

function PolicyDecisionCard({ tx }: { tx: Transaction }) {
  const isBlocked  = tx.status === "blocked";
  const isApproved = tx.status === "approved";

  const color  = isBlocked ? "#f43f5e" : isApproved ? "#10b981" : "#f59e0b";
  const bg     = isBlocked ? "rgba(244,63,94,0.07)"  : isApproved ? "rgba(16,185,129,0.07)" : "rgba(245,158,11,0.07)";
  const border = isBlocked ? "rgba(244,63,94,0.22)"  : isApproved ? "rgba(16,185,129,0.22)" : "rgba(245,158,11,0.22)";
  const Icon   = isBlocked ? ShieldX : isApproved ? ShieldCheck : AlertTriangle;
  const label  = isBlocked ? "BLOCKED — Policy Violation" : isApproved ? "ALLOWED — Policy Passed" : "PENDING — Awaiting Owner Approval";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color }} />
          <h3 className="text-sm font-semibold text-white">Policy Decision</h3>
        </div>
      </CardHeader>
      <CardBody>
        <div className="px-4 py-4 rounded-xl space-y-3" style={{ background: bg, border: `1px solid ${border}` }}>
          <p className="text-base font-bold" style={{ color }}>{label}</p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: "Amount",     value: formatUSD(tx.amountUSD) },
              { label: "Recipient",  value: tx.toLabel ?? tx.toAddress.slice(0, 14) + "…" },
              { label: "Risk Score", value: `${tx.riskScore}/100 (advisory)` },
              ...(tx.policyName ? [{ label: "Policy", value: tx.policyName }] : []),
              { label: "Network",    value: tx.network },
              { label: "Simulated",  value: "Yes — demo mode" },
            ].map(({ label: l, value: v }) => (
              <div key={l}>
                <p style={{ color: "var(--text-muted)" }}>{l}</p>
                <p className="text-white font-semibold mt-0.5">{v}</p>
              </div>
            ))}
          </div>

          {tx.blockReason && (
            <div className="pt-2 border-t" style={{ borderColor: "rgba(244,63,94,0.15)" }}>
              <p className="text-xs font-semibold text-rose-400 mb-1">Block reason</p>
              <p className="text-xs leading-relaxed" style={{ color: "#f87171" }}>{tx.blockReason}</p>
            </div>
          )}

          {tx.riskFlags && tx.riskFlags.length > 0 && (
            <div className="pt-2 border-t" style={{ borderColor: "rgba(245,158,11,0.15)" }}>
              <p className="text-xs font-semibold text-amber-400 mb-1.5">Policy flags</p>
              <div className="flex flex-wrap gap-1">
                {tx.riskFlags.map((f) => (
                  <span key={f} className="text-xs px-2 py-0.5 rounded-full badge-amber">{f}</span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs font-mono opacity-50" style={{ color: "var(--text-muted)", fontSize: 10 }}>
            {tx.id}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Live Activity Feed ───────────────────────────────────────────────────────

function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const statusIcon = {
    info:    <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />,
    success: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />,
    error:   <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />,
  };

  if (events.length === 0) {
    return (
      <div className="py-6 flex flex-col items-center gap-2">
        <Activity className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Run a task to see live agent events
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((ev, i) => (
        <div
          key={ev.id}
          className="flex items-start gap-3 px-4 py-2.5"
          style={{ borderBottom: i < events.length - 1 ? "1px solid rgba(56,189,248,0.05)" : undefined }}
        >
          {statusIcon[ev.status]}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white">{ev.label}</p>
            {ev.detail && (
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{ev.detail}</p>
            )}
          </div>
          <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)", opacity: 0.5, fontSize: 10 }}>
            {new Date(ev.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const AGENT_ID = "agt_01";

export default function WorkspacePage() {
  const [agent,        setAgent]        = useState<Agent | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const [recentTxs,    setRecentTxs]    = useState<Transaction[]>([]);
  const [sseConnected, setSseConnected] = useState(false);

  const [taskInput,  setTaskInput]  = useState("");
  const [running,    setRunning]    = useState(false);
  const [steps,      setSteps]      = useState<ExecutionStep[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [lastTx,     setLastTx]     = useState<Transaction | null>(null);
  const [history,    setHistory]    = useState<TaskRun[]>([]);
  const [liveEvents, setLiveEvents] = useState<ActivityEvent[]>([]);

  const runCountRef = useRef(0);

  const addLiveEvent = useCallback((event: Omit<ActivityEvent, "id" | "timestamp">) => {
    const ev: ActivityEvent = {
      ...event,
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      timestamp: new Date().toISOString(),
    };
    setLiveEvents((prev) => [ev, ...prev].slice(0, 20));
  }, []);

  const loadAgent = useCallback(async () => {
    try {
      const res = await apiGet<{ data: Agent }>(`/api/agents/${AGENT_ID}`);
      setAgent(res.data);
    } catch {
      toast({ type: "warning", title: "Agent not found", message: `Could not load ${AGENT_ID}` });
    } finally {
      setAgentLoading(false);
    }
  }, []);

  const loadRecentTxs = useCallback(async () => {
    try {
      const res = await apiGet<{ data: Transaction[] }>("/api/transactions", { agentId: AGENT_ID });
      setRecentTxs((res.data ?? []).slice(0, 6));
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    loadAgent();
    loadRecentTxs();
  }, [loadAgent, loadRecentTxs]);

  // SSE — show live events from server broadcasts
  useSSE("owner", {
    init: () => setSseConnected(true),
    task_new: (e) => {
      const task = e.payload as { agentId: string; merchant: string; amountUSD: number; requesterId: string; requesterName: string };
      if (task.agentId === AGENT_ID) {
        addLiveEvent({
          type: "task_received",
          label: `Customer request received: ${formatUSD(task.amountUSD)} → ${task.merchant}`,
          detail: `From: ${task.requesterName}`,
          status: "info",
        });
      }
    },
    task_update: (e) => {
      const task = e.payload as { agentId: string; status: string; amountUSD: number; merchant: string; blockReason?: string; result?: string };
      if (task.agentId === AGENT_ID) {
        addLiveEvent({
          type: "decision",
          label: `Task ${task.status.replace("_", " ")}: ${formatUSD(task.amountUSD)} → ${task.merchant}`,
          detail: task.blockReason ?? task.result ?? undefined,
          status: task.status === "completed" ? "success" : task.status === "blocked" || task.status === "rejected" ? "error" : "warning",
        });
      }
    },
    transaction_new: (e) => {
      const tx = e.payload as Transaction;
      if (tx.agentId === AGENT_ID) {
        addLiveEvent({
          type: "decision",
          label: `Transaction created: ${tx.status.toUpperCase()} ${formatUSD(tx.amountUSD)} → ${tx.toLabel ?? tx.toAddress.slice(0, 12) + "…"}`,
          detail: tx.blockReason ?? undefined,
          status: tx.status === "approved" ? "success" : tx.status === "blocked" ? "error" : "warning",
        });
        loadRecentTxs();
        loadAgent();
      }
    },
    transaction_update: (e) => {
      const tx = e.payload as Transaction;
      if (tx.agentId === AGENT_ID) {
        addLiveEvent({
          type: "decision",
          label: `Transaction updated: ${tx.status}: ${formatUSD(tx.amountUSD)} → ${tx.toLabel ?? tx.toAddress.slice(0, 12) + "…"}`,
          detail: tx.blockReason ?? undefined,
          status: tx.status === "approved" ? "success" : tx.status === "blocked" ? "error" : "warning",
        });
        loadRecentTxs();
        loadAgent();
      }
    },
    agent_update: (e) => {
      const ag = e.payload as Agent;
      if (ag.id === AGENT_ID) {
        setAgent(ag);
        addLiveEvent({
          type: "budget_update",
          label: `Agent budget updated: ${formatUSD(ag.spendingBudget.dailySpentUSD)} / ${formatUSD(ag.spendingBudget.dailyLimitUSD)} daily`,
          status: "info",
        });
      }
    },
    agent_frozen: (e) => {
      const payload = e.payload as { agent: Agent };
      if (payload?.agent?.id === AGENT_ID) {
        setAgent(payload.agent);
        addLiveEvent({ type: "error", label: "Agent frozen — all tasks halted", detail: "Emergency freeze applied", status: "error" });
      }
    },
  });

  const addStep = useCallback(
    (id: number, label: string, status: ExecutionStep["status"], detail?: string) => {
      const ts = new Date().toISOString();
      setSteps((prev) => {
        const existing = prev.findIndex((s) => s.id === id);
        const next: ExecutionStep = { id, label, status, detail, timestamp: ts };
        if (existing >= 0) { const u = [...prev]; u[existing] = next; return u; }
        return [...prev, next];
      });
    },
    []
  );

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const runTask = useCallback(async () => {
    setParseError(null);
    setSteps([]);
    setLastTx(null);
    const trimmed = taskInput.trim();
    if (!trimmed) return;
    setRunning(true);
    runCountRef.current += 1;
    const runId = runCountRef.current;

    addLiveEvent({ type: "task_received", label: `Task received: "${trimmed.slice(0, 60)}"`, status: "info" });

    // Step 1 – Parse
    addStep(1, "Parsing natural language task…", "running");
    addLiveEvent({ type: "parsing", label: "Parsing task with regex rule engine", detail: "AI/LLM not configured — using pattern matching", status: "info" });
    await delay(600);

    const parsed = parseTask(trimmed);
    if (!parsed) {
      addStep(1, "Parsing natural language task…", "error", "Could not extract amount from input");
      addLiveEvent({ type: "error", label: "Parse failed — no amount found", detail: "Format: 'Pay $50 to Stripe for API credits'", status: "error" });
      setParseError("Could not parse amount. Try: 'Pay $50 to Stripe for API credits'");
      setRunning(false);
      return;
    }
    addStep(1, "Parsing natural language task…", "done", `Amount: ${formatUSD(parsed.amount)} · Recipient: ${parsed.recipient}`);
    addLiveEvent({ type: "parsing", label: `Intent extracted: ${formatUSD(parsed.amount)} → ${parsed.recipient}`, detail: `Purpose: ${parsed.purpose}`, status: "success" });

    // Step 2 – Identify
    addStep(2, `Intent: transfer ${formatUSD(parsed.amount)} → ${parsed.recipient}`, "running");
    await delay(400);
    addStep(2, `Intent: transfer ${formatUSD(parsed.amount)} → ${parsed.recipient}`, "done", `Purpose: ${parsed.purpose}`);

    // Step 3 – Policy check
    addStep(3, "Submitting to 9-rule policy engine…", "running");
    addLiveEvent({ type: "policy_check", label: "Checking agent limits, allowlists, time window…", detail: "Server-side enforcement — not UI validation", status: "info" });
    await delay(700);

    let tx: Transaction;
    try {
      const res = await apiPost<{ data: Transaction }>("/api/transactions", {
        agentId: AGENT_ID,
        toAddress: parsed.toAddress,
        toLabel: parsed.recipient,
        amountUSD: parsed.amount,
        purpose: parsed.purpose,
        network: "simulated",
      });
      tx = res.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      addStep(3, "Submitting to policy engine…", "error", msg);
      addLiveEvent({ type: "error", label: "Policy engine request failed", detail: msg, status: "error" });
      toast({ type: "error", title: "Transaction failed", message: msg });
      setRunning(false);
      return;
    }

    addStep(3, "Policy engine evaluated transaction", "done",
      tx.riskFlags.length > 0 ? `Flags: ${tx.riskFlags.join(", ")}` : "All checks passed"
    );

    // Step 4 – Result
    const outcomeLabel =
      tx.status === "approved" ? "✓ APPROVED — transaction permitted by all policy rules" :
      tx.status === "blocked"  ? "✗ BLOCKED — one or more policy rules violated" :
      "⏳ PENDING — escalated for owner approval";

    addStep(4, outcomeLabel, tx.status === "blocked" ? "error" : "done", tx.blockReason ?? undefined);

    addLiveEvent({
      type: "decision",
      label: `Policy decision: ${tx.status.toUpperCase()} · ${formatUSD(tx.amountUSD)}`,
      detail: tx.blockReason ?? (tx.riskFlags.length > 0 ? `Risk flags: ${tx.riskFlags.join(", ")}` : `Risk score: ${tx.riskScore}/100`),
      status: tx.status === "approved" ? "success" : tx.status === "blocked" ? "error" : "warning",
    });

    setLastTx(tx);

    // Reload agent budget and recent transactions
    try {
      const [agentRes] = await Promise.allSettled([
        apiGet<{ data: Agent }>(`/api/agents/${AGENT_ID}`),
        loadRecentTxs(),
      ]);
      if (agentRes.status === "fulfilled") {
        setAgent(agentRes.value.data);
        addLiveEvent({
          type: "budget_update",
          label: `Budget updated: ${formatUSD(agentRes.value.data.spendingBudget.dailySpentUSD)} of ${formatUSD(agentRes.value.data.spendingBudget.dailyLimitUSD)} daily`,
          status: "info",
        });
      }
    } catch { /* non-critical */ }

    const run: TaskRun = {
      id: tx.id,
      task: trimmed,
      amount: parsed.amount,
      recipient: parsed.recipient,
      purpose: parsed.purpose,
      outcome: tx.status === "failed" ? "error" : tx.status,
      blockReason: tx.blockReason,
      riskScore: tx.riskScore,
      riskFlags: tx.riskFlags,
      ranAt: new Date().toISOString(),
    };
    setHistory((prev) => [run, ...prev].slice(0, 8));

    if (tx.status === "approved") {
      toast({ type: "success", title: "Payment approved", message: `${formatUSD(parsed.amount)} to ${parsed.recipient}` });
    } else if (tx.status === "blocked") {
      toast({ type: "error", title: "Payment blocked", message: tx.blockReason ?? "Policy violation" });
    } else {
      toast({ type: "warning", title: "Pending approval", message: `${formatUSD(parsed.amount)} to ${parsed.recipient}` });
    }
    setRunning(false);
  }, [taskInput, addStep, addLiveEvent, loadRecentTxs]);

  const budget    = agent?.spendingBudget;
  const dailyPct  = budget ? Math.min(100, (budget.dailySpentUSD  / budget.dailyLimitUSD)  * 100) : 0;
  const monthlyPct= budget ? Math.min(100, (budget.monthlySpentUSD/ budget.monthlyLimitUSD)* 100) : 0;

  const EXAMPLES = [
    "Pay $50 to OpenAI for API credits",
    "Send $200 to Stripe for subscription",
    "Transfer $99 to GitHub for SaaS license",
    "Pay $5000 to BigSupplier for hardware", // will be blocked
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="AI Agent"
        title="Live Agent Workspace"
        subtitle="Observe the full autonomous agent decision chain in real time"
        actions={
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              sseConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full bg-current ${sseConnected ? "animate-pulse" : ""}`} />
              {sseConnected ? "Live SSE" : "Demo"}
            </div>
            <Button variant="ghost" size="sm" onClick={() => { loadAgent(); loadRecentTxs(); }}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        }
      />

      <div className="page-content fade-up">
        {/* Disclaimer */}
        <AlertBanner variant="warning" icon={Info}>
          <strong>Rule-based task parser — AI/LLM API not configured.</strong>{" "}
          Connect <code className="font-mono text-amber-300">OPENAI_API_KEY</code> for full natural language
          understanding. Tasks are currently parsed with regex pattern matching.
          All policy decisions are enforced server-side, not in the browser.
        </AlertBanner>

        {/* ── Main Grid: Task Composer (left) + Live Activity (right) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Left: task composer + execution trace */}
          <div className="xl:col-span-2 space-y-5">

            {/* ── Task Composer ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <Bot className="w-4 h-4 text-[#22d3ee]" />
                  <h3 className="text-sm font-semibold text-white">Task Composer</h3>
                  {agent && (
                    <Badge className={agentStatusColor(agent.status)} dot>
                      {agent.name}
                    </Badge>
                  )}
                  <span className="text-xs ml-auto font-mono" style={{ color: "var(--text-muted)" }}>
                    {AGENT_ID}
                  </span>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                    Natural Language Task
                  </label>
                  <textarea
                    className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none transition-all"
                    style={{
                      background: "rgba(7,16,32,0.9)",
                      border: "1px solid rgba(56,189,248,0.15)",
                      color: "var(--text-primary)",
                      caretColor: "#22d3ee",
                      minHeight: 80,
                      lineHeight: 1.6,
                    }}
                    placeholder="e.g. Pay $50 to OpenAI for API credits"
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    disabled={running}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runTask(); }}
                  />

                  {/* Example prompts */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setTaskInput(ex)}
                        disabled={running}
                        className="text-xs px-2 py-0.5 rounded-md transition-all"
                        style={{
                          background: "rgba(7,16,32,0.6)",
                          border: "1px solid rgba(56,189,248,0.10)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {ex.length > 36 ? ex.slice(0, 34) + "…" : ex}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                    Ctrl+Enter to run
                  </p>
                </div>

                {parseError && (
                  <AlertBanner variant="error" icon={XCircle}>{parseError}</AlertBanner>
                )}

                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    loading={running}
                    disabled={!taskInput.trim() || running || agent?.status === "suspended"}
                    onClick={runTask}
                  >
                    <Play className="w-3.5 h-3.5" />
                    {running ? "Running…" : "Run Task"}
                  </Button>
                  {agent?.status === "suspended" && (
                    <p className="text-xs text-rose-400">Agent is frozen — tasks cannot execute</p>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* ── Execution Timeline ── */}
            {steps.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#22d3ee]" />
                    <h3 className="text-sm font-semibold text-white">Execution Timeline</h3>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Step-by-step agent execution trace
                    </p>
                    {running && (
                      <span className="text-xs text-[#22d3ee] animate-pulse ml-auto">Running…</span>
                    )}
                  </div>
                </CardHeader>
                <CardBody className="space-y-2">
                  {steps.map((step) => <StepRow key={step.id} step={step} />)}
                </CardBody>
              </Card>
            )}

            {/* ── Policy Decision ── */}
            {lastTx && <PolicyDecisionCard tx={lastTx} />}

            {/* ── Session History ── */}
            {history.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[#22d3ee]" />
                    <h3 className="text-sm font-semibold text-white">Session History</h3>
                    <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
                      {history.length} task{history.length !== 1 ? "s" : ""} this session
                    </span>
                  </div>
                </CardHeader>
                <CardBody className="p-0">
                  {history.map((run, i) => (
                    <div
                      key={run.id}
                      className="flex items-start gap-3 px-5 py-3"
                      style={{ borderBottom: i < history.length - 1 ? "1px solid rgba(56,189,248,0.06)" : undefined }}
                    >
                      {run.outcome === "approved" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : run.outcome === "blocked" ? (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{run.task}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {run.recipient} · {formatRelativeTime(run.ranAt)}
                        </p>
                        {run.blockReason && (
                          <p className="text-xs mt-0.5 text-rose-400 truncate">{run.blockReason}</p>
                        )}
                        {run.riskFlags && run.riskFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {run.riskFlags.slice(0, 2).map((f) => (
                              <span key={f} className="text-xs px-1.5 py-0 rounded badge-amber">{f}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-secondary)" }}>
                          {formatUSD(run.amount)}
                        </span>
                        <Badge className={txStatusColor(run.outcome === "error" ? "failed" : run.outcome)}>
                          {run.outcome}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}
          </div>

          {/* Right: live activity + agent budget + persisted activity */}
          <div className="space-y-5">

            {/* ── Live Activity Feed ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#22d3ee]" />
                    <h3 className="text-sm font-semibold text-white">Live Agent Events</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {liveEvents.length > 0 && (
                      <button
                        onClick={() => setLiveEvents([])}
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Clear
                      </button>
                    )}
                    <div className={`flex items-center gap-1 text-xs font-semibold ${sseConnected ? "text-emerald-400" : "text-amber-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full bg-current ${sseConnected ? "animate-pulse" : ""}`} />
                      {sseConnected ? "Live" : "Demo"}
                    </div>
                  </div>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Real agent events from the policy engine · SSE updates
                </p>
              </CardHeader>
              <CardBody className="p-0">
                <ActivityFeed events={liveEvents} />
              </CardBody>
            </Card>

            {/* ── Agent Budget ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[#22d3ee]" />
                  <h3 className="text-sm font-semibold text-white">Agent Budget</h3>
                </div>
              </CardHeader>
              <CardBody>
                {agentLoading ? (
                  <LoadingState message="Loading agent…" />
                ) : agent ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{agent.name}</p>
                        <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>{agent.id}</p>
                      </div>
                      <Badge className={agentStatusColor(agent.status)} dot>{agent.status}</Badge>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span style={{ color: "var(--text-muted)" }}>Daily</span>
                          <span className="text-white font-semibold tabular-nums">
                            {formatUSD(agent.spendingBudget.dailySpentUSD)}{" "}
                            <span style={{ color: "var(--text-muted)" }}>/ {formatUSD(agent.spendingBudget.dailyLimitUSD)}</span>
                          </span>
                        </div>
                        <ProgressBar value={dailyPct} variant={dailyPct > 85 ? "warn" : "default"} showLabel />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span style={{ color: "var(--text-muted)" }}>Monthly</span>
                          <span className="text-white font-semibold tabular-nums">
                            {formatUSD(agent.spendingBudget.monthlySpentUSD)}{" "}
                            <span style={{ color: "var(--text-muted)" }}>/ {formatUSD(agent.spendingBudget.monthlyLimitUSD)}</span>
                          </span>
                        </div>
                        <ProgressBar value={monthlyPct} showLabel />
                      </div>

                      <div className="flex justify-between text-xs pt-2 border-t" style={{ borderColor: "rgba(56,189,248,0.08)" }}>
                        <span style={{ color: "var(--text-muted)" }}>Per-Tx Limit</span>
                        <span className="text-white font-semibold tabular-nums">
                          {formatUSD(agent.spendingBudget.perTxLimitUSD)}
                        </span>
                      </div>
                    </div>

                    {/* Permissions */}
                    <div className="pt-1 border-t space-y-1" style={{ borderColor: "rgba(56,189,248,0.08)" }}>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Permissions</p>
                      {agent.permissions.map((p) => (
                        <div key={p.id} className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            {p.type.replace(/_/g, " ")}
                          </span>
                          <span className={`text-xs font-semibold ${p.granted ? "text-emerald-400" : "text-rose-400"}`}>
                            {p.granted ? "✓" : "✗"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Agent {AGENT_ID} not found in database.
                  </p>
                )}
              </CardBody>
            </Card>

            {/* ── Persisted Activity ── */}
            {recentTxs.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                    <h3 className="text-sm font-semibold text-white">Persisted DB Activity</h3>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Transactions from database — survive page refresh
                  </p>
                </CardHeader>
                <CardBody className="p-0">
                  {recentTxs.map((tx, i) => (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{ borderBottom: i < recentTxs.length - 1 ? "1px solid rgba(56,189,248,0.06)" : undefined }}
                    >
                      {tx.status === "approved" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : tx.status === "blocked" ? (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">
                          {tx.toLabel ?? tx.toAddress.slice(0, 14) + "…"}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {formatRelativeTime(tx.timestamp)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-bold tabular-nums text-white">
                          {formatUSD(tx.amountUSD)}
                        </span>
                        <Badge className={txStatusColor(tx.status)}>{tx.status}</Badge>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}

            {/* Parser rules */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <h3 className="text-sm font-semibold text-white">Parser</h3>
                  <Badge className="badge-amber">Rule-based</Badge>
                </div>
              </CardHeader>
              <CardBody className="space-y-2">
                {[
                  ["Amount",    "$50 · 50 USD · 50 dollars"],
                  ["Recipient", 'words after "to"'],
                  ["Purpose",   'text after "for"'],
                ].map(([label, rule]) => (
                  <div key={label} className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3 flex-shrink-0 text-[#22d3ee]" />
                    <span className="text-xs font-semibold text-white">{label}:</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{rule}</span>
                  </div>
                ))}
                <p className="text-xs pt-1" style={{ color: "var(--text-muted)" }}>
                  AI/LLM API not configured — connect <code className="font-mono text-amber-300">OPENAI_API_KEY</code>
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
