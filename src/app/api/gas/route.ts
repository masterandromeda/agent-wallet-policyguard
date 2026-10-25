import { NextResponse } from "next/server";
import { getAgent, getGasQuota, upsertGasQuota, getAllGasQuotas, generateId } from "@/lib/db";
import { broadcast } from "@/lib/broadcast";
import type { GasQuota } from "@/lib/types";

function createDefaultQuota(agentId: string, agentName: string): GasQuota {
  return {
    id: generateId("gq"),
    agentId,
    agentName,
    dailyGasLimitUSD: 10,
    dailyGasUsedUSD: 0,
    monthlyGasLimitUSD: 200,
    monthlyGasUsedUSD: 0,
    totalSponsoredUSD: 0,
    paymasterConfigured: false,
    lastReset: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  if (agentId) {
    const agent = getAgent(agentId);
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    let quota = getGasQuota(agentId);
    if (!quota) {
      quota = createDefaultQuota(agentId, agent.name);
      upsertGasQuota(quota);
    }
    return NextResponse.json({ data: quota });
  }

  return NextResponse.json({ data: getAllGasQuotas() });
}

export async function POST(request: Request) {
  let body: { agentId?: string; amountUSD?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agentId, amountUSD } = body;
  if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  if (typeof amountUSD !== "number" || amountUSD <= 0) {
    return NextResponse.json({ error: "amountUSD must be a positive number" }, { status: 400 });
  }

  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  let quota = getGasQuota(agentId);
  if (!quota) {
    quota = createDefaultQuota(agentId, agent.name);
  }

  if (quota.dailyGasUsedUSD + amountUSD > quota.dailyGasLimitUSD) {
    return NextResponse.json(
      { error: "Daily gas limit exceeded", quota },
      { status: 429 }
    );
  }

  const updated: GasQuota = {
    ...quota,
    dailyGasUsedUSD: quota.dailyGasUsedUSD + amountUSD,
    monthlyGasUsedUSD: quota.monthlyGasUsedUSD + amountUSD,
    totalSponsoredUSD: quota.totalSponsoredUSD + amountUSD,
  };
  upsertGasQuota(updated);
  broadcast({ type: "gas_quota_update", payload: updated });

  return NextResponse.json({ data: updated }, { status: 200 });
}

export async function PATCH(request: Request) {
  let body: { agentId?: string; dailyGasLimitUSD?: number; monthlyGasLimitUSD?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agentId, dailyGasLimitUSD, monthlyGasLimitUSD } = body;
  if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });

  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  let quota = getGasQuota(agentId);
  if (!quota) {
    quota = createDefaultQuota(agentId, agent.name);
  }

  const updated: GasQuota = {
    ...quota,
    ...(typeof dailyGasLimitUSD === "number" ? { dailyGasLimitUSD } : {}),
    ...(typeof monthlyGasLimitUSD === "number" ? { monthlyGasLimitUSD } : {}),
  };
  upsertGasQuota(updated);
  broadcast({ type: "gas_quota_update", payload: updated });

  return NextResponse.json({ data: updated });
}
