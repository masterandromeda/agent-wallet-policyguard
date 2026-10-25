// ============================================================
// Agent Wallet – PolicyGuard : Core TypeScript Types
// ============================================================

export type Role = "owner" | "customer" | "agent";
export type AgentStatus = "active" | "paused" | "suspended" | "pending";
export type TxStatus = "approved" | "blocked" | "pending" | "failed";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type PolicyStatus = "active" | "inactive" | "expired";
export type NetworkStatus = "connected" | "syncing" | "disconnected";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

// ─── User / Owner ────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  walletAddress?: string;
  createdAt: string;
  avatarUrl?: string;
}

// ─── AI Agent ────────────────────────────────────────────────
export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  ownerId: string;
  walletAddress: string;
  permissions: AgentPermission[];
  spendingBudget: SpendingBudget;
  riskScore: number; // 0-100, advisory only – NOT the security authority
  lastActive: string;
  createdAt: string;
  tags: string[];
}

export interface AgentPermission {
  id: string;
  type: "transfer" | "contract_call" | "swap" | "bridge" | "approve";
  description: string;
  granted: boolean;
  expiresAt?: string;
}

export interface SpendingBudget {
  dailyLimitUSD: number;
  dailySpentUSD: number;
  monthlyLimitUSD: number;
  monthlySpentUSD: number;
  perTxLimitUSD: number;
}

// ─── Policy ──────────────────────────────────────────────────
export interface Policy {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  agentIds: string[];
  status: PolicyStatus;
  rules: PolicyRule[];
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface PolicyRule {
  id: string;
  type:
    | "max_tx_amount"
    | "daily_limit"
    | "monthly_limit"
    | "allowed_recipients"
    | "allowed_contracts"
    | "allowed_functions"
    | "time_window"
    | "require_approval";
  label: string;
  value: string | number | string[];
  enabled: boolean;
}

// ─── Transaction ─────────────────────────────────────────────
export interface Transaction {
  id: string;
  hash?: string; // undefined until on-chain; never fabricate a real hash
  agentId: string;
  agentName: string;
  fromAddress: string;
  toAddress: string;
  toLabel?: string;
  amountUSD: number;
  amountETH?: number;
  status: TxStatus;
  policyId?: string;
  policyName?: string;
  blockReason?: string;
  riskScore: number;
  riskFlags: string[];
  network: "sepolia" | "mainnet" | "simulated";
  blockNumber?: number;
  gasUsed?: number;
  timestamp: string;
  userOpHash?: string; // ERC-4337 UserOperation hash
  isSimulated: boolean; // ALWAYS clearly labeled
  // Extended fields for live workflows
  requesterId?: string;   // customer user id who submitted this request
  requesterName?: string; // display name of requester
  purpose?: string;       // human-readable purchase purpose
}

// ─── Approval Request ────────────────────────────────────────
export interface ApprovalRequest {
  id: string;
  agentId: string;
  agentName: string;
  ownerId: string;
  transactionId: string;
  reason: string;
  requestedAmount: number;
  toAddress: string;
  toLabel?: string;
  status: ApprovalStatus;
  policyViolations: string[];
  riskScore: number;
  requestedAt: string;
  respondedAt?: string;
  expiresAt: string;
  notes?: string;
  // Extended fields for live workflows
  requesterId?: string;
  requesterName?: string;
}

// ─── Risk Alert ──────────────────────────────────────────────
export interface RiskAlert {
  id: string;
  agentId?: string;
  agentName?: string;
  transactionId?: string;
  level: RiskLevel;
  title: string;
  description: string;
  explanation: string; // explainable AI – must describe WHY
  timestamp: string;
  acknowledged: boolean;
  policyViolated?: string;
}

// ─── Dashboard Stats ─────────────────────────────────────────
export interface DashboardStats {
  totalTransactions: number;
  approvedPayments: number;
  blockedPayments: number;
  pendingApprovals: number;
  totalVolumeUSD: number;
  blockedVolumeUSD: number;
  activeAgents: number;
  activePolicies: number;
  criticalAlerts: number;
}

// ─── Chart Data ──────────────────────────────────────────────
export interface TimeSeriesPoint {
  date: string;
  approved: number;
  blocked: number;
  volume: number;
}

export interface SpendingByAgent {
  agentName: string;
  spentUSD: number;
  limitUSD: number;
}

// ─── Network / Blockchain ────────────────────────────────────
export interface NetworkInfo {
  name: string;
  chainId: number;
  status: NetworkStatus;
  latestBlock?: number;
  rpcUrl?: string; // never expose private keys
  explorerUrl?: string;
  isTestnet: boolean;
}

// ─── Server-Sent Events ──────────────────────────────────────
export type SSEEventType =
  | "transaction_update"
  | "agent_status_change"
  | "policy_alert"
  | "approval_request"
  | "risk_alert";

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  payload: T;
  timestamp: string;
}

// ─── Guardian Recovery ───────────────────────────────────────
export type RecoveryStatus = "idle" | "requested" | "voting" | "delay" | "approved" | "executed" | "vetoed";

export interface Guardian {
  id: string;
  agentId: string;
  name: string;
  address: string;   // Ethereum address (non-sensitive)
  email?: string;
  approved: boolean;
  approvedAt?: string;
}

export interface RecoveryRequest {
  id: string;
  agentId: string;
  agentName: string;
  requestedBy: string;   // wallet address
  newOwnerAddress: string;
  status: RecoveryStatus;
  guardians: Guardian[];
  approvalsNeeded: number;   // e.g. 3
  approvalsReceived: number;
  requestedAt: string;
  executeAfter: string;      // 48h delay
  vetoed: boolean;
  vetoedAt?: string;
  executedAt?: string;
  notes?: string;
}

// ─── Gas Sponsorship ─────────────────────────────────────────
export interface GasQuota {
  id: string;
  agentId: string;
  agentName: string;
  dailyGasLimitUSD: number;
  dailyGasUsedUSD: number;
  monthlyGasLimitUSD: number;
  monthlyGasUsedUSD: number;
  totalSponsoredUSD: number;
  paymasterConfigured: boolean;
  lastReset: string;
}

// ─── Attack Simulation ───────────────────────────────────────
export type AttackScenarioStatus = "idle" | "running" | "passed" | "failed";

export interface AttackScenario {
  id: string;
  name: string;
  description: string;
  attackType: "excessive_spend" | "unapproved_recipient" | "expired_permission" | "prohibited_contract" | "rapid_fire";
  expectedOutcome: "blocked" | "pending" | "approved";
  actualOutcome?: "blocked" | "pending" | "approved";
  status: AttackScenarioStatus;
  policyViolations?: string[];
  riskScore?: number;
  ranAt?: string;
  passed?: boolean;
  transactionId?: string;
}

// ─── Anomaly Detection ──────────────────────────────────────
export interface AnomalyEvent {
  id: string;
  agentId: string;
  agentName: string;
  detectedAt: string;
  type: "rapid_fire" | "large_spike" | "off_hours" | "new_recipient" | "cumulative_limit";
  description: string;
  autoFroze: boolean;
  acknowledged: boolean;
  transactionIds: string[];
}

// ─── Agent Task (end-to-end workflow unit) ───────────────────
// Created when a customer submits a purchase request.
// Updated as the agent processes it through the policy engine.
export type TaskStatus =
  | "queued"          // received, not yet processed
  | "parsing"         // agent interpreting request
  | "policy_check"    // running server-side policy engine
  | "awaiting_approval" // pending owner decision
  | "executing"       // approved, writing to DB / sandbox
  | "completed"       // success
  | "blocked"         // policy blocked, no execution
  | "rejected"        // owner rejected
  | "failed";         // unexpected error

export interface TaskExecutionStep {
  step: number;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
  timestamp: string;
}

export interface AgentTask {
  id: string;
  requesterId: string;      // customer user id
  requesterName: string;
  agentId: string;
  agentName: string;
  // Request details
  merchant: string;         // toLabel
  merchantAddress: string;  // toAddress
  amountUSD: number;
  purpose: string;
  // Workflow state
  status: TaskStatus;
  steps: TaskExecutionStep[];
  // Linked records (set after policy engine runs)
  transactionId?: string;
  approvalRequestId?: string;
  // Policy engine output
  policyDecision?: "approved" | "blocked" | "pending";
  blockReason?: string;
  riskScore?: number;
  riskFlags?: string[];
  policyChecks?: Array<{ rule: string; passed: boolean; detail: string }>;
  // Result
  result?: string;          // human-readable outcome
  errorMessage?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  // Simulated flag
  isSimulated: boolean;
}
