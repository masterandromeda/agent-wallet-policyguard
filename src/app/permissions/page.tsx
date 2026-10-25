"use client";

import { useEffect, useState } from "react";
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
import { apiGet, apiPatch } from "@/lib/api-client";
import { toast } from "@/components/ui/Toast";
import { agentStatusColor, formatRelativeTime } from "@/lib/utils";
import type { Agent } from "@/lib/types";
import {
  UserCheck,
  ShieldCheck,
  ShieldOff,
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";

const PERMISSION_LABELS: Record<string, string> = {
  transfer: "Send Payments",
  contract_call: "Contract Calls",
  swap: "Token Swaps",
  bridge: "Bridge Assets",
  approve: "Token Approvals",
};

export default function PermissionsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ data: Agent[] }>("/api/agents");
      setAgents(res.data ?? []);
    } catch {
      toast({ type: "error", title: "Failed to load agents" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const togglePermission = async (agent: Agent, permId: string, granted: boolean) => {
    setSavingId(permId);
    const updated = agent.permissions.map((p) =>
      p.id === permId ? { ...p, granted } : p
    );
    try {
      await apiPatch(`/api/agents/${agent.id}`, { permissions: updated });
      toast({ type: "success", title: granted ? "Permission granted" : "Permission revoked" });
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast({ type: "error", title: "Update failed", message: msg });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="AI Agent Control"
        title="Agent Permissions"
        subtitle="Manage per-agent action capabilities"
        actions={
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />
      <div className="page-content space-y-6 fade-up">
        <AlertBanner variant="info" icon={AlertTriangle}>
          Permissions control what types of on-chain operations each agent may perform.
          Changes take effect immediately and are logged for audit purposes.
          Each permission can also have a per-agent expiry date set via the{" "}
          <strong>Policy Engine</strong>.
        </AlertBanner>

        {loading ? (
          <LoadingState message="Loading agents…" />
        ) : agents.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState icon={UserCheck} title="No agents found" description="Create an agent first to manage permissions." />
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-5">
            {agents.map((agent) => (
              <Card key={agent.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{agent.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {agent.id} · Last active {formatRelativeTime(agent.lastActive)}
                      </p>
                    </div>
                    <Badge className={agentStatusColor(agent.status)} dot>
                      {agent.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardBody>
                  {agent.permissions.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>No permissions defined.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {agent.permissions.map((perm) => (
                        <div
                          key={perm.id}
                          className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl"
                          style={{
                            background: perm.granted ? "rgba(16,185,129,0.05)" : "rgba(7,16,32,0.6)",
                            border: `1px solid ${perm.granted ? "rgba(16,185,129,0.15)" : "rgba(56,189,248,0.08)"}`,
                          }}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {perm.granted ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            ) : (
                              <ShieldOff className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white">
                                {PERMISSION_LABELS[perm.type] ?? perm.type}
                              </p>
                              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                                {perm.description}
                                {perm.expiresAt && (
                                  <span className="ml-2 inline-flex items-center gap-1 text-amber-400">
                                    <Clock className="w-3 h-3" />
                                    Expires {formatRelativeTime(perm.expiresAt)}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge className={perm.granted ? "badge-green" : "badge-gray"}>
                              {perm.granted ? "Granted" : "Revoked"}
                            </Badge>
                            <Button
                              variant={perm.granted ? "danger" : "secondary"}
                              size="xs"
                              loading={savingId === perm.id}
                              disabled={savingId !== null}
                              onClick={() => togglePermission(agent, perm.id, !perm.granted)}
                            >
                              {perm.granted ? (
                                <><ShieldOff className="w-3 h-3" />Revoke</>
                              ) : (
                                <><ShieldCheck className="w-3 h-3" />Grant</>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
