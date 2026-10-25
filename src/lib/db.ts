// ============================================================
// Agent Wallet – PolicyGuard : Persistent JSON Database
//
// Uses a single JSON file on disk for persistence.
// No native modules, no migrations — works out of the box.
// Replace with Prisma/PostgreSQL in production.
// ============================================================

import fs from "fs";
import path from "path";
import type { Agent, Policy, Transaction, ApprovalRequest, RiskAlert, User, Guardian, RecoveryRequest, GasQuota, AttackScenario, AnomalyEvent, AgentTask } from "./types";
import {
  DEMO_AGENTS,
  DEMO_POLICIES,
  DEMO_TRANSACTIONS,
  DEMO_APPROVALS,
  DEMO_RISK_ALERTS,
  DEMO_USERS,
} from "./mock-data";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

export interface DbState {
  users: User[];
  agents: Agent[];
  policies: Policy[];
  transactions: Transaction[];
  approvals: ApprovalRequest[];
  riskAlerts: RiskAlert[];
  lastUpdated: string;
  guardians: Guardian[];
  recoveryRequests: RecoveryRequest[];
  gasQuotas: GasQuota[];
  attackScenarios: AttackScenario[];
  anomalyEvents: AnomalyEvent[];
  tasks: AgentTask[];
}

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function defaultState(): DbState {
  return {
    users: DEMO_USERS,
    agents: DEMO_AGENTS,
    policies: DEMO_POLICIES,
    transactions: DEMO_TRANSACTIONS,
    approvals: DEMO_APPROVALS,
    riskAlerts: DEMO_RISK_ALERTS,
    lastUpdated: new Date().toISOString(),
    guardians: [],
    recoveryRequests: [],
    gasQuotas: [],
    attackScenarios: [],
    anomalyEvents: [],
    tasks: [],
  };
}

export function readDb(): DbState {
  try {
    ensureDir();
    if (!fs.existsSync(DB_PATH)) {
      const state = defaultState();
      writeDb(state);
      return state;
    }
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as DbState;
    return {
      ...parsed,
      guardians: parsed.guardians ?? [],
      recoveryRequests: parsed.recoveryRequests ?? [],
      gasQuotas: parsed.gasQuotas ?? [],
      attackScenarios: parsed.attackScenarios ?? [],
      anomalyEvents: parsed.anomalyEvents ?? [],
      tasks: parsed.tasks ?? [],
    };
  } catch {
    const state = defaultState();
    try { writeDb(state); } catch {}
    return state;
  }
}

export function writeDb(state: DbState): void {
  ensureDir();
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), "utf-8");
}

// ─── Convenience helpers ─────────────────────────────────────

export function getAgents(): Agent[] {
  return readDb().agents;
}

export function getAgent(id: string): Agent | undefined {
  return readDb().agents.find((a) => a.id === id);
}

export function upsertAgent(agent: Agent): Agent {
  const db = readDb();
  const idx = db.agents.findIndex((a) => a.id === agent.id);
  if (idx >= 0) {
    db.agents[idx] = agent;
  } else {
    db.agents.push(agent);
  }
  writeDb(db);
  return agent;
}

export function getPolicies(): Policy[] {
  return readDb().policies;
}

export function getPolicy(id: string): Policy | undefined {
  return readDb().policies.find((p) => p.id === id);
}

export function upsertPolicy(policy: Policy): Policy {
  const db = readDb();
  const idx = db.policies.findIndex((p) => p.id === policy.id);
  if (idx >= 0) {
    db.policies[idx] = policy;
  } else {
    db.policies.push(policy);
  }
  writeDb(db);
  return policy;
}

export function getTransactions(): Transaction[] {
  return readDb().transactions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function addTransaction(tx: Transaction): Transaction {
  const db = readDb();
  db.transactions.push(tx);
  writeDb(db);
  return tx;
}

export function updateTransaction(id: string, patch: Partial<Transaction>): Transaction | null {
  const db = readDb();
  const idx = db.transactions.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  db.transactions[idx] = { ...db.transactions[idx], ...patch };
  writeDb(db);
  return db.transactions[idx];
}

export function getApprovals(): ApprovalRequest[] {
  return readDb().approvals.sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );
}

export function getApproval(id: string): ApprovalRequest | undefined {
  return readDb().approvals.find((a) => a.id === id);
}

export function addApproval(req: ApprovalRequest): ApprovalRequest {
  const db = readDb();
  db.approvals.push(req);
  writeDb(db);
  return req;
}

export function updateApproval(id: string, patch: Partial<ApprovalRequest>): ApprovalRequest | null {
  const db = readDb();
  const idx = db.approvals.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  db.approvals[idx] = { ...db.approvals[idx], ...patch };
  writeDb(db);
  return db.approvals[idx];
}

export function addRiskAlert(alert: RiskAlert): RiskAlert {
  const db = readDb();
  db.riskAlerts.push(alert);
  writeDb(db);
  return alert;
}

export function acknowledgeRiskAlert(id: string): boolean {
  const db = readDb();
  const idx = db.riskAlerts.findIndex((a) => a.id === id);
  if (idx < 0) return false;
  db.riskAlerts[idx].acknowledged = true;
  writeDb(db);
  return true;
}

export function getStats() {
  const db = readDb();
  const txs = db.transactions;
  return {
    totalTransactions: txs.length,
    approvedPayments: txs.filter((t) => t.status === "approved").length,
    blockedPayments: txs.filter((t) => t.status === "blocked").length,
    pendingApprovals: db.approvals.filter((a) => a.status === "pending").length,
    totalVolumeUSD: txs.filter((t) => t.status === "approved").reduce((a, t) => a + t.amountUSD, 0),
    blockedVolumeUSD: txs.filter((t) => t.status === "blocked").reduce((a, t) => a + t.amountUSD, 0),
    activeAgents: db.agents.filter((a) => a.status === "active").length,
    activePolicies: db.policies.filter((p) => p.status === "active").length,
    criticalAlerts: db.riskAlerts.filter((a) => a.level === "critical" && !a.acknowledged).length,
  };
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Policy helpers ───────────────────────────────────────

export function deletePolicy(id: string): boolean {
  const db = readDb();
  const idx = db.policies.findIndex((p) => p.id === id);
  if (idx < 0) return false;
  db.policies.splice(idx, 1);
  writeDb(db);
  return true;
}

// ─── Spend recalculation helpers ─────────────────────────
// These query actual approved+pending transactions in the DB
// to prevent concurrent-request budget exploits.

export function getDailySpentForAgent(agentId: string, dateISO: string): number {
  const db = readDb();
  const day = dateISO.slice(0, 10); // "YYYY-MM-DD"
  return db.transactions
    .filter(
      (t) =>
        t.agentId === agentId &&
        (t.status === "approved" || t.status === "pending") &&
        t.timestamp.slice(0, 10) === day
    )
    .reduce((sum, t) => sum + t.amountUSD, 0);
}

export function getMonthlySpentForAgent(agentId: string, monthISO: string): number {
  const db = readDb();
  const month = monthISO.slice(0, 7); // "YYYY-MM"
  return db.transactions
    .filter(
      (t) =>
        t.agentId === agentId &&
        (t.status === "approved" || t.status === "pending") &&
        t.timestamp.slice(0, 7) === month
    )
    .reduce((sum, t) => sum + t.amountUSD, 0);
}

// ─── Guardian / Recovery helpers ─────────────────────────────

export function getGuardians(agentId?: string): Guardian[] {
  const db = readDb();
  if (agentId) return db.guardians.filter((g) => g.agentId === agentId);
  return db.guardians;
}

export function upsertGuardian(g: Guardian): Guardian {
  const db = readDb();
  const idx = db.guardians.findIndex((x) => x.id === g.id);
  if (idx >= 0) {
    db.guardians[idx] = g;
  } else {
    db.guardians.push(g);
  }
  writeDb(db);
  return g;
}

export function getRecoveryRequests(): RecoveryRequest[] {
  return readDb().recoveryRequests;
}

export function getRecoveryRequest(id: string): RecoveryRequest | undefined {
  return readDb().recoveryRequests.find((r) => r.id === id);
}

export function upsertRecoveryRequest(r: RecoveryRequest): RecoveryRequest {
  const db = readDb();
  const idx = db.recoveryRequests.findIndex((x) => x.id === r.id);
  if (idx >= 0) {
    db.recoveryRequests[idx] = r;
  } else {
    db.recoveryRequests.push(r);
  }
  writeDb(db);
  return r;
}

// ─── Gas quota helpers ────────────────────────────────────────

export function getGasQuota(agentId: string): GasQuota | undefined {
  return readDb().gasQuotas.find((q) => q.agentId === agentId);
}

export function upsertGasQuota(q: GasQuota): GasQuota {
  const db = readDb();
  const idx = db.gasQuotas.findIndex((x) => x.agentId === q.agentId);
  if (idx >= 0) {
    db.gasQuotas[idx] = q;
  } else {
    db.gasQuotas.push(q);
  }
  writeDb(db);
  return q;
}

export function getAllGasQuotas(): GasQuota[] {
  return readDb().gasQuotas;
}

// ─── Attack scenario helpers ──────────────────────────────────

export function getAttackScenarios(): AttackScenario[] {
  return readDb().attackScenarios;
}

export function upsertAttackScenario(s: AttackScenario): AttackScenario {
  const db = readDb();
  const idx = db.attackScenarios.findIndex((x) => x.id === s.id);
  if (idx >= 0) {
    db.attackScenarios[idx] = s;
  } else {
    db.attackScenarios.push(s);
  }
  writeDb(db);
  return s;
}

// ─── Anomaly event helpers ────────────────────────────────────

export function getAnomalyEvents(): AnomalyEvent[] {
  return readDb().anomalyEvents.sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );
}

export function addAnomalyEvent(e: AnomalyEvent): AnomalyEvent {
  const db = readDb();
  db.anomalyEvents.push(e);
  writeDb(db);
  return e;
}

export function acknowledgeAnomalyEvent(id: string): boolean {
  const db = readDb();
  const idx = db.anomalyEvents.findIndex((e) => e.id === id);
  if (idx < 0) return false;
  db.anomalyEvents[idx].acknowledged = true;
  writeDb(db);
  return true;
}

// ─── Agent Task helpers ───────────────────────────────────────

export function getTasks(filter?: { requesterId?: string; agentId?: string; status?: string }): AgentTask[] {
  const db = readDb();
  let tasks = db.tasks.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  if (filter?.requesterId) tasks = tasks.filter((t) => t.requesterId === filter.requesterId);
  if (filter?.agentId)     tasks = tasks.filter((t) => t.agentId === filter.agentId);
  if (filter?.status)      tasks = tasks.filter((t) => t.status === filter.status);
  return tasks;
}

export function getTask(id: string): AgentTask | undefined {
  return readDb().tasks.find((t) => t.id === id);
}

export function addTask(task: AgentTask): AgentTask {
  const db = readDb();
  db.tasks.push(task);
  writeDb(db);
  return task;
}

export function updateTask(id: string, patch: Partial<AgentTask>): AgentTask | null {
  const db = readDb();
  const idx = db.tasks.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  db.tasks[idx] = { ...db.tasks[idx], ...patch, updatedAt: new Date().toISOString() };
  writeDb(db);
  return db.tasks[idx];
}
