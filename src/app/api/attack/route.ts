import { NextResponse } from "next/server";
import {
  getAttackScenarios,
  upsertAttackScenario,
  getAgent,
  getPolicies,
  getTransactions,
  addTransaction,
  addRiskAlert,
  getDailySpentForAgent,
  getMonthlySpentForAgent,
  generateId,
} from "@/lib/db";
import { broadcast } from "@/lib/broadcast";
import type { AttackScenario, Transaction, RiskAlert, Policy, PolicyRule } from "@/lib/types";

const DEFAULT_SCENARIOS: AttackScenario[] = [
  {
    id: "atk_excessive_spend",
    name: "Excessive Spend Attack",
    description: "Attempts a transaction that far exceeds the agent's per-tx limit ($99,999).",
    attackType: "excessive_spend",
    expectedOutcome: "blocked",
    status: "idle",
  },
  {
    id: "atk_unapproved_recipient",
    name: "Unapproved Recipient Attack",
    description: "Sends funds to an address not in the allowed recipients list.",
    attackType: "unapproved_recipient",
    expectedOutcome: "blocked",
    status: "idle",
  },
  {
    id: "atk_expired_permission",
    name: "Expired Permission Attack",
    description: "Attempts a transaction after simulating permission expiry.",
    attackType: "expired_permission",
    expectedOutcome: "blocked",
    status: "idle",
  },
  {
    id: "atk_prohibited_contract",
    name: "Prohibited Contract Attack",
    description: "Calls a contract address that is not in the allowed contracts list.",
    attackType: "prohibited_contract",
    expectedOutcome: "blocked",
    status: "idle",
  },
  {
    id: "atk_rapid_fire",
    name: "Rapid-Fire Transaction Attack",
    description: "Attempts many small transactions in quick succession to drain daily budget.",
    attackType: "rapid_fire",
    expectedOutcome: "blocked",
    status: "idle",
  },
];

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
    return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
  } catch {
    return true;
  }
}

function ruleValue<T>(rule: PolicyRule): T {
  return rule.value as T;
}

function runPolicyEngine(
  agentId: string,
  toAddress: string,
  amountUSD: number,
): { txStatus: Transaction["status"]; blockReasons: string[]; riskScore: number; riskFlags: string[] } {
  const agent = getAgent(agentId);
  if (!agent) return { txStatus: "blocked", blockReasons: ["Agent not found"], riskScore: 100, riskFlags: ["Agent not found"] };

  const now = new Date();
  const dailySpent = getDailySpentForAgent(agentId, now.toISOString());
  const monthlySpent = getMonthlySpentForAgent(agentId, now.toISOString());

  const blockReasons: string[] = [];
  const riskFlags: string[] = [];
  let riskScore = 10;
  let requiresApproval = false;
  let approvalThreshold = 0;

  if (agent.status === "suspended") {
    blockReasons.push("Agent is suspended");
    riskScore = Math.max(riskScore, 95);
    riskFlags.push("Agent suspended");
  }

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

  const perTxLimit = agent.spendingBudget.perTxLimitUSD;
  if (perTxLimit > 0 && amountUSD > perTxLimit) {
    blockReasons.push(`Amount $${amountUSD} exceeds per-tx limit $${perTxLimit}`);
    riskScore = Math.max(riskScore, 70);
    riskFlags.push("Exceeds per-tx limit");
  }

  if (agent.spendingBudget.dailyLimitUSD > 0) {
    const dailyRemaining = agent.spendingBudget.dailyLimitUSD - dailySpent;
    if (amountUSD > dailyRemaining) {
      blockReasons.push(`Daily limit exceeded (remaining: $${dailyRemaining.toFixed(2)})`);
      riskScore = Math.max(riskScore, 75);
      riskFlags.push("Daily limit exceeded");
    }
  }

  if (agent.spendingBudget.monthlyLimitUSD > 0) {
    const monthlyRemaining = agent.spendingBudget.monthlyLimitUSD - monthlySpent;
    if (amountUSD > monthlyRemaining) {
      blockReasons.push(`Monthly limit exceeded (remaining: $${monthlyRemaining.toFixed(2)})`);
      riskScore = Math.max(riskScore, 75);
      riskFlags.push("Monthly limit exceeded");
    }
  }

  const allPolicies: Policy[] = getPolicies().filter(
    (p) => p.status === "active" && p.agentIds.includes(agentId) && (!p.expiresAt || new Date(p.expiresAt) > now)
  );

  for (const policy of allPolicies) {
    for (const rule of policy.rules) {
      if (!rule.enabled) continue;
      switch (rule.type) {
        case "max_tx_amount": {
          const limit = ruleValue<number>(rule);
          if (limit > 0 && amountUSD > limit) {
            blockReasons.push(`Policy "${policy.name}": Amount exceeds max $${limit}`);
            riskScore = Math.max(riskScore, 70);
            riskFlags.push("Policy: max_tx_amount");
          }
          break;
        }
        case "daily_limit": {
          const limit = ruleValue<number>(rule);
          if (limit > 0 && dailySpent + amountUSD > limit) {
            blockReasons.push(`Policy "${policy.name}": Daily limit $${limit} would be exceeded`);
            riskScore = Math.max(riskScore, 75);
            riskFlags.push("Policy: daily_limit");
          }
          break;
        }
        case "monthly_limit": {
          const limit = ruleValue<number>(rule);
          if (limit > 0 && monthlySpent + amountUSD > limit) {
            blockReasons.push(`Policy "${policy.name}": Monthly limit $${limit} would be exceeded`);
            riskScore = Math.max(riskScore, 75);
            riskFlags.push("Policy: monthly_limit");
          }
          break;
        }
        case "allowed_recipients": {
          const list = ruleValue<string[]>(rule);
          if (list.length > 0 && !list.includes(toAddress)) {
            blockReasons.push(`Policy "${policy.name}": Recipient not in allowed list`);
            riskScore = Math.max(riskScore, 80);
            riskFlags.push("Policy: recipient not allowed");
          }
          break;
        }
        case "allowed_contracts": {
          const list = ruleValue<string[]>(rule);
          if (list.length > 0 && !list.includes(toAddress)) {
            blockReasons.push(`Policy "${policy.name}": Contract not in allowed list`);
            riskScore = Math.max(riskScore, 80);
            riskFlags.push("Policy: contract not allowed");
          }
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
          if (threshold > 0 && amountUSD >= threshold) {
            requiresApproval = true;
            approvalThreshold = Math.max(approvalThreshold, threshold);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  let txStatus: Transaction["status"];
  if (blockReasons.length > 0) {
    txStatus = "blocked";
  } else if (requiresApproval && approvalThreshold > 0) {
    txStatus = "pending";
  } else {
    txStatus = "approved";
  }

  return { txStatus, blockReasons, riskScore, riskFlags };
}

export async function GET() {
  let scenarios = getAttackScenarios();
  if (scenarios.length === 0) {
    for (const s of DEFAULT_SCENARIOS) {
      upsertAttackScenario(s);
    }
    scenarios = DEFAULT_SCENARIOS;
  }
  return NextResponse.json({ data: scenarios, total: scenarios.length });
}

export async function POST(request: Request) {
  let body: { scenarioId?: string; agentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { scenarioId, agentId } = body;
  if (!scenarioId) return NextResponse.json({ error: "scenarioId is required" }, { status: 400 });
  if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });

  // Ensure default scenarios exist
  let scenarios = getAttackScenarios();
  if (scenarios.length === 0) {
    for (const s of DEFAULT_SCENARIOS) {
      upsertAttackScenario(s);
    }
    scenarios = DEFAULT_SCENARIOS;
  }

  const scenario = scenarios.find((s) => s.id === scenarioId);
  if (!scenario) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });

  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // Mark as running
  const running: AttackScenario = { ...scenario, status: "running" };
  upsertAttackScenario(running);

  // Build attack parameters based on scenario type
  let toAddress = "0xDEADBEEF00000000000000000000000000000001";
  let amountUSD = 10;

  switch (scenario.attackType) {
    case "excessive_spend":
      amountUSD = 99999;
      break;
    case "unapproved_recipient":
      toAddress = "0xMALICIOUS000000000000000000000000000001";
      amountUSD = 100;
      break;
    case "expired_permission":
      amountUSD = 50;
      break;
    case "prohibited_contract":
      toAddress = "0xBADCONTRACT0000000000000000000000000001";
      amountUSD = 100;
      break;
    case "rapid_fire":
      amountUSD = agent.spendingBudget.dailyLimitUSD > 0
        ? agent.spendingBudget.dailyLimitUSD + 1
        : 10000;
      break;
  }

  const now = new Date();
  const { txStatus, blockReasons, riskScore, riskFlags } = runPolicyEngine(agentId, toAddress, amountUSD);

  const tx: Transaction = {
    id: generateId("tx"),
    agentId,
    agentName: agent.name,
    fromAddress: agent.walletAddress,
    toAddress,
    amountUSD,
    status: txStatus,
    blockReason: blockReasons.length > 0 ? blockReasons.join("; ") : undefined,
    riskScore,
    riskFlags,
    network: "simulated",
    isSimulated: true,
    timestamp: now.toISOString(),
  };
  addTransaction(tx);

  const actualOutcome: AttackScenario["actualOutcome"] =
    txStatus === "blocked" ? "blocked" : txStatus === "pending" ? "pending" : "approved";
  const passed = actualOutcome === scenario.expectedOutcome;

  const completedScenario: AttackScenario = {
    ...scenario,
    status: passed ? "passed" : "failed",
    actualOutcome,
    policyViolations: riskFlags,
    riskScore,
    ranAt: now.toISOString(),
    passed,
    transactionId: tx.id,
  };
  upsertAttackScenario(completedScenario);

  if (!passed) {
    const alert: RiskAlert = {
      id: generateId("ra"),
      agentId,
      agentName: agent.name,
      transactionId: tx.id,
      level: "critical",
      title: `Attack Simulation FAILED – ${scenario.name}`,
      description: `Expected "${scenario.expectedOutcome}" but got "${actualOutcome}". Policy did not enforce correctly.`,
      explanation: `Attack scenario "${scenario.name}" (type: ${scenario.attackType}) was expected to be ${scenario.expectedOutcome} but was ${actualOutcome}. This indicates a policy enforcement gap that should be investigated immediately.`,
      timestamp: now.toISOString(),
      acknowledged: false,
    };
    addRiskAlert(alert);
  }

  broadcast({ type: "attack_result", payload: { scenario: completedScenario, transaction: tx, passed } });

  return NextResponse.json({ data: { scenario: completedScenario, transaction: tx, passed } }, { status: 200 });
}
