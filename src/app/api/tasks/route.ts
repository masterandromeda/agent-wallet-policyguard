// ============================================================
// Agent Wallet – PolicyGuard : Task API
//
// POST /api/tasks  — customer submits a purchase request
//   → creates AgentTask, runs full agent execution pipeline:
//     1. Validate input
//     2. Check agent status & permissions
//     3. Run 6-rule server-side policy engine (via /api/transactions)
//     4. Set task status from policy decision
//     5. Broadcast SSE events at every step
//
// GET /api/tasks   — list tasks (filtered by requesterId, agentId, status)
// GET /api/tasks?id=  — get single task
// PATCH /api/tasks — update task (e.g. after owner approves)
// ============================================================

import { NextResponse } from "next/server";
import {
  getTasks, getTask, addTask, updateTask,
  getAgent, getPolicies, generateId,
  getDailySpentForAgent, getMonthlySpentForAgent,
  addTransaction, upsertAgent, addApproval, addRiskAlert, getStats,
} from "@/lib/db";
import { broadcast } from "@/lib/broadcast";
import type { AgentTask, TaskExecutionStep, Transaction, ApprovalRequest, RiskAlert, Policy, PolicyRule } from "@/lib/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeStep(step: number, label: string, status: TaskExecutionStep["status"], detail?: string): TaskExecutionStep {
  return { step, label, status, detail, timestamp: new Date().toISOString() };
}

function ruleValue<T>(rule: PolicyRule): T {
  return rule.value as T;
}

function isWithinTimeWindow(windowStr: string): boolean {
  try {
    const [start, end] = windowStr.split("-").map((s) => s.trim());
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const now = new Date();
    const nowM = now.getUTCHours() * 60 + now.getUTCMinutes();
    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;
    if (startM <= endM) return nowM >= startM && nowM <= endM;
    return nowM >= startM || nowM <= endM;
  } catch { return true; }
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id          = searchParams.get("id");
  const requesterId = searchParams.get("requesterId");
  const agentId     = searchParams.get("agentId");
  const status      = searchParams.get("status");

  if (id) {
    const task = getTask(id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json({ data: task });
  }

  const tasks = getTasks({ requesterId: requesterId ?? undefined, agentId: agentId ?? undefined, status: status ?? undefined });
  return NextResponse.json({ data: tasks, total: tasks.length });
}

// ─── PATCH ──────────────────────────────────────────────────────────────────

export async function PATCH(request: Request) {
  let body: { id?: string; patch?: Partial<AgentTask> };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const updated = updateTask(body.id, body.patch ?? {});
  if (!updated) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  broadcast({ type: "task_update", payload: updated });
  return NextResponse.json({ data: updated });
}

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: {
    requesterId?: string;
    requesterName?: string;
    agentId?: string;
    merchant?: string;
    merchantAddress?: string;
    amountUSD?: number;
    purpose?: string;
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // ── Input validation ─────────────────────────────────────────
  if (!body.requesterId?.trim()) return NextResponse.json({ error: "requesterId required" }, { status: 400 });
  if (!body.agentId?.trim())     return NextResponse.json({ error: "agentId required" }, { status: 400 });
  if (!body.merchant?.trim())    return NextResponse.json({ error: "merchant required" }, { status: 400 });
  if (!body.amountUSD || body.amountUSD <= 0) return NextResponse.json({ error: "amountUSD must be positive" }, { status: 400 });
  if (!body.purpose?.trim())     return NextResponse.json({ error: "purpose required" }, { status: 400 });

  const now = new Date();

  // ── Create task in QUEUED state ──────────────────────────────
  const task: AgentTask = {
    id: generateId("task"),
    requesterId: body.requesterId,
    requesterName: body.requesterName ?? "Customer",
    agentId: body.agentId,
    agentName: "",
    merchant: body.merchant,
    merchantAddress: body.merchantAddress ?? `0x${body.merchant.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20).padEnd(40, "0")}`,
    amountUSD: body.amountUSD,
    purpose: body.purpose,
    status: "queued",
    steps: [makeStep(1, "Request received — queued for agent", "done")],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    isSimulated: true,
  };

  // ── Step 2: Load agent ───────────────────────────────────────
  task.steps.push(makeStep(2, "Loading agent configuration…", "running"));
  broadcast({ type: "task_new", payload: task });
  addTask(task);

  const agent = getAgent(body.agentId);
  if (!agent) {
    task.steps[task.steps.length - 1] = makeStep(2, "Agent not found", "error", `No agent with id ${body.agentId}`);
    task.status = "failed";
    task.errorMessage = `Agent ${body.agentId} not found`;
    task.completedAt = new Date().toISOString();
    updateTask(task.id, task);
    broadcast({ type: "task_update", payload: task });
    return NextResponse.json({ error: task.errorMessage }, { status: 404 });
  }

  task.agentName = agent.name;
  task.steps[task.steps.length - 1] = makeStep(2, `Agent loaded: ${agent.name}`, "done", `Status: ${agent.status} · Budget: $${agent.spendingBudget.dailyLimitUSD}/day`);
  task.status = "parsing";
  updateTask(task.id, task);
  broadcast({ type: "task_update", payload: task });

  // ── Step 3: Validate agent status ───────────────────────────
  task.steps.push(makeStep(3, "Checking agent status and permissions…", "running"));
  updateTask(task.id, task);
  broadcast({ type: "task_update", payload: task });

  const policyChecks: Array<{ rule: string; passed: boolean; detail: string }> = [];

  if (agent.status === "suspended") {
    task.steps[task.steps.length - 1] = makeStep(3, "Agent is suspended — cannot execute", "error");
    task.status = "blocked";
    task.policyDecision = "blocked";
    task.blockReason = "Agent is suspended";
    task.policyChecks = [{ rule: "Agent Status", passed: false, detail: "Agent is suspended — all tasks blocked" }];
    task.result = "Blocked: agent is suspended";
    task.completedAt = new Date().toISOString();
    updateTask(task.id, task);
    broadcast({ type: "task_update", payload: task });
    return NextResponse.json({ data: task }, { status: 200 });
  }
  policyChecks.push({ rule: "Agent Status", passed: true, detail: `Agent active: ${agent.name}` });
  task.steps[task.steps.length - 1] = makeStep(3, "Agent active — permissions verified", "done");

  // ── Step 4: Run policy engine ────────────────────────────────
  task.steps.push(makeStep(4, "Running 6-rule server-side policy engine…", "running"));
  task.status = "policy_check";
  updateTask(task.id, task);
  broadcast({ type: "task_update", payload: task });

  const blockReasons: string[] = [];
  const riskFlags: string[] = [];
  let riskScore = 10;
  let requiresApproval = false;
  let approvalThreshold = 0;

  const dailySpent   = getDailySpentForAgent(body.agentId, now.toISOString());
  const monthlySpent = getMonthlySpentForAgent(body.agentId, now.toISOString());

  // Rule A: Transfer permission not expired
  const transferPerm = agent.permissions.find((p) => p.type === "transfer");
  if (!transferPerm || !transferPerm.granted) {
    blockReasons.push("Agent does not have transfer permission");
    riskFlags.push("No transfer permission");
    riskScore = Math.max(riskScore, 60);
    policyChecks.push({ rule: "Transfer Permission", passed: false, detail: "Agent lacks transfer permission" });
  } else if (transferPerm.expiresAt && new Date(transferPerm.expiresAt) < now) {
    blockReasons.push("Transfer permission has expired");
    riskFlags.push("Permission expired");
    riskScore = Math.max(riskScore, 65);
    policyChecks.push({ rule: "Permission Expiry", passed: false, detail: `Permission expired at ${transferPerm.expiresAt}` });
  } else {
    policyChecks.push({ rule: "Transfer Permission", passed: true, detail: "Permission granted and valid" });
  }

  // Rule B: Per-transaction limit
  const perTxLimit = agent.spendingBudget.perTxLimitUSD;
  if (perTxLimit > 0 && body.amountUSD > perTxLimit) {
    blockReasons.push(`Amount $${body.amountUSD} exceeds per-tx limit $${perTxLimit}`);
    riskFlags.push("Exceeds per-tx limit");
    riskScore = Math.max(riskScore, 70);
    policyChecks.push({ rule: "Per-Transaction Limit", passed: false, detail: `$${body.amountUSD} > limit $${perTxLimit}` });
  } else {
    policyChecks.push({ rule: "Per-Transaction Limit", passed: true, detail: `$${body.amountUSD} ≤ limit $${perTxLimit || "∞"}` });
  }

  // Rule C: Daily limit
  if (agent.spendingBudget.dailyLimitUSD > 0) {
    const remaining = agent.spendingBudget.dailyLimitUSD - dailySpent;
    if (body.amountUSD > remaining) {
      blockReasons.push(`Daily limit exceeded (remaining: $${remaining.toFixed(2)})`);
      riskFlags.push("Daily limit exceeded");
      riskScore = Math.max(riskScore, 75);
      policyChecks.push({ rule: "Daily Spending Limit", passed: false, detail: `Remaining: $${remaining.toFixed(2)} of $${agent.spendingBudget.dailyLimitUSD}` });
    } else {
      policyChecks.push({ rule: "Daily Spending Limit", passed: true, detail: `$${dailySpent.toFixed(2)} spent of $${agent.spendingBudget.dailyLimitUSD} limit` });
    }
  }

  // Policy rules from DB
  const activePolicies: Policy[] = getPolicies().filter(
    (p) => p.status === "active" && p.agentIds.includes(body.agentId!) && (!p.expiresAt || new Date(p.expiresAt) > now)
  );

  for (const policy of activePolicies) {
    for (const rule of policy.rules) {
      if (!rule.enabled) continue;
      switch (rule.type) {
        case "max_tx_amount": {
          const limit = ruleValue<number>(rule);
          if (limit > 0 && body.amountUSD! > limit) {
            blockReasons.push(`Policy "${policy.name}": max $${limit} per transaction`);
            riskFlags.push("Policy: max_tx_amount");
            riskScore = Math.max(riskScore, 70);
            policyChecks.push({ rule: `${policy.name}: Max Tx Amount`, passed: false, detail: `$${body.amountUSD} > policy limit $${limit}` });
          } else {
            policyChecks.push({ rule: `${policy.name}: Max Tx Amount`, passed: true, detail: `$${body.amountUSD} ≤ $${limit}` });
          }
          break;
        }
        case "daily_limit": {
          const limit = ruleValue<number>(rule);
          if (limit > 0 && dailySpent + body.amountUSD! > limit) {
            blockReasons.push(`Policy "${policy.name}": daily limit $${limit} would be exceeded`);
            riskFlags.push("Policy: daily_limit");
            riskScore = Math.max(riskScore, 75);
            policyChecks.push({ rule: `${policy.name}: Daily Limit`, passed: false, detail: `Spent $${dailySpent} + $${body.amountUSD} > $${limit}` });
          } else {
            policyChecks.push({ rule: `${policy.name}: Daily Limit`, passed: true, detail: `$${(dailySpent + body.amountUSD!).toFixed(2)} ≤ $${limit}` });
          }
          break;
        }
        case "allowed_recipients": {
          const list = ruleValue<string[]>(rule);
          const toAddr = task.merchantAddress;
          if (list.length > 0 && !list.includes(toAddr)) {
            blockReasons.push(`Policy "${policy.name}": recipient not in allowed list`);
            riskFlags.push("Policy: recipient not allowed");
            riskScore = Math.max(riskScore, 80);
            policyChecks.push({ rule: `${policy.name}: Allowed Recipients`, passed: false, detail: `${toAddr.slice(0, 18)}… not in allowlist` });
          } else {
            policyChecks.push({ rule: `${policy.name}: Allowed Recipients`, passed: true, detail: list.length === 0 ? "No recipient restriction" : "Recipient in allowlist" });
          }
          break;
        }
        case "allowed_contracts": {
          const list = ruleValue<string[]>(rule);
          const toAddr = task.merchantAddress;
          if (list.length > 0 && !list.includes(toAddr)) {
            blockReasons.push(`Policy "${policy.name}": contract not in allowed list`);
            riskFlags.push("Policy: contract not allowed");
            riskScore = Math.max(riskScore, 80);
            policyChecks.push({ rule: `${policy.name}: Allowed Contracts`, passed: false, detail: "Contract not in allowlist" });
          } else {
            policyChecks.push({ rule: `${policy.name}: Allowed Contracts`, passed: true, detail: "No contract restriction" });
          }
          break;
        }
        case "time_window": {
          const window = ruleValue<string>(rule);
          if (!isWithinTimeWindow(window)) {
            blockReasons.push(`Policy "${policy.name}": outside allowed time window (${window} UTC)`);
            riskFlags.push("Policy: outside time window");
            riskScore = Math.max(riskScore, 65);
            policyChecks.push({ rule: `${policy.name}: Time Window`, passed: false, detail: `Outside ${window} UTC` });
          } else {
            policyChecks.push({ rule: `${policy.name}: Time Window`, passed: true, detail: `Within ${window} UTC` });
          }
          break;
        }
        case "require_approval": {
          const threshold = ruleValue<number>(rule);
          if (threshold > 0 && body.amountUSD! >= threshold) {
            requiresApproval = true;
            approvalThreshold = Math.max(approvalThreshold, threshold);
            policyChecks.push({ rule: `${policy.name}: Owner Approval Required`, passed: true, detail: `$${body.amountUSD} ≥ threshold $${threshold} — escalating` });
          }
          break;
        }
      }
    }
  }

  // ── Determine outcome ────────────────────────────────────────
  let txStatus: Transaction["status"];
  if (blockReasons.length > 0) {
    txStatus = "blocked";
  } else if (requiresApproval) {
    txStatus = "pending";
  } else {
    txStatus = "approved";
  }

  task.policyChecks = policyChecks;
  task.riskScore    = riskScore;
  task.riskFlags    = riskFlags;

  const policyStepDetail = blockReasons.length > 0
    ? `Blocked: ${blockReasons[0]}`
    : requiresApproval
    ? `Escalated: amount $${body.amountUSD} ≥ approval threshold $${approvalThreshold}`
    : `All ${policyChecks.length} checks passed`;
  task.steps[task.steps.length - 1] = makeStep(4, "Policy engine evaluation complete", txStatus === "blocked" ? "error" : "done", policyStepDetail);

  // ── Write transaction record ─────────────────────────────────
  const matchedPolicy = activePolicies[0];
  const tx: Transaction = {
    id: generateId("tx"),
    agentId: body.agentId,
    agentName: agent.name,
    fromAddress: agent.walletAddress,
    toAddress: task.merchantAddress,
    toLabel: body.merchant,
    amountUSD: body.amountUSD,
    status: txStatus,
    policyId: matchedPolicy?.id,
    policyName: matchedPolicy?.name,
    blockReason: blockReasons.length > 0 ? blockReasons.join("; ") : undefined,
    riskScore,
    riskFlags,
    network: "simulated",
    isSimulated: true,
    timestamp: new Date().toISOString(),
    requesterId: body.requesterId,
    requesterName: body.requesterName ?? "Customer",
    purpose: body.purpose,
  };
  addTransaction(tx);
  broadcast({ type: "transaction_new", payload: tx });
  task.transactionId    = tx.id;
  task.policyDecision   = txStatus === "blocked" ? "blocked" : txStatus === "pending" ? "pending" : "approved";
  task.blockReason      = tx.blockReason;

  // ── Approved: execute & update budgets ───────────────────────
  if (txStatus === "approved") {
    task.steps.push(makeStep(5, "Executing payment through wallet…", "running"));
    task.status = "executing";
    updateTask(task.id, task);
    broadcast({ type: "task_update", payload: task });

    const updatedAgent = {
      ...agent,
      spendingBudget: {
        ...agent.spendingBudget,
        dailySpentUSD:   dailySpent   + body.amountUSD,
        monthlySpentUSD: monthlySpent + body.amountUSD,
      },
      lastActive: new Date().toISOString(),
    };
    upsertAgent(updatedAgent);
    broadcast({ type: "agent_update", payload: updatedAgent });

    task.steps[task.steps.length - 1] = makeStep(5, "Payment executed — budget updated", "done",
      `Daily: $${updatedAgent.spendingBudget.dailySpentUSD.toFixed(2)} / $${updatedAgent.spendingBudget.dailyLimitUSD}`);
    task.status      = "completed";
    task.result      = `Payment of $${body.amountUSD} to ${body.merchant} executed successfully`;
    task.completedAt = new Date().toISOString();

  } else if (txStatus === "pending") {
    // Create approval request
    const apr: ApprovalRequest = {
      id: generateId("apr"),
      agentId: body.agentId,
      agentName: agent.name,
      ownerId: agent.ownerId,
      transactionId: tx.id,
      reason: `$${body.amountUSD} to ${body.merchant} — requires owner approval (threshold $${approvalThreshold})`,
      requestedAmount: body.amountUSD,
      toAddress: task.merchantAddress,
      toLabel: body.merchant,
      status: "pending",
      policyViolations: riskFlags,
      riskScore,
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      requesterId: body.requesterId,
      requesterName: body.requesterName ?? "Customer",
    };
    addApproval(apr);
    broadcast({ type: "approval_new", payload: apr });
    task.approvalRequestId = apr.id;
    task.steps.push(makeStep(5, "Escalated to owner — awaiting approval decision", "done",
      `Approval request ${apr.id} created. Expires ${new Date(apr.expiresAt).toLocaleTimeString()}`));
    task.status = "awaiting_approval";
    task.result = "Pending owner approval";

  } else {
    // Blocked
    task.steps.push(makeStep(5, "Transaction blocked — no payment executed", "error", blockReasons.join("; ")));
    task.status  = "blocked";
    task.result  = `Blocked: ${blockReasons[0]}`;

    if (riskScore >= 70) {
      const alert: RiskAlert = {
        id: generateId("ra"),
        agentId: body.agentId,
        agentName: agent.name,
        transactionId: tx.id,
        level: riskScore >= 90 ? "critical" : riskScore >= 70 ? "high" : "medium",
        title: `Transaction Blocked – ${agent.name}`,
        description: `$${body.amountUSD} to ${body.merchant} was blocked`,
        explanation: `Policy enforcement blocked this transaction. Reasons: ${blockReasons.join(". ")}. Risk score: ${riskScore}/100. AI risk scores are advisory only — this block was enforced by server-side policy rules.`,
        timestamp: new Date().toISOString(),
        acknowledged: false,
        policyViolated: matchedPolicy?.name ?? "Active policy",
      };
      addRiskAlert(alert);
      broadcast({ type: "risk_alert", payload: alert });
    }
    task.completedAt = new Date().toISOString();
  }

  updateTask(task.id, task);
  broadcast({ type: "task_update", payload: task });
  broadcast({ type: "stats_update", payload: getStats() });

  return NextResponse.json({ data: task }, { status: 201 });
}
