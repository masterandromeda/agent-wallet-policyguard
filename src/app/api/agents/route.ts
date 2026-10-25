import { NextResponse } from "next/server";
import { getAgents, upsertAgent, generateId } from "@/lib/db";
import { broadcast } from "@/lib/broadcast";
import type { Agent, AgentPermission, SpendingBudget } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("ownerId");
  let agents = getAgents();
  if (ownerId) agents = agents.filter((a) => a.ownerId === ownerId);
  return NextResponse.json({ data: agents, total: agents.length });
}

export async function POST(request: Request) {
  let body: Partial<Agent> & { ownerId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, description, ownerId, spendingBudget } = body;
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!ownerId?.trim()) return NextResponse.json({ error: "ownerId is required" }, { status: 400 });

  const budget: SpendingBudget = {
    dailyLimitUSD: Number(spendingBudget?.dailyLimitUSD ?? 1000),
    dailySpentUSD: 0,
    monthlyLimitUSD: Number(spendingBudget?.monthlyLimitUSD ?? 10000),
    monthlySpentUSD: 0,
    perTxLimitUSD: Number(spendingBudget?.perTxLimitUSD ?? 500),
  };

  const defaultPermissions: AgentPermission[] = [
    { id: generateId("perm"), type: "transfer", description: "Send payments", granted: false },
  ];

  const agent: Agent = {
    id: generateId("agt"),
    name: name.trim(),
    description: description?.trim() ?? "",
    status: "pending",
    ownerId,
    walletAddress: `0x${generateId("").replace(/_/g, "").padEnd(40, "0").slice(0, 40)}`,
    permissions: body.permissions ?? defaultPermissions,
    spendingBudget: budget,
    riskScore: 0,
    lastActive: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    tags: body.tags ?? [],
  };

  upsertAgent(agent);
  broadcast({ type: "agent_update", payload: agent });

  return NextResponse.json({ data: agent }, { status: 201 });
}
