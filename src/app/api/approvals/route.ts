import { NextResponse } from "next/server";
import {
  getApprovals, getApproval, updateApproval,
  updateTransaction, getAgent, upsertAgent, getStats, generateId, addRiskAlert,
} from "@/lib/db";
import { broadcast } from "@/lib/broadcast";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("ownerId");
  const status = searchParams.get("status");
  const requesterId = searchParams.get("requesterId");

  let approvals = getApprovals();
  if (ownerId) approvals = approvals.filter((a) => a.ownerId === ownerId);
  if (status) approvals = approvals.filter((a) => a.status === status);
  if (requesterId) {
    approvals = approvals.filter(
      (a) => (a as typeof a & { requesterId?: string }).requesterId === requesterId
    );
  }
  return NextResponse.json({ data: approvals, total: approvals.length });
}

export async function POST(request: Request) {
  // Owner takes action on an approval request
  let body: { approvalId?: string; action?: "approve" | "reject"; notes?: string; ownerId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.approvalId) return NextResponse.json({ error: "approvalId required" }, { status: 400 });
  if (!body.action || !["approve", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const approval = getApproval(body.approvalId);
  if (!approval) return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
  if (approval.status !== "pending") {
    return NextResponse.json({ error: "Approval request is no longer pending" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const newApprovalStatus = body.action === "approve" ? "approved" : "rejected";
  const newTxStatus = body.action === "approve" ? "approved" : "blocked";

  // Update approval
  const updatedApproval = updateApproval(approval.id, {
    status: newApprovalStatus,
    respondedAt: now,
    notes: body.notes,
  });

  // Update linked transaction
  if (approval.transactionId) {
    updateTransaction(approval.transactionId, {
      status: newTxStatus,
      ...(body.action === "reject" && {
        blockReason: `Rejected by owner: ${body.notes ?? "No reason provided"}`,
      }),
    });
  }

  // Update agent spending if approved
  if (body.action === "approve") {
    const agent = getAgent(approval.agentId);
    if (agent) {
      const updatedAgent = {
        ...agent,
        spendingBudget: {
          ...agent.spendingBudget,
          dailySpentUSD: agent.spendingBudget.dailySpentUSD + approval.requestedAmount,
          monthlySpentUSD: agent.spendingBudget.monthlySpentUSD + approval.requestedAmount,
        },
        lastActive: now,
      };
      upsertAgent(updatedAgent);
      broadcast({ type: "agent_update", payload: updatedAgent });
    }
  }

  broadcast({ type: "approval_update", payload: updatedApproval });
  broadcast({
    type: "transaction_update",
    payload: { transactionId: approval.transactionId, status: newTxStatus },
  });
  broadcast({ type: "stats_update", payload: getStats() });

  return NextResponse.json({ data: updatedApproval });
}
