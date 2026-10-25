import { NextResponse } from "next/server";
import {
  getAnomalyEvents,
  addAnomalyEvent,
  acknowledgeAnomalyEvent,
  getAgent,
  upsertAgent,
  getTransactions,
  generateId,
} from "@/lib/db";
import { broadcast } from "@/lib/broadcast";
import type { AnomalyEvent } from "@/lib/types";

export async function GET() {
  const events = getAnomalyEvents();
  return NextResponse.json({ data: events, total: events.length });
}

export async function POST(request: Request) {
  let body: { agentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agentId } = body;
  if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });

  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  const allTxs = getTransactions().filter((t) => t.agentId === agentId);

  const detectedEvents: AnomalyEvent[] = [];

  // ── Check 1: rapid_fire — >3 transactions in 5 minutes ──────
  const recentTxs = allTxs.filter((t) => new Date(t.timestamp) >= fiveMinutesAgo);
  if (recentTxs.length > 3) {
    const event: AnomalyEvent = {
      id: generateId("anm"),
      agentId,
      agentName: agent.name,
      detectedAt: now.toISOString(),
      type: "rapid_fire",
      description: `${recentTxs.length} transactions detected within 5 minutes (threshold: 3).`,
      autoFroze: false,
      acknowledged: false,
      transactionIds: recentTxs.map((t) => t.id),
    };
    addAnomalyEvent(event);
    detectedEvents.push(event);
    broadcast({ type: "anomaly_detected", payload: event });
  }

  // ── Check 2: large_spike — single tx >80% of daily limit ────
  const dailyLimit = agent.spendingBudget.dailyLimitUSD;
  if (dailyLimit > 0) {
    const threshold = dailyLimit * 0.8;
    const todayStr = now.toISOString().slice(0, 10);
    const todayTxs = allTxs.filter((t) => t.timestamp.slice(0, 10) === todayStr);
    const spikeTx = todayTxs.find((t) => t.amountUSD > threshold);
    if (spikeTx) {
      const event: AnomalyEvent = {
        id: generateId("anm"),
        agentId,
        agentName: agent.name,
        detectedAt: now.toISOString(),
        type: "large_spike",
        description: `Transaction of $${spikeTx.amountUSD} exceeds 80% of daily limit ($${threshold.toFixed(2)}).`,
        autoFroze: false,
        acknowledged: false,
        transactionIds: [spikeTx.id],
      };
      addAnomalyEvent(event);
      detectedEvents.push(event);
      broadcast({ type: "anomaly_detected", payload: event });
    }
  }

  // ── Check 3: off_hours — transaction outside 9am-6pm UTC ────
  const hour = now.getUTCHours();
  const isOffHours = hour < 9 || hour >= 18;
  if (isOffHours && allTxs.length > 0) {
    const latestTx = allTxs[0]; // already sorted desc
    const latestHour = new Date(latestTx.timestamp).getUTCHours();
    if (latestHour < 9 || latestHour >= 18) {
      const event: AnomalyEvent = {
        id: generateId("anm"),
        agentId,
        agentName: agent.name,
        detectedAt: now.toISOString(),
        type: "off_hours",
        description: `Transaction detected outside business hours (${latestHour}:00 UTC). Allowed window: 09:00–18:00 UTC.`,
        autoFroze: false,
        acknowledged: false,
        transactionIds: [latestTx.id],
      };
      addAnomalyEvent(event);
      detectedEvents.push(event);
      broadcast({ type: "anomaly_detected", payload: event });
    }
  }

  // ── Auto-freeze if rapid_fire detected ──────────────────────
  const rapidFire = detectedEvents.find((e) => e.type === "rapid_fire");
  if (rapidFire) {
    const frozenAgent = { ...agent, status: "suspended" as const, lastActive: now.toISOString() };
    upsertAgent(frozenAgent);
    // Update the event to reflect auto-freeze
    const updatedEvent: AnomalyEvent = { ...rapidFire, autoFroze: true };
    addAnomalyEvent(updatedEvent);
    broadcast({ type: "agent_frozen", payload: { agent: frozenAgent, reason: "Auto-frozen: rapid-fire transactions detected", frozenAt: now.toISOString() } });
    broadcast({ type: "agent_update", payload: frozenAgent });
  }

  return NextResponse.json({ data: detectedEvents, total: detectedEvents.length }, { status: 200 });
}

export async function PATCH(request: Request) {
  let body: { eventId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { eventId } = body;
  if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

  const ok = acknowledgeAnomalyEvent(eventId);
  if (!ok) return NextResponse.json({ error: "Anomaly event not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
