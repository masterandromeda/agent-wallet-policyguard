import { NextResponse } from "next/server";
import {
  getRecoveryRequests,
  getRecoveryRequest,
  upsertRecoveryRequest,
  getAgent,
  generateId,
} from "@/lib/db";
import { broadcast } from "@/lib/broadcast";
import type { RecoveryRequest, Guardian } from "@/lib/types";

export async function GET() {
  const requests = getRecoveryRequests();
  return NextResponse.json({ data: requests, total: requests.length });
}

export async function POST(request: Request) {
  let body: {
    agentId?: string;
    newOwnerAddress?: string;
    requestedBy?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agentId, newOwnerAddress, requestedBy, notes } = body;
  if (!agentId) return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  if (!newOwnerAddress?.trim()) return NextResponse.json({ error: "newOwnerAddress is required" }, { status: 400 });
  if (!requestedBy?.trim()) return NextResponse.json({ error: "requestedBy is required" }, { status: 400 });

  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const now = new Date();
  const executeAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  // Create 5 default guardians
  const guardians: Guardian[] = [
    { id: generateId("grd"), agentId, name: "Guardian Alpha", address: "0xA001000000000000000000000000000000000001", approved: false },
    { id: generateId("grd"), agentId, name: "Guardian Beta",  address: "0xA001000000000000000000000000000000000002", approved: false },
    { id: generateId("grd"), agentId, name: "Guardian Gamma", address: "0xA001000000000000000000000000000000000003", approved: false },
    { id: generateId("grd"), agentId, name: "Guardian Delta", address: "0xA001000000000000000000000000000000000004", approved: false },
    { id: generateId("grd"), agentId, name: "Guardian Epsilon",address: "0xA001000000000000000000000000000000000005", approved: false },
  ];

  const recoveryRequest: RecoveryRequest = {
    id: generateId("rec"),
    agentId,
    agentName: agent.name,
    requestedBy,
    newOwnerAddress,
    status: "voting",
    guardians,
    approvalsNeeded: 3,
    approvalsReceived: 0,
    requestedAt: now.toISOString(),
    executeAfter,
    vetoed: false,
    notes,
  };

  upsertRecoveryRequest(recoveryRequest);
  broadcast({ type: "recovery_update", payload: recoveryRequest });

  return NextResponse.json({ data: recoveryRequest }, { status: 201 });
}

export async function PATCH(request: Request) {
  let body: { recoveryId?: string; guardianId?: string; action?: "approve" | "veto" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { recoveryId, guardianId, action } = body;
  if (!recoveryId) return NextResponse.json({ error: "recoveryId is required" }, { status: 400 });
  if (!guardianId) return NextResponse.json({ error: "guardianId is required" }, { status: 400 });
  if (action !== "approve" && action !== "veto") {
    return NextResponse.json({ error: "action must be 'approve' or 'veto'" }, { status: 400 });
  }

  const rec = getRecoveryRequest(recoveryId);
  if (!rec) return NextResponse.json({ error: "Recovery request not found" }, { status: 404 });

  if (rec.status === "vetoed" || rec.status === "executed") {
    return NextResponse.json({ error: `Recovery is already ${rec.status}` }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (action === "veto") {
    const updated: RecoveryRequest = { ...rec, status: "vetoed", vetoed: true, vetoedAt: now };
    upsertRecoveryRequest(updated);
    broadcast({ type: "recovery_update", payload: updated });
    return NextResponse.json({ data: updated });
  }

  // action === "approve"
  const guardianIdx = rec.guardians.findIndex((g) => g.id === guardianId);
  if (guardianIdx < 0) return NextResponse.json({ error: "Guardian not found" }, { status: 404 });
  if (rec.guardians[guardianIdx].approved) {
    return NextResponse.json({ error: "Guardian has already approved" }, { status: 409 });
  }

  const updatedGuardians: Guardian[] = rec.guardians.map((g, i) =>
    i === guardianIdx ? { ...g, approved: true, approvedAt: now } : g
  );
  const approvalsReceived = updatedGuardians.filter((g) => g.approved).length;
  const newStatus =
    approvalsReceived >= rec.approvalsNeeded ? "delay" : rec.status;

  const updated: RecoveryRequest = {
    ...rec,
    guardians: updatedGuardians,
    approvalsReceived,
    status: newStatus,
  };
  upsertRecoveryRequest(updated);
  broadcast({ type: "recovery_update", payload: updated });

  return NextResponse.json({ data: updated });
}
