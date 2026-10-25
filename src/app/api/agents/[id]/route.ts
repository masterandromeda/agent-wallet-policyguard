import { NextResponse } from "next/server";
import { getAgent, upsertAgent, getAgents } from "@/lib/db";
import { broadcast } from "@/lib/broadcast";
import type { AgentStatus } from "@/lib/types";

// PATCH /api/agents/[id] — update agent status, budget, permissions
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = getAgent(id);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate status transitions
  if (body.status !== undefined) {
    const validStatuses: AgentStatus[] = ["active", "paused", "suspended", "pending"];
    if (!validStatuses.includes(body.status as AgentStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
  }

  // Validate budget fields
  if (body.spendingBudget) {
    const b = body.spendingBudget as Record<string, number>;
    if (b.dailyLimitUSD !== undefined && b.dailyLimitUSD < 0)
      return NextResponse.json({ error: "dailyLimitUSD must be >= 0" }, { status: 400 });
    if (b.perTxLimitUSD !== undefined && b.perTxLimitUSD < 0)
      return NextResponse.json({ error: "perTxLimitUSD must be >= 0" }, { status: 400 });
  }

  const updated: typeof agent = {
    ...agent,
    status: body.status !== undefined ? (body.status as AgentStatus) : agent.status,
    spendingBudget: body.spendingBudget
      ? { ...agent.spendingBudget, ...(body.spendingBudget as Partial<typeof agent.spendingBudget>) }
      : agent.spendingBudget,
    permissions: body.permissions ? (body.permissions as typeof agent.permissions) : agent.permissions,
    tags: body.tags ? (body.tags as string[]) : agent.tags,
    description: body.description !== undefined ? String(body.description) : agent.description,
    lastActive: new Date().toISOString(),
  };

  upsertAgent(updated);
  broadcast({ type: "agent_update", payload: updated });

  return NextResponse.json({ data: updated });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = getAgent(id);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ data: agent });
}
