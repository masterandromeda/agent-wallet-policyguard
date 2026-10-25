"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Button,
  AlertBanner,
  LoadingState,
  EmptyState,
  ProgressBar,
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { formatRelativeTime, formatAddress } from "@/lib/utils";
import type { Agent, RecoveryRequest, RecoveryStatus } from "@/lib/types";

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<RecoveryStatus, string> = {
  idle:      "bg-slate-500/10 text-slate-400 border-slate-500/20",
  requested: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  voting:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
  delay:     "bg-violet-500/10 text-violet-400 border-violet-500/20",
  approved:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  executed:  "bg-teal-500/10 text-teal-400 border-teal-500/20",
  vetoed:    "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

const STATUS_LABELS: Record<RecoveryStatus, string> = {
  idle:      "Idle",
  requested: "Requested",
  voting:    "Voting",
  delay:     "Security Delay",
  approved:  "Approved",
  executed:  "Executed",
  vetoed:    "Vetoed",
};

const STATUS_DESCRIPTIONS: Record<RecoveryStatus, string> = {
  idle:      "No active recovery.",
  requested: "Recovery request submitted.",
  voting:    "Awaiting guardian approvals (need 3 of 5)",
  delay:     "48-hour security delay in progress",
  approved:  "Recovery approved — ready to execute",
  executed:  "Recovery executed",
  vetoed:    "Recovery vetoed by owner",
};

function formatCountdown(executeAfter: string): string {
  const diff = new Date(executeAfter).getTime() - Date.now();
  if (diff <= 0) return "Delay elapsed";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m remaining`;
}

// ─── Recovery Request Card ─────────────────────────────────────────────────────

interface RecoveryCardProps {
  rec: RecoveryRequest;
  onApprove: (recoveryId: string, guardianId: string) => void;
  onVeto: (recoveryId: string) => void;
  actionLoading: string | null; // guardianId or "veto"
}

function RecoveryCard({ rec, onApprove, onVeto, actionLoading }: RecoveryCardProps) {
  const [expanded, setExpanded] = useState(true);
  const pct = Math.round((rec.approvalsReceived / 5) * 100);
  const isActive = rec.status !== "vetoed" && rec.status !== "executed";

  return (
    <div
      className="solid-card overflow-hidden"
      style={{
        border: `1px solid ${
          rec.status === "vetoed"   ? "rgba(244,63,94,0.25)"   :
          rec.status === "executed" ? "rgba(16,185,129,0.25)"  :
          rec.status === "approved" ? "rgba(16,185,129,0.25)"  :
          rec.status === "delay"    ? "rgba(139,92,246,0.25)"  :
          "rgba(56,189,248,0.12)"
        }`,
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(56,189,248,0.08)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-sm font-bold text-white">{rec.agentName}</p>
              <Badge className={STATUS_STYLES[rec.status]}>{STATUS_LABELS[rec.status]}</Badge>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Requested {formatRelativeTime(rec.requestedAt)} ·{" "}
              New owner: <span className="font-mono text-white">{formatAddress(rec.newOwnerAddress)}</span>
            </p>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs flex items-center gap-1 flex-shrink-0 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              {rec.approvalsReceived} of {rec.approvalsNeeded} guardians approved
            </span>
            <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
              {rec.approvalsReceived}/5
            </span>
          </div>
          <ProgressBar
            value={pct}
            variant={rec.approvalsReceived >= rec.approvalsNeeded ? "green" : "default"}
          />
        </div>

        {/* Status description */}
        <p className="text-xs mt-2.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {STATUS_DESCRIPTIONS[rec.status]}
          {rec.status === "delay" && (
            <span className="ml-1.5 text-violet-400 font-semibold">{formatCountdown(rec.executeAfter)}</span>
          )}
        </p>
      </div>

      {/* Guardian list */}
      {expanded && (
        <div className="p-5 space-y-2">
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
            GUARDIAN VOTES
          </p>
          {rec.guardians.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl"
              style={{
                background: g.approved ? "rgba(16,185,129,0.07)" : "rgba(7,16,32,0.6)",
                border: `1px solid ${g.approved ? "rgba(16,185,129,0.18)" : "rgba(56,189,248,0.06)"}`,
              }}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {g.approved ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">{g.name}</p>
                  <p className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>
                    {formatAddress(g.address)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {g.approved ? (
                  <span className="text-xs text-emerald-400 font-semibold">Approved</span>
                ) : isActive ? (
                  <Button
                    variant="secondary"
                    size="xs"
                    loading={actionLoading === g.id}
                    disabled={actionLoading !== null || !isActive}
                    onClick={() => onApprove(rec.id, g.id)}
                  >
                    Approve
                  </Button>
                ) : (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                )}
              </div>
            </div>
          ))}

          {/* Owner veto */}
          {isActive && (
            <div className="pt-2">
              <Button
                variant="danger"
                size="sm"
                loading={actionLoading === "veto"}
                disabled={actionLoading !== null}
                onClick={() => onVeto(rec.id)}
                className="w-full"
              >
                <XCircle className="w-3.5 h-3.5" />
                Veto Recovery
              </Button>
            </div>
          )}

          {rec.notes && (
            <p className="text-xs pt-1" style={{ color: "var(--text-muted)" }}>
              Notes: {rec.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── New Recovery Form ─────────────────────────────────────────────────────────

interface RecoveryFormProps {
  agents: Agent[];
  onCreated: () => void;
}

function RecoveryForm({ agents, onCreated }: RecoveryFormProps) {
  const [agentId, setAgentId] = useState("");
  const [newOwnerAddress, setNewOwnerAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!agentId || !newOwnerAddress.trim()) return;
    setLoading(true);
    try {
      await apiPost("/api/recovery", {
        agentId,
        newOwnerAddress: newOwnerAddress.trim(),
        requestedBy: "usr_01",
        notes: notes.trim() || undefined,
      });
      toast({ type: "success", title: "Recovery request submitted", message: "Guardian voting has started" });
      setAgentId("");
      setNewOwnerAddress("");
      setNotes("");
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit";
      toast({ type: "error", title: "Submission failed", message: msg });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: "rgba(7,16,32,0.9)",
    border: "1px solid rgba(56,189,248,0.12)",
    color: "var(--text-primary)" as const,
    caretColor: "#22d3ee",
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-white">Initiate Recovery Request</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Agent <span className="text-rose-400">*</span>
          </label>
          <select
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={inputStyle}
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            disabled={loading}
          >
            <option value="">Select an agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
            New Owner Address <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none"
            style={inputStyle}
            placeholder="0x…"
            value={newOwnerAddress}
            onChange={(e) => setNewOwnerAddress(e.target.value)}
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Notes (optional)
          </label>
          <textarea
            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
            style={{ ...inputStyle, minHeight: 64 }}
            placeholder="Reason for recovery…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
          />
        </div>

        <Button
          variant="primary"
          size="sm"
          loading={loading}
          disabled={!agentId || !newOwnerAddress.trim() || loading}
          onClick={handleSubmit}
          className="w-full"
        >
          <Users className="w-3.5 h-3.5" />
          Start Guardian Recovery
        </Button>
      </CardBody>
    </Card>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GuardiansPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [requests, setRequests] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [agentRes, recRes] = await Promise.all([
        apiGet<{ data: Agent[] }>("/api/agents"),
        apiGet<{ data: RecoveryRequest[] }>("/api/recovery"),
      ]);
      setAgents(agentRes.data ?? []);
      setRequests(recRes.data ?? []);
    } catch {
      toast({ type: "error", title: "Failed to load data" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = useCallback(
    async (recoveryId: string, guardianId: string) => {
      setActionLoading(guardianId);
      try {
        await apiPatch("/api/recovery", { recoveryId, guardianId, action: "approve" });
        toast({ type: "success", title: "Guardian approved" });
        await loadData();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Approval failed";
        toast({ type: "error", title: "Approval failed", message: msg });
      } finally {
        setActionLoading(null);
      }
    },
    [loadData]
  );

  const handleVeto = useCallback(
    async (recoveryId: string) => {
      setActionLoading("veto");
      try {
        await apiPatch("/api/recovery", { recoveryId, guardianId: "owner", action: "veto" });
        toast({ type: "success", title: "Recovery vetoed", message: "Recovery request has been cancelled" });
        await loadData();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Veto failed";
        toast({ type: "error", title: "Veto failed", message: msg });
      } finally {
        setActionLoading(null);
      }
    },
    [loadData]
  );

  const activeRequests = requests.filter(
    (r) => r.status !== "executed" && r.status !== "vetoed"
  );

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Security"
        title="Guardian Management"
        subtitle="Social recovery key holders"
        actions={
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="page-content space-y-5 fade-up">
        {/* Disclaimer */}
        <AlertBanner variant="info" icon={Info}>
          Guardian-based recovery requires{" "}
          <strong>3-of-5 guardian approvals</strong> plus a{" "}
          <strong>48-hour security delay</strong>. The owner can veto any recovery at any time.
        </AlertBanner>

        {/* New request form */}
        {!loading && (
          <RecoveryForm agents={agents} onCreated={loadData} />
        )}

        {/* Active recovery requests */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">
              Active Recovery Requests
              {activeRequests.length > 0 && (
                <span
                  className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}
                >
                  {activeRequests.length}
                </span>
              )}
            </h2>
          </div>

          {loading ? (
            <LoadingState message="Loading recovery requests…" />
          ) : requests.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={Shield}
                  title="No recovery requests"
                  description="Use the form above to initiate a guardian-based recovery."
                />
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((rec) => (
                <RecoveryCard
                  key={rec.id}
                  rec={rec}
                  onApprove={handleApprove}
                  onVeto={handleVeto}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          )}
        </div>

        {/* Archived requests */}
        {requests.some((r) => r.status === "executed" || r.status === "vetoed") && (
          <div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
              Completed Requests
            </h2>
            <div className="space-y-3">
              {requests
                .filter((r) => r.status === "executed" || r.status === "vetoed")
                .map((rec) => (
                  <RecoveryCard
                    key={rec.id}
                    rec={rec}
                    onApprove={handleApprove}
                    onVeto={handleVeto}
                    actionLoading={actionLoading}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Explainer */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{
            background: "rgba(139,92,246,0.06)",
            border: "1px solid rgba(139,92,246,0.18)",
          }}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#a78bfa" }} />
          <div className="text-xs leading-relaxed space-y-1" style={{ color: "#a78bfa" }}>
            <p><strong>Recovery flow:</strong> Voting → 3 approvals → 48h delay → Execute</p>
            <p>The owner can veto at any point before execution. All actions are permanently logged on-chain.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
