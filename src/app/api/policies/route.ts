import { NextResponse } from "next/server";
import {
  getPolicies, getPolicy, upsertPolicy, deletePolicy, generateId,
} from "@/lib/db";
import { broadcast } from "@/lib/broadcast";
import type { Policy, PolicyRule } from "@/lib/types";

// ─── GET /api/policies ────────────────────────────────────────
// Query params: ownerId, agentId, status
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("ownerId");
  const agentId = searchParams.get("agentId");
  const status  = searchParams.get("status") as Policy["status"] | null;

  let policies = getPolicies();
  if (ownerId) policies = policies.filter((p) => p.ownerId === ownerId);
  if (agentId) policies = policies.filter((p) => p.agentIds.includes(agentId));
  if (status)  policies = policies.filter((p) => p.status === status);

  return NextResponse.json({
    data: policies,
    total: policies.length,
    meta: {
      note: "Server-side policy enforcement is active. On-chain enforcement requires ERC-4337 deployment.",
    },
  });
}

// ─── POST /api/policies ───────────────────────────────────────
// Create a new policy
export async function POST(request: Request) {
  let body: {
    name?: string;
    description?: string;
    ownerId?: string;
    agentIds?: string[];
    status?: Policy["status"];
    rules?: Omit<PolicyRule, "id">[];
    expiresAt?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.ownerId?.trim()) {
    return NextResponse.json({ error: "ownerId is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const policy: Policy = {
    id: generateId("pol"),
    name: body.name.trim(),
    description: body.description?.trim() ?? "",
    ownerId: body.ownerId,
    agentIds: body.agentIds ?? [],
    status: body.status ?? "active",
    rules: (body.rules ?? []).map((r) => ({
      ...r,
      id: generateId("rule"),
    })),
    createdAt: now,
    updatedAt: now,
    expiresAt: body.expiresAt,
  };

  upsertPolicy(policy);
  broadcast({ type: "policy_update", payload: { action: "created", policy } });

  return NextResponse.json({ data: policy }, { status: 201 });
}

// ─── PATCH /api/policies ──────────────────────────────────────
// Update an existing policy (partial update by id)
export async function PATCH(request: Request) {
  let body: {
    id?: string;
    name?: string;
    description?: string;
    agentIds?: string[];
    status?: Policy["status"];
    rules?: PolicyRule[];
    expiresAt?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = getPolicy(body.id);
  if (!existing) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  const updated: Policy = {
    ...existing,
    ...(body.name        !== undefined ? { name: body.name }               : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.agentIds    !== undefined ? { agentIds: body.agentIds }       : {}),
    ...(body.status      !== undefined ? { status: body.status }           : {}),
    ...(body.rules       !== undefined ? { rules: body.rules }             : {}),
    ...(body.expiresAt   !== undefined ? { expiresAt: body.expiresAt }     : {}),
    updatedAt: new Date().toISOString(),
  };

  upsertPolicy(updated);
  broadcast({ type: "policy_update", payload: { action: "updated", policy: updated } });

  return NextResponse.json({ data: updated });
}

// ─── DELETE /api/policies?id=xxx ─────────────────────────────
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id query param is required" }, { status: 400 });
  }

  const ok = deletePolicy(id);
  if (!ok) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  broadcast({ type: "policy_update", payload: { action: "deleted", id } });
  return NextResponse.json({ success: true, id });
}
