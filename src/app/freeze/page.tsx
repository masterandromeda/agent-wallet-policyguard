"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Snowflake,
  RefreshCw,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
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
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import { formatRelativeTime, agentStatusColor } from "@/lib/utils";
import type { Agent } from "@/lib/types";

// ─── Freeze Dialog ─────────────────────────────────────────────────────────────

interface FreezeDialogProps {
  agent: Agent;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}

function FreezeDialog({ agent, onCancel, onConfirm, loading }: FreezeDialogProps) {
  const [reason, setReason] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(2,8,24,0.80)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{
          background: "#080f1e",
          border: "1px solid rgba(244,63,94,0.35)",
          boxShadow: "0 0 40px rgba(244,63,94,0.12)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(244,63,94,0.12)" }}>
            <Snowflake className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Confirm Emergency Freeze</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Agent: <span className="text-white font-semibold">{agent.name}</span>
            </p>
          </div>
        </div>

        <AlertBanner variant="error" icon={AlertTriangle}>
          This will immediately block ALL transactions for this agent. The action is logged
          and requires owner authorization to reverse.
        </AlertBanner>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Freeze Reason <span className="text-rose-400">*</span>
          </label>
          <textarea
            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
            style={{
              background: "rgba(7,16,32,0.9)",
              border: "1px solid rgba(244,63,94,0.25)",
              color: "var(--text-primary)",
              caretColor: "#f43f5e",
              minHeight: 80,
            }}
            placeholder="Describe why this agent is being frozen…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={loading}
            disabled={!reason.trim() || loading}
            onClick={() => onConfirm(reason.trim())}
          >
            <Snowflake className="w-3.5 h-3.5" />
            Freeze Agent
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function FreezePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [freezeTarget, setFreezeTarget] = useState<Agent | null>(null);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ data: Agent[] }>("/api/agents");
      setAgents(res.data ?? []);
    } catch {
      toast({ type: "error", title: "Failed to load agents" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleFreeze = useCallback(
    async (reason: string) => {
      if (!freezeTarget) return;
      setFreezeLoading(true);
      try {
        await apiPost("/api/freeze", {
          agentId: freezeTarget.id,
          reason,
          ownerId: "usr_01",
        });
        toast({ type: "success", title: "Agent frozen successfully", message: freezeTarget.name });
        setFreezeTarget(null);
        await loadAgents();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Freeze failed";
        toast({ type: "error", title: "Freeze failed", message: msg });
      } finally {
        setFreezeLoading(false);
      }
    },
    [freezeTarget, loadAgents]
  );

  const handleReactivate = useCallback(
    async (agent: Agent) => {
      setReactivatingId(agent.id);
      try {
        await apiPatch(`/api/agents/${agent.id}`, { status: "active" });
        toast({ type: "success", title: "Agent reactivated", message: agent.name });
        await loadAgents();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Reactivate failed";
        toast({ type: "error", title: "Reactivation failed", message: msg });
      } finally {
        setReactivatingId(null);
      }
    },
    [loadAgents]
  );

  const activeAgents = agents.filter((a) => a.status === "active");
  const suspendedAgents = agents.filter((a) => a.status === "suspended");

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Security"
        title="Emergency Freeze & Recovery"
        subtitle="Halt all agent activity instantly"
        actions={
          <Button variant="ghost" size="sm" onClick={loadAgents} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="page-content space-y-5 fade-up">
        {/* Warning banner */}
        <AlertBanner variant="error" icon={AlertTriangle}>
          <strong>Emergency freeze immediately blocks ALL transactions for the selected agent.</strong>{" "}
          This action is logged and cannot be undone without owner authorization.
        </AlertBanner>

        {/* Active freezes summary */}
        {suspendedAgents.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Snowflake className="w-4 h-4 text-rose-400" />
                <h2 className="text-sm font-semibold text-white">
                  Active Freezes
                  <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: "rgba(244,63,94,0.15)", color: "#f87171" }}>
                    {suspendedAgents.length}
                  </span>
                </h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              {suspendedAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.18)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white truncate">{agent.name}</p>
                      <Badge className={agentStatusColor(agent.status)} dot>Suspended</Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Last active {formatRelativeTime(agent.lastActive)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={reactivatingId === agent.id}
                    disabled={reactivatingId !== null}
                    onClick={() => handleReactivate(agent)}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Reactivate
                  </Button>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {/* Agent status panel */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-white">Agent Status</h2>
          </CardHeader>
          <CardBody>
            {loading ? (
              <LoadingState message="Loading agents…" />
            ) : agents.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No agents found"
                description="Create an agent first to manage freeze actions."
              />
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl"
                    style={{
                      background: "rgba(7,16,32,0.6)",
                      border: "1px solid rgba(56,189,248,0.08)",
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-white truncate">{agent.name}</p>
                        <Badge className={agentStatusColor(agent.status)} dot>
                          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {agent.description || "No description"} · Last active{" "}
                        {formatRelativeTime(agent.lastActive)}
                      </p>
                    </div>

                    {agent.status === "active" && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setFreezeTarget(agent)}
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                        Emergency Freeze
                      </Button>
                    )}
                    {agent.status === "suspended" && (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        <span className="text-xs text-rose-400 font-semibold">Frozen</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Recovery link */}
        <Link href="/guardians" className="block">
          <div
            className="flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer transition-all hover:border-violet-400/30"
            style={{
              background: "rgba(139,92,246,0.06)",
              border: "1px solid rgba(139,92,246,0.18)",
            }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(139,92,246,0.15)" }}>
              <Shield className="w-5 h-5" style={{ color: "#a78bfa" }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Guardian-Based Recovery</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Recover a frozen agent using 3-of-5 guardian approval voting →
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Freeze confirmation dialog */}
      {freezeTarget && (
        <FreezeDialog
          agent={freezeTarget}
          onCancel={() => { if (!freezeLoading) setFreezeTarget(null); }}
          onConfirm={handleFreeze}
          loading={freezeLoading}
        />
      )}
    </div>
  );
}
