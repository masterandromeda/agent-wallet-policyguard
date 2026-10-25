"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Send, RefreshCw, CheckCircle2, XCircle, Clock,
  AlertTriangle, Filter, ChevronDown, Bot,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card, CardHeader, CardBody,
  Badge, Button, AlertBanner, LoadingState, EmptyState,
  SimulatedDataLabel, RiskScorePill,
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";
import { useSSE } from "@/hooks/useSSE";
import { apiGet, apiPost } from "@/lib/api-client";
import { formatUSD, formatRelativeTime } from "@/lib/utils";
import type { ApprovalRequest, Agent } from "@/lib/types";

type FilterStatus = "all" | "pending" | "approved" | "rejected" | "expired";

const STATUS_ICONS = {
  pending:  <Clock className="w-3.5 h-3.5 text-amber-400" />,
  approved: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  rejected: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
  expired:  <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />,
};

const STATUS_BADGE: Record<string, string> = {
  pending:  "badge-amber",
  approved: "badge-green",
  rejected: "badge-red",
  expired:  "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

// ─── Approval Action Dialog ────────────────────────────────────────────────────

interface ActionDialogProps {
  req: ApprovalRequest;
  action: "approve" | "reject";
  onClose: () => void;
  onConfirm: (notes: string) => void;
  loading: boolean;
}

function ActionDialog({ req, action, onClose, onConfirm, loading }: ActionDialogProps) {
  const [notes, setNotes] = useState("");
  const isApprove = action === "approve";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(2,8,24,0.85)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{
          background: "#080f1e",
          border: `1px solid ${isApprove ? "rgba(16,185,129,0.35)" : "rgba(244,63,94,0.35)"}`,
          boxShadow: `0 0 40px ${isApprove ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)"}`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: isApprove ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)" }}
          >
            {isApprove
              ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              : <XCircle className="w-5 h-5 text-rose-400" />}
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {isApprove ? "Approve" : "Reject"} Payment Request
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {req.agentName} · {formatUSD(req.requestedAmount)}
            </p>
          </div>
        </div>

        <div
          className="rounded-xl px-4 py-3 space-y-1"
          style={{ background: "rgba(7,16,32,0.7)", border: "1px solid rgba(56,189,248,0.08)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Recipient</span>
            <span className="text-xs font-mono text-white">{req.toLabel ?? `${req.toAddress.slice(0, 14)}…`}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Amount</span>
            <span className="text-xs font-semibold text-white tabular-nums">{formatUSD(req.requestedAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Risk Score</span>
            <RiskScorePill score={req.riskScore} />
          </div>
          {req.policyViolations.length > 0 && (
            <div className="pt-1">
              <span className="text-xs font-semibold text-amber-400">Policy violations:</span>
              <ul className="mt-0.5 space-y-0.5">
                {req.policyViolations.map((v, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-muted)" }}>· {v}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
            {isApprove ? "Approval note (optional)" : "Rejection reason (optional)"}
          </label>
          <textarea
            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
            style={{
              background: "rgba(7,16,32,0.9)",
              border: `1px solid ${isApprove ? "rgba(16,185,129,0.20)" : "rgba(244,63,94,0.20)"}`,
              color: "var(--text-primary)",
              minHeight: 72,
            }}
            placeholder={isApprove ? "Add an optional note…" : "Describe why this is being rejected…"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant={isApprove ? "primary" : "danger"}
            size="sm"
            loading={loading}
            onClick={() => onConfirm(notes.trim())}
          >
            {isApprove ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {isApprove ? "Approve Payment" : "Reject Payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function RequestsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterAgent, setFilterAgent] = useState("all");
  const [actionTarget, setActionTarget] = useState<{ req: ApprovalRequest; action: "approve" | "reject" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, agentRes] = await Promise.allSettled([
        apiGet<{ data: ApprovalRequest[] }>("/api/approvals"),
        apiGet<{ data: Agent[] }>("/api/agents"),
      ]);
      if (reqRes.status === "fulfilled") setRequests(reqRes.value.data ?? []);
      if (agentRes.status === "fulfilled") setAgents(agentRes.value.data ?? []);
    } catch {
      toast({ type: "error", title: "Failed to load requests" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // SSE live updates
  useSSE("owner", {
    approval_update: () => loadData(),
    transaction_update: () => loadData(),
  });

  const handleAction = useCallback(async (notes: string) => {
    if (!actionTarget) return;
    setActionLoading(true);
    const { req, action } = actionTarget;
    try {
      await apiPost("/api/approvals", {
        approvalId: req.id,
        action,
        notes,
        ownerId: "usr_01",
      });
      toast({
        type: action === "approve" ? "success" : "info",
        title: action === "approve" ? "Payment approved" : "Payment rejected",
        message: `${req.agentName} · ${formatUSD(req.requestedAmount)}`,
      });
      setActionTarget(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Action failed";
      toast({ type: "error", title: "Action failed", message: msg });
    } finally {
      setActionLoading(false);
    }
  }, [actionTarget, loadData]);

  // Filter
  const filtered = requests.filter((r) => {
    const statusMatch = filterStatus === "all" || r.status === filterStatus;
    const agentMatch = filterAgent === "all" || r.agentId === filterAgent;
    return statusMatch && agentMatch;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Approvals"
        title="Payment Requests"
        subtitle="Outbound payment requests raised by AI agents"
        actions={
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="page-content space-y-5 fade-up">
        <SimulatedDataLabel />

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending Review", value: pendingCount, color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.18)" },
            { label: "Approved",       value: approvedCount, color: "#10b981", bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.15)" },
            { label: "Rejected",       value: rejectedCount, color: "#f43f5e", bg: "rgba(244,63,94,0.06)", border: "rgba(244,63,94,0.15)" },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} className="px-5 py-4 rounded-xl" style={{ background: bg, border: `1px solid ${border}` }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {pendingCount > 0 && (
          <AlertBanner variant="warning" icon={AlertTriangle}>
            <strong>{pendingCount} payment request{pendingCount > 1 ? "s" : ""} pending owner review.</strong>{" "}
            Requests auto-expire after 24 hours if not actioned.
          </AlertBanner>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-[#22d3ee]" />
                All Requests
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(34,211,238,0.10)", color: "#22d3ee" }}>
                  {filtered.length}
                </span>
              </h2>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: showFilters ? "rgba(34,211,238,0.10)" : "rgba(7,16,32,0.6)",
                  border: "1px solid rgba(56,189,248,0.15)",
                  color: showFilters ? "#22d3ee" : "var(--text-secondary)",
                }}
              >
                <Filter className="w-3 h-3" />
                Filters
                <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </button>
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-3 pt-3 mt-3 border-t" style={{ borderColor: "rgba(56,189,248,0.08)" }}>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Status</span>
                  <select
                    className="rounded-lg px-2 py-1 text-xs outline-none"
                    style={{ background: "rgba(7,16,32,0.9)", border: "1px solid rgba(56,189,248,0.15)", color: "var(--text-primary)" }}
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Agent</span>
                  <select
                    className="rounded-lg px-2 py-1 text-xs outline-none"
                    style={{ background: "rgba(7,16,32,0.9)", border: "1px solid rgba(56,189,248,0.15)", color: "var(--text-primary)" }}
                    value={filterAgent}
                    onChange={(e) => setFilterAgent(e.target.value)}
                  >
                    <option value="all">All agents</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => { setFilterStatus("all"); setFilterAgent("all"); }}
                    className="text-xs px-2 py-1 rounded transition-colors"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </CardHeader>

          <CardBody className="p-0">
            {loading ? (
              <div className="p-6"><LoadingState message="Loading payment requests…" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Send}
                  title="No payment requests"
                  description="Agent payment requests will appear here when submitted."
                />
              </div>
            ) : (
              <div>
                {filtered.map((req, i) => (
                  <div
                    key={req.id}
                    className="px-5 py-4"
                    style={{
                      borderBottom: i < filtered.length - 1 ? "1px solid rgba(56,189,248,0.05)" : undefined,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {STATUS_ICONS[req.status] ?? <Clock className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <div className="flex items-center gap-1.5">
                            <Bot className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                            <span className="text-xs font-semibold text-white">{req.agentName}</span>
                          </div>
                          <Badge className={STATUS_BADGE[req.status] ?? "badge-slate"}>{req.status}</Badge>
                          <RiskScorePill score={req.riskScore} />
                        </div>
                        <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                          → {req.toLabel ?? `${req.toAddress.slice(0, 18)}…`}
                          {req.requesterName && (
                            <span> · requested by <span className="text-white">{req.requesterName}</span></span>
                          )}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{req.reason}</p>
                        {req.policyViolations.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {req.policyViolations.map((v, vi) => (
                              <span key={vi} className="text-xs px-1.5 py-0.5 rounded-md"
                                style={{ background: "rgba(245,158,11,0.10)", color: "#fbbf24" }}>
                                {v}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        <span className="text-sm font-bold text-white tabular-nums">{formatUSD(req.requestedAmount)}</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatRelativeTime(req.requestedAt)}</span>
                        {req.status === "pending" && (
                          <div className="flex gap-1.5 mt-1">
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() => setActionTarget({ req, action: "approve" })}
                            >
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => setActionTarget({ req, action: "reject" })}
                            >
                              <XCircle className="w-3 h-3" /> Reject
                            </Button>
                          </div>
                        )}
                        {req.status === "approved" && req.respondedAt && (
                          <span className="text-xs text-emerald-400">
                            Approved {formatRelativeTime(req.respondedAt)}
                          </span>
                        )}
                        {req.status === "rejected" && req.respondedAt && (
                          <span className="text-xs text-rose-400">
                            Rejected {formatRelativeTime(req.respondedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Action dialog */}
      {actionTarget && (
        <ActionDialog
          req={actionTarget.req}
          action={actionTarget.action}
          onClose={() => { if (!actionLoading) setActionTarget(null); }}
          onConfirm={handleAction}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
