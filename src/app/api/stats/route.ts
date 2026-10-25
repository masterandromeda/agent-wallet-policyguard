import { NextResponse } from "next/server";
import { getStats, getTransactions, readDb } from "@/lib/db";

export async function GET() {
  const db = readDb();
  const stats = getStats();
  const recentTransactions = getTransactions().slice(0, 10);
  const riskAlerts = db.riskAlerts ?? [];

  // 7-day activity breakdown (last 7 calendar days)
  const days: { day: string; approved: number; blocked: number; volume: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayTxs = db.transactions.filter((t) => t.timestamp.slice(0, 10) === dayStr);
    days.push({
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      approved: dayTxs.filter((t) => t.status === "approved").length,
      blocked:  dayTxs.filter((t) => t.status === "blocked").length,
      volume:   dayTxs.filter((t) => t.status === "approved").reduce((s, t) => s + t.amountUSD, 0),
    });
  }

  return NextResponse.json({
    data: stats,
    stats,
    recentTransactions,
    pendingApprovals: db.approvals.filter((a) => a.status === "pending").length,
    activeAgents: db.agents.filter((a) => a.status === "active").length,
    unacknowledgedAlerts: riskAlerts.filter((a) => !a.acknowledged).length,
    agents: db.agents,
    riskAlerts: riskAlerts.filter((a) => !a.acknowledged).slice(0, 5),
    chart7d: days,
  });
}
