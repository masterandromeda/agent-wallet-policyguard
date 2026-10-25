// ============================================================
// Agent Wallet – PolicyGuard : SSE Broadcast Hub
//
// Singleton event bus used by all API routes to push events
// to connected dashboard clients in real-time.
// ============================================================

export type BroadcastEventType =
  | "transaction_new"
  | "transaction_update"
  | "approval_new"
  | "approval_update"
  | "agent_update"
  | "policy_update"
  | "risk_alert"
  | "stats_update"
  | "heartbeat"
  | "agent_frozen"
  | "recovery_update"
  | "anomaly_detected"
  | "gas_quota_update"
  | "attack_result"
  | "task_new"
  | "task_update";

export interface BroadcastEvent {
  type: BroadcastEventType;
  payload: unknown;
  timestamp: string;
  forRoles?: Array<"owner" | "customer" | "agent">; // undefined = all roles
}

type Subscriber = (event: BroadcastEvent) => void;

// Global singleton — survives across Next.js route module re-evaluations
const globalForHub = globalThis as typeof globalThis & {
  _pgHubSubscribers?: Set<Subscriber>;
};

function getSubscribers(): Set<Subscriber> {
  if (!globalForHub._pgHubSubscribers) {
    globalForHub._pgHubSubscribers = new Set();
  }
  return globalForHub._pgHubSubscribers;
}

export function subscribe(fn: Subscriber): () => void {
  const subs = getSubscribers();
  subs.add(fn);
  return () => subs.delete(fn);
}

export function broadcast(event: Omit<BroadcastEvent, "timestamp">): void {
  const full: BroadcastEvent = { ...event, timestamp: new Date().toISOString() };
  for (const fn of getSubscribers()) {
    try { fn(full); } catch {}
  }
}
