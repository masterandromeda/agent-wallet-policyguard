"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card, CardHeader, CardBody, Badge, Button, SimulatedDataLabel, RiskScorePill,
  AlertBanner, LoadingState, EmptyState,
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";
import { apiGet, apiPost } from "@/lib/api-client";
import { useSSE } from "@/hooks/useSSE";
import {
  ClipboardCheck, Clock, CheckCircle2, XCircle, AlertTriangle, Bot, DollarSign,
  RefreshCw,
} from "lucide-react";
import { formatUSD, formatDateTime, formatRelativeTime, formatAddress } from "@/lib/utils";
import type { ApprovalRequest } from "@/lib/types";

// ── Approval Card (with live actions) ───────────────────────────
function ApprovalCard({ req, isPending, onAction }: {
  req: ApprovalRequest;
  isPending: boolean;
  onAction: () => void;
}) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");
  const isExpiringSoon =
    isPending && new Date(req.expiresAt).getTime() - Date.now() < 2 * 60 * 60 * 1000;

  async function act(action: "approve" | "reject") {
    setLoading(action);
    try {
      await apiPost("/api/approvals", { approvalId: req.id, action, notes, ownerId: "usr_01" });
      toast({
        type: action === "approve" ? "success" : "warning",
        title: action === "approve" ? "✓ Approved" : "✗ Rejected",
        message: `${req.agentName} — ${formatUSD(req.requestedAmount)}`,
      });
      onAction();
    } catch (err: unknown) {
      toast({ type: "error", title: "Action failed", message: String(err) });
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className={isPending ? "" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: isPending ? "rgba(245,158,11,0.10)" :
                  req.status === "approved" ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)"
              }}
            >
              {isPending ? (
                <Clock className="w-4 h-4 text-amber-400" />
              ) : req.status === "approved" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">Approval #{req.id.replace("apr_", "")}</span>
                <Badge
                  className={
                    req.status === "pending"  ? "badge-amber" :
                    req.status === "approved" ? "badge-green" : "badge-red"
                  }
                  dot
                >
                  {req.status}
                </Badge>
                <SimulatedDataLabel />
              </div>
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <Bot className="w-3 h-3" /> {req.agentName}
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-white">{formatUSD(req.requestedAmount)}</p>
            <RiskScorePill score={req.riskScore} showBar />
          </div>
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="mb-1" style={{ color: "var(--text-muted)" }}>Destination</p>
            <p className="font-medium text-white">{req.toLabel || "—"}</p>
            <code className="font-mono" style={{ color: "var(--text-muted)" }}>{formatAddress(req.toAddress)}</code>
          </div>
          <div>
            <p className="mb-1" style={{ color: "var(--text-muted)" }}>Requested</p>
            <p style={{ color: "var(--text-secondary)" }}>{formatRelativeTime(req.requestedAt)}</p>
            <p style={{ color: "var(--text-muted)" }}>{formatDateTime(req.requestedAt)}</p>
          </div>
          <div>
            <p className="mb-1" style={{ color: "var(--text-muted)" }}>Expires</p>
            <p className={isExpiringSoon ? "text-rose-400 font-semibold" : ""} style={isExpiringSoon ? {} : { color: "var(--text-secondary)" }}>
              {isExpiringSoon ? "⚠ " : ""}{formatDateTime(req.expiresAt)}
            </p>
          </div>
          {req.respondedAt && (
            <div>
              <p className="mb-1" style={{ color: "var(--text-muted)" }}>Responded</p>
              <p style={{ color: "var(--text-secondary)" }}>{formatRelativeTime(req.respondedAt)}</p>
            </div>
          )}
        </div>

        <div className="px-3 py-2.5 rounded-lg" style={{ background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.10)" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Agent Reason</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{req.reason}</p>
        </div>

        {req.policyViolations.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Policy Flags
            </p>
            {req.policyViolations.map((v, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-300">
                <span className="mt-0.5 w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                {v}
              </div>
            ))}
          </div>
        )}

        {req.notes && (
          <div className="px-3 py-2.5 rounded-lg" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.18)" }}>
            <p className="text-xs font-semibold text-rose-400 mb-1">Owner Notes</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{req.notes}</p>
          </div>
        )}

        {isPending && (
          <div className="space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Owner notes (optional)..."
              rows={2}
              className="input-dark resize-none text-xs w-full"
            />
            <div className="flex items-center gap-3">
              <Button variant="primary" size="md" className="flex-1" loading={loading === "approve"} onClick={() => act("approve")}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </Button>
              <Button variant="danger" size="md" className="flex-1" loading={loading === "reject"} onClick={() => act("reject")}>
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadApprovals = useCallback(async () => {
    try {
      const res = await apiGet<{ data: ApprovalRequest[] }>("/api/approvals");
      setApprovals(res.data);
    } catch (err: unknown) {
      toast({ type: "error", title: "Failed to load approvals", message: String(err) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadApprovals(); }, [loadApprovals]);

  useSSE("approvals-page", {
    approval_new: (e) => {
      const apr = e.payload as ApprovalRequest;
      setApprovals((prev) => [apr, ...prev]);
      toast({ type: "warning", title: "⏳ New approval required", message: `${apr.agentName} — ${formatUSD(apr.requestedAmount)}` });
    },
    approval_update: () => loadApprovals(),
  });

  const pending  = approvals.filter((a) => a.status === "pending");
  const resolved = approvals.filter((a) => a.status !== "pending");
  const approvedCount = approvals.filter((a) => a.status === "approved").length;
  const rejectedCount = approvals.filter((a) => a.status === "rejected").length;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        title="Owner Approval Center"
        actions={
          <button onClick={loadApprovals} className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-6 fade-up">
        {/* Counts */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending Review", value: pending.length,   icon: Clock,         bg: "rgba(245,158,11,0.12)", color: "#fbbf24" },
            { label: "Approved",       value: approvedCount,    icon: CheckCircle2,  bg: "rgba(16,185,129,0.12)", color: "#34d399" },
            { label: "Rejected",       value: rejectedCount,    icon: XCircle,       bg: "rgba(239,68,68,0.12)",  color: "#f87171" },
          ].map(({ label, value, icon: Icon, bg, color }) => (
            <Card key={label} className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <p className="section-label">{label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
              </div>
            </Card>
          ))}
        </div>

        <AlertBanner variant="info" icon={ClipboardCheck}>
          <strong>Live Approval Center:</strong> Approve or reject out-of-policy agent payment requests.
          On-chain enforcement via ERC-4337 Paymaster is pending smart contract deployment.
        </AlertBanner>

        {isLoading ? (
          <LoadingState />
        ) : (
          <>
            {pending.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" /> Pending Approval ({pending.length})
                </h2>
                <div className="space-y-4">
                  {pending.map((req) => <ApprovalCard key={req.id} req={req} isPending={true} onAction={loadApprovals} />)}
                </div>
              </div>
            )}

            {pending.length === 0 && (
              <Card><CardBody>
                <EmptyState icon={CheckCircle2} title="No pending approvals" description="All requests have been reviewed. You're all caught up!" />
              </CardBody></Card>
            )}

            {resolved.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                  <CheckCircle2 className="w-4 h-4" /> Resolved ({resolved.length})
                </h2>
                <div className="space-y-4">
                  {resolved.map((req) => <ApprovalCard key={req.id} req={req} isPending={false} onAction={loadApprovals} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
