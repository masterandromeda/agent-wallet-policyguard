// ============================================================
// Agent Wallet – PolicyGuard : Export API
//
// GET /api/export?format=csv&from=&to=&status=
// GET /api/export?format=pdf&from=&to=&status=
//
// Generates real reports from the persistent DB — never fake data.
// CSV: structured, machine-readable transaction records.
// PDF: plain-text formatted report (no binary deps — uses text/html
//      so the browser can print to PDF with full fidelity).
// ============================================================

import { NextResponse } from "next/server";
import { getTransactions, getStats, readDb } from "@/lib/db";
import type { Transaction } from "@/lib/types";

function escapeCSV(v: string | number | boolean | undefined | null): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function filterTxs(from: string | null, to: string | null, status: string | null): Transaction[] {
  let txs = getTransactions();
  if (from)   txs = txs.filter((t) => t.timestamp >= from);
  if (to)     txs = txs.filter((t) => t.timestamp <= to + "T23:59:59Z");
  if (status && status !== "all") txs = txs.filter((t) => t.status === status);
  return txs;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";
  const from   = searchParams.get("from");
  const to     = searchParams.get("to");
  const status = searchParams.get("status");

  const txs   = filterTxs(from, to, status);
  const stats = getStats();
  const db    = readDb();

  const now        = new Date().toLocaleString("en-US", { timeZone: "UTC" });
  const periodStr  = from && to ? `${from} to ${to}` : from ? `From ${from}` : to ? `To ${to}` : "All time";
  const statusStr  = status && status !== "all" ? status : "All";

  // ─── CSV ─────────────────────────────────────────────────────
  if (format === "csv") {
    const headers = [
      "Transaction ID", "Task ID", "Timestamp", "Agent ID", "Agent Name",
      "Requester ID", "Requester Name", "Merchant / Recipient", "Recipient Address",
      "Amount (USD)", "Status", "Policy ID", "Policy Name",
      "Block Reason", "Risk Score", "Risk Flags", "Policy Decision",
      "Approval Required", "Network", "Is Simulated", "Purpose",
    ];

    const rows = txs.map((t) => {
      const apr = db.approvals.find((a) => a.transactionId === t.id);
      const task = db.tasks.find((tk) => tk.transactionId === t.id);
      return [
        t.id,
        task?.id ?? "",
        t.timestamp,
        t.agentId,
        t.agentName,
        t.requesterId ?? "",
        t.requesterName ?? "",
        t.toLabel ?? "",
        t.toAddress,
        t.amountUSD.toFixed(2),
        t.status,
        t.policyId ?? "",
        t.policyName ?? "",
        t.blockReason ?? "",
        t.riskScore,
        (t.riskFlags ?? []).join(" | "),
        task?.policyDecision ?? t.status,
        apr ? "Yes" : "No",
        t.network,
        t.isSimulated ? "Yes" : "No",
        t.purpose ?? "",
      ].map(escapeCSV).join(",");
    });

    const csv = [headers.map(escapeCSV).join(","), ...rows].join("\n");
    const filename = `policyguard-transactions-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ─── PDF (HTML rendered for browser print-to-PDF) ────────────
  const approved = txs.filter((t) => t.status === "approved");
  const blocked  = txs.filter((t) => t.status === "blocked");
  const pending  = txs.filter((t) => t.status === "pending");
  const failed   = txs.filter((t) => t.status === "failed");
  const totalVol = approved.reduce((s, t) => s + t.amountUSD, 0);
  const blockedVol = blocked.reduce((s, t) => s + t.amountUSD, 0);

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      approved: "#16a34a", blocked: "#dc2626", pending: "#d97706", failed: "#64748b",
    };
    return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${colors[s] ?? "#64748b"}20;color:${colors[s] ?? "#64748b"};font-weight:600;font-size:11px;border:1px solid ${colors[s] ?? "#64748b"}40">${s.toUpperCase()}</span>`;
  };

  const txRows = txs.slice(0, 200).map((t) => {
    const task = db.tasks.find((tk) => tk.transactionId === t.id);
    const policyChecksHtml = (task?.policyChecks ?? []).map((c) =>
      `<span style="display:inline-block;padding:1px 6px;margin:1px;background:${c.passed ? "#16a34a15" : "#dc262615"};color:${c.passed ? "#16a34a" : "#dc2626"};border-radius:3px;font-size:10px">${c.passed ? "✓" : "✗"} ${c.rule}</span>`
    ).join("");

    return `
      <tr style="border-bottom:1px solid #e2e8f0;page-break-inside:avoid">
        <td style="padding:8px 6px;font-size:11px;color:#64748b;font-family:monospace">${t.id}</td>
        <td style="padding:8px 6px;font-size:11px">${new Date(t.timestamp).toLocaleDateString()}<br><span style="color:#64748b;font-size:10px">${new Date(t.timestamp).toLocaleTimeString()}</span></td>
        <td style="padding:8px 6px;font-size:11px">${t.agentName}</td>
        <td style="padding:8px 6px;font-size:11px">${t.requesterName ?? "—"}</td>
        <td style="padding:8px 6px;font-size:11px">${t.toLabel ?? t.toAddress.slice(0, 16) + "…"}</td>
        <td style="padding:8px 6px;font-size:12px;font-weight:700;text-align:right">$${t.amountUSD.toFixed(2)}</td>
        <td style="padding:8px 6px">${statusBadge(t.status)}</td>
        <td style="padding:8px 6px;font-size:10px;color:#64748b;max-width:200px">${
          t.blockReason
            ? `<span style="color:#dc2626">${t.blockReason.slice(0, 120)}</span>`
            : policyChecksHtml || "Passed"
        }</td>
        <td style="padding:8px 6px;font-size:11px;color:#64748b">${t.purpose?.slice(0, 40) ?? "—"}</td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PolicyGuard Transaction Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, "Segoe UI", sans-serif; color: #1e293b; background: #fff; padding: 32px; font-size: 13px; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; }
    h2 { font-size: 15px; font-weight: 600; color: #334155; margin: 24px 0 12px; }
    .meta { color: #64748b; font-size: 12px; margin-top: 4px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
    .kpi-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
    .kpi-value { font-size: 22px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f8fafc; }
    thead th { padding: 10px 6px; font-size: 11px; font-weight: 600; text-align: left; color: #64748b; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #e2e8f0; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; text-align: center; }
    .security-note { background: #fefce8; border: 1px solid #fde047; border-radius: 6px; padding: 10px 14px; font-size: 11px; color: #713f12; margin-bottom: 20px; }
    .print-btn { background: #3b82f6; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <button class="no-print print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:16px;margin-bottom:20px">
    <div>
      <h1>PolicyGuard Transaction Report</h1>
      <p class="meta">Generated: ${now} UTC · Period: ${periodStr} · Status filter: ${statusStr}</p>
      <p class="meta" style="margin-top:4px">⚠ Simulated data — no real funds transferred. ERC-4337 smart contract not deployed.</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:12px;font-weight:600;color:#64748b">Agent Wallet – PolicyGuard</p>
      <p style="font-size:11px;color:#94a3b8">ERC-4337 Account Abstraction Wallet</p>
    </div>
  </div>

  <div class="security-note">
    <strong>Security Notice:</strong> AI risk scores shown in this report are advisory signals only and are not the final security authority.
    All blocking and approval decisions were enforced by the server-side policy engine, not by the AI model.
    Blockchain transaction hashes are not present because the ERC-4337 smart contract is not yet deployed on Sepolia testnet.
  </div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Total Transactions</div>
      <div class="kpi-value" style="color:#0f172a">${txs.length}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Approved · Volume</div>
      <div class="kpi-value" style="color:#16a34a">${approved.length}</div>
      <div style="font-size:12px;color:#16a34a;margin-top:2px">$${totalVol.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Blocked · Volume</div>
      <div class="kpi-value" style="color:#dc2626">${blocked.length}</div>
      <div style="font-size:12px;color:#dc2626;margin-top:2px">$${blockedVol.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Pending / Failed</div>
      <div class="kpi-value" style="color:#d97706">${pending.length + failed.length}</div>
      <div style="font-size:12px;color:#d97706;margin-top:2px">${pending.length} pending · ${failed.length} failed</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px">
      <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Overall Stats</div>
      <div style="margin-top:8px;space-y:4px">
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:12px"><span>Active Agents</span><strong>${stats.activeAgents}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:12px"><span>Active Policies</span><strong>${stats.activePolicies}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:12px"><span>Pending Approvals</span><strong>${stats.pendingApprovals}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span>Critical Alerts</span><strong style="color:#dc2626">${stats.criticalAlerts}</strong></div>
      </div>
    </div>
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px">
      <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Report Parameters</div>
      <div style="margin-top:8px">
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:12px"><span>Date Range</span><strong>${periodStr}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:12px"><span>Status Filter</span><strong>${statusStr}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:12px"><span>Records Shown</span><strong>${Math.min(txs.length, 200)} of ${txs.length}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span>Network</span><strong>Simulated (Sepolia pending)</strong></div>
      </div>
    </div>
  </div>

  <h2>Transaction Details</h2>
  ${txs.length === 0 ? `<p style="color:#64748b;padding:24px;text-align:center">No transactions found for the selected filters.</p>` : `
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Timestamp</th>
        <th>Agent</th>
        <th>Requester</th>
        <th>Merchant</th>
        <th style="text-align:right">Amount</th>
        <th>Status</th>
        <th>Policy Decision / Reason</th>
        <th>Purpose</th>
      </tr>
    </thead>
    <tbody>${txRows}</tbody>
  </table>
  ${txs.length > 200 ? `<p style="color:#64748b;font-size:11px;margin-top:8px">* Report truncated at 200 records. Use date/status filters to narrow the dataset.</p>` : ""}`}

  <div class="footer">
    <p>Agent Wallet – PolicyGuard · ERC-4337 Account Abstraction Smart Wallet · Hackathon Demo</p>
    <p style="margin-top:4px">This report was generated from the PolicyGuard persistent database. All transactions are simulated — no real funds were transferred.</p>
    <p style="margin-top:4px">Made with IBM Bob</p>
  </div>
</body>
</html>`;

  const filename = `policyguard-report-${new Date().toISOString().slice(0, 10)}.html`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
