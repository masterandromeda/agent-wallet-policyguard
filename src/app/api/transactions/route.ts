import { NextResponse } from "next/server";
import {
  getTransactions, addTransaction, getAgent, upsertAgent, getPolicies,
  getApprovals, addApproval, addRiskAlert, getStats, generateId,
  getDailySpentForAgent, getMonthlySpentForAgent,
} from "@/lib/db";
import { broadcast } from "@/lib/broadcast";
import type { Transaction, ApprovalRequest, RiskAlert, Policy, PolicyRule } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status      = searchParams.get("status");
  const agentId     = searchParams.get("agentId");
  const role        = searchParams.get("role");
  const requesterId = searchParams.get("requesterId");

  let txs = getTransactions();
  if (status) txs = txs.filter((t) => t.status === status);
  if (agentId) txs = txs.filter((t) => t.agentId === agentId);
  if (role === "customer" && requesterId) {
    txs = txs.filter((t) => t.requesterId === requesterId);
  }

  return NextResponse.json({ data: txs, total: txs.length, stats: getStats() });
}

// ─── Full policy engine ───────────────────────────────────────
function isWithinTimeWindow(windowStr: string): boolean {
  try {
    const [start, end] = windowStr.split("-").map((s) => s.trim());
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const now = new Date();
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes   = endH   * 60 + endM;
    if (startMinutes <= endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
    }
    // Wraps midnight
    return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
  } catch {
    return true; // If parse fails, don't block
  }
}

function ruleValue<T>(rule: PolicyRule): T {
  return rule.value as T;
}

export async function POST(request: Request) {
  let body: {
    agentId?: string;
    requesterId?: string;
    requesterName?: string;
    toAddress?: string;
    toLabel?: string;
    amountUSD?: number;
    purpose?: string;
    network?: string;
    role?: "agent" | "customer";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.amountUSD || body.amountUSD <= 0) {
    return NextResponse.json({ error: "amountUSD must be a positive number" }, { status: 400 });
  }
  if (!body.toAddress?.trim() && !body.toLabel?.trim()) {
    return NextResponse.json({ error: "toAddress or toLabel is required" }, { status: 400 });
  }
  if (!body.agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const agent = getAgent(body.agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const now = new Date();
  const todayISO   = now.toISOString();
  const monthISO   = now.toISOString();

  // Recalculate actual spend from DB (prevents concurrent-request exploits)
  const dailySpent   = getDailySpentForAgent(body.agentId, todayISO);
  const monthlySpent = getMonthlySpentForAgent(body.agentId, monthISO);

  const blockReasons: string[] = [];
  const riskFlags: string[] = [];
  let riskScore = 10;
  let requiresApproval = false;
  let approvalThreshold = 0;

  // ── Rule 1: Agent must not be suspended ────────────────
  if (agent.status === "suspended") {
    blockReasons.push("Agent is suspended");
    riskScore = Math.max(riskScore, 95);
    riskFlags.push("Agent suspended");
  }

  // ── Rule 2: Transfer permission (not expired) ──────────
  const transferPerm = agent.permissions.find((p) => p.type === "transfer");
  if (!transferPerm || !transferPerm.granted) {
    blockReasons.push("Agent does not have transfer permission");
    riskScore = Math.max(riskScore, 60);
    riskFlags.push("No transfer permission");
  } else if (transferPerm.expiresAt && new Date(transferPerm.expiresAt) < now) {
    blockReasons.push("Transfer permission has expired");
    riskScore = Math.max(riskScore, 65);
    riskFlags.push("Permission expired");
  }

  // ── Rule 3: Agent per-tx limit (from spendingBudget) ───
  const perTxLimit = agent.spendingBudget.perTxLimitUSD;
  if (perTxLimit > 0 && body.amountUSD > perTxLimit) {
    blockReasons.push(`Amount $${body.amountUSD} exceeds per-tx limit $${perTxLimit}`);
    riskScore = Math.max(riskScore, 70);
    riskFlags.push("Exceeds per-tx limit");
  }

  // ── Rule 4: Daily limit (recalculated from DB) ─────────
  if (agent.spendingBudget.dailyLimitUSD > 0) {
    const dailyRemaining = agent.spendingBudget.dailyLimitUSD - dailySpent;
    if (body.amountUSD > dailyRemaining) {
      blockReasons.push(`Daily limit exceeded (remaining: $${dailyRemaining.toFixed(2)})`);
      riskScore = Math.max(riskScore, 75);
      riskFlags.push("Daily limit exceeded");
    }
  }

  // ── Rule 5: Monthly limit (recalculated from DB) ───────
  if (agent.spendingBudget.monthlyLimitUSD > 0) {
    const monthlyRemaining = agent.spendingBudget.monthlyLimitUSD - monthlySpent;
    if (body.amountUSD > monthlyRemaining) {
      blockReasons.push(`Monthly limit exceeded (remaining: $${monthlyRemaining.toFixed(2)})`);
      riskScore = Math.max(riskScore, 75);
      riskFlags.push("Monthly limit exceeded");
    }
  }

  // ── Policy rules from active policies ──────────────────
  const allPolicies: Policy[] = getPolicies().filter(
    (p) =>
      p.status === "active" &&
      p.agentIds.includes(body.agentId!) &&
      (!p.expiresAt || new Date(p.expiresAt) > now)
  );

  for (const policy of allPolicies) {
    for (const rule of policy.rules) {
      if (!rule.enabled) continue;

      switch (rule.type) {
        case "max_tx_amount": {
          const limit = ruleValue<number>(rule);
          if (limit > 0 && body.amountUSD > limit) {
            blockReasons.push(`Policy "${policy.name}": Amount exceeds max $${limit}`);
            riskScore = Math.max(riskScore, 70);
            riskFlags.push("Policy: max_tx_amount");
          }
          break;
        }
        case "daily_limit": {
          const limit = ruleValue<number>(rule);
          if (limit > 0 && dailySpent + body.amountUSD > limit) {
            blockReasons.push(`Policy "${policy.name}": Daily limit $${limit} would be exceeded`);
            riskScore = Math.max(riskScore, 75);
            riskFlags.push("Policy: daily_limit");
          }
          break;
        }
        case "monthly_limit": {
          const limit = ruleValue<number>(rule);
          if (limit > 0 && monthlySpent + body.amountUSD > limit) {
            blockReasons.push(`Policy "${policy.name}": Monthly limit $${limit} would be exceeded`);
            riskScore = Math.max(riskScore, 75);
            riskFlags.push("Policy: monthly_limit");
          }
          break;
        }
        case "allowed_recipients": {
          const list = ruleValue<string[]>(rule);
          const toAddr = body.toAddress ?? "";
          if (list.length > 0 && !list.includes(toAddr)) {
            blockReasons.push(`Policy "${policy.name}": Recipient not in allowed list`);
            riskScore = Math.max(riskScore, 80);
            riskFlags.push("Policy: recipient not allowed");
          }
          break;
        }
        case "allowed_contracts": {
          const list = ruleValue<string[]>(rule);
          const toAddr = body.toAddress ?? "";
          if (list.length > 0 && !list.includes(toAddr)) {
            blockReasons.push(`Policy "${policy.name}": Contract not in allowed list`);
            riskScore = Math.max(riskScore, 80);
            riskFlags.push("Policy: contract not allowed");
          }
          break;
        }
        case "allowed_functions": {
          // Can't check function selector without actual calldata — skip in simulation
          break;
        }
        case "time_window": {
          const window = ruleValue<string>(rule);
          if (!isWithinTimeWindow(window)) {
            blockReasons.push(`Policy "${policy.name}": Outside allowed time window (${window} UTC)`);
            riskScore = Math.max(riskScore, 65);
            riskFlags.push("Policy: outside time window");
          }
          break;
        }
        case "require_approval": {
          const threshold = ruleValue<number>(rule);
          if (threshold > 0 && body.amountUSD >= threshold) {
            requiresApproval = true;
            approvalThreshold = Math.max(approvalThreshold, threshold);
          }
          break;
        }
      }
    }
  }

  // ── Determine outcome ──────────────────────────────────
  let txStatus: Transaction["status"];
  if (blockReasons.length > 0) {
    txStatus = "blocked";
  } else if (requiresApproval) {
    txStatus = "pending";
  } else {
    txStatus = "approved";
  }

  // ── Build transaction ──────────────────────────────────
  const matchedPolicy = allPolicies[0];
  const tx: Transaction = {
    id: generateId("tx"),
    agentId: body.agentId,
    agentName: agent.name,
    fromAddress: agent.walletAddress,
    toAddress: body.toAddress ?? "",
    toLabel: body.toLabel,
    amountUSD: body.amountUSD,
    status: txStatus,
    policyId: matchedPolicy?.id,
    policyName: matchedPolicy?.name,
    blockReason: blockReasons.length > 0 ? blockReasons.join("; ") : undefined,
    riskScore,
    riskFlags,
    network: "simulated",
    isSimulated: true,
    timestamp: now.toISOString(),
    requesterId: body.requesterId,
    requesterName: body.requesterName,
    purpose: body.purpose,
  };

  addTransaction(tx);
  broadcast({ type: "transaction_new", payload: tx });

  // ── Update agent spend totals if approved ──────────────
  if (txStatus === "approved") {
    const updatedAgent = {
      ...agent,
      spendingBudget: {
        ...agent.spendingBudget,
        dailySpentUSD:   dailySpent   + body.amountUSD,
        monthlySpentUSD: monthlySpent + body.amountUSD,
      },
      lastActive: now.toISOString(),
    };
    upsertAgent(updatedAgent);
    broadcast({ type: "agent_update", payload: updatedAgent });
  }

  // ── Create approval request if pending ─────────────────
  if (txStatus === "pending") {
    const apr: ApprovalRequest = {
      id: generateId("apr"),
      agentId: body.agentId,
      agentName: agent.name,
      ownerId: agent.ownerId,
      transactionId: tx.id,
      reason: body.purpose ?? `Payment of $${body.amountUSD} requires owner approval (threshold: $${approvalThreshold})`,
      requestedAmount: body.amountUSD,
      toAddress: body.toAddress ?? "",
      toLabel: body.toLabel,
      status: "pending",
      policyViolations: riskFlags,
      riskScore,
      requestedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      requesterId: body.requesterId,
      requesterName: body.requesterName,
    };
    addApproval(apr);
    broadcast({ type: "approval_new", payload: apr });
  }

  // ── Risk alert for high-risk blocks ────────────────────
  if (txStatus === "blocked" && riskScore >= 70) {
    const alert: RiskAlert = {
      id: generateId("ra"),
      agentId: body.agentId,
      agentName: agent.name,
      transactionId: tx.id,
      level: riskScore >= 90 ? "critical" : riskScore >= 70 ? "high" : "medium",
      title: `Transaction Blocked – ${agent.name}`,
      description: `$${body.amountUSD} to ${body.toLabel ?? body.toAddress} was blocked by policy`,
      explanation: `Policy enforcement blocked this transaction. Reasons: ${blockReasons.join(". ")}. Risk score: ${riskScore}/100. Note: AI risk scores are advisory only — this block was enforced by server-side policy rules, not by the AI model.`,
      timestamp: now.toISOString(),
      acknowledged: false,
      policyViolated: matchedPolicy?.name ?? "Active policy",
    };
    addRiskAlert(alert);
    broadcast({ type: "risk_alert", payload: alert });
  }

  broadcast({ type: "stats_update", payload: getStats() });

  return NextResponse.json({ data: tx, status: txStatus }, { status: 201 });
}
