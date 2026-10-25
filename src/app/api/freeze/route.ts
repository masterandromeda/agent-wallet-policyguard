import { NextResponse } from "next/server";
import { getAgent, upsertAgent, addRiskAlert, generateId } from "@/lib/db";
import { broadcast } from "@/lib/broadcast";
import type { RiskAlert } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }
  const agent = getAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json({
    data: { agentId: agent.id, status: agent.status, frozen: agent.status === "suspended" },
  });
}

export async function POST(request: Request) {
  let body: { agentId?: string; reason?: string; ownerId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agentId, reason, ownerId } = body;
  if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  if (!reason?.trim()) return NextResponse.json({ error: "reason is required" }, { status: 400 });

  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const frozenAt = new Date().toISOString();
  const frozenAgent = { ...agent, status: "suspended" as const, lastActive: frozenAt };
  upsertAgent(frozenAgent);

  broadcast({ type: "agent_frozen", payload: { agent: frozenAgent, reason, frozenAt, ownerId } });
  broadcast({ type: "agent_update", payload: frozenAgent });

  const alert: RiskAlert = {
    id: generateId("ra"),
    agentId: agent.id,
    agentName: agent.name,
    level: "critical",
    title: `Agent Frozen – ${agent.name}`,
    description: `Agent was manually frozen. Reason: ${reason}`,
    explanation: `Owner (${ownerId ?? "unknown"}) suspended this agent at ${frozenAt}. All future transactions will be blocked until the agent is reactivated. Reason provided: ${reason}`,
    timestamp: frozenAt,
    acknowledged: false,
  };
  addRiskAlert(alert);

  return NextResponse.json({ data: frozenAgent, frozenAt }, { status: 200 });
}
