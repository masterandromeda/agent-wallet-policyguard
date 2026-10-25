"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card, CardHeader, CardBody, Badge, Button, SectionHeader, SimulatedDataLabel,
} from "@/components/ui/index";
import { toast } from "@/components/ui/Toast";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import {
  ShieldCheck, Plus, CheckCircle2, XCircle, Clock, Bot,
  AlertTriangle, DollarSign, Users, Zap, Calendar, Edit,
  Trash2, RefreshCw, X,
} from "lucide-react";
import { formatDateTime, formatUSD } from "@/lib/utils";
import type { Policy, PolicyRule, Agent } from "@/lib/types";

const RULE_ICONS: Record<string, React.ElementType> = {
  max_tx_amount:     DollarSign,
  daily_limit:       DollarSign,
  monthly_limit:     DollarSign,
  allowed_recipients: Users,
  allowed_contracts: Zap,
  allowed_functions: Zap,
  time_window:       Clock,
  require_approval:  AlertTriangle,
};

const RULE_TYPES: { type: PolicyRule["type"]; label: string; placeholder: string; isArray?: boolean }[] = [
  { type: "max_tx_amount",     label: "Max Tx Amount (USD)",    placeholder: "500" },
  { type: "daily_limit",       label: "Daily Limit (USD)",       placeholder: "2000" },
  { type: "monthly_limit",     label: "Monthly Limit (USD)",     placeholder: "20000" },
  { type: "require_approval",  label: "Require Approval (USD threshold)", placeholder: "1000" },
  { type: "time_window",       label: "Time Window (HH:MM-HH:MM UTC)",  placeholder: "09:00-18:00" },
  { type: "allowed_recipients",label: "Allowed Recipients",      placeholder: "0xAbc..., 0xDef...", isArray: true },
  { type: "allowed_contracts", label: "Allowed Contracts",       placeholder: "0xAbc..., 0xDef...", isArray: true },
  { type: "allowed_functions", label: "Allowed Functions",       placeholder: "0xa9059cbb, 0x23b872dd", isArray: true },
];

function RuleRow({ rule }: { rule: PolicyRule }) {
  const Icon = RULE_ICONS[rule.type] || ShieldCheck;
  const valueDisplay = Array.isArray(rule.value)
    ? `${rule.value.length} item${rule.value.length !== 1 ? "s" : ""}`
    : typeof rule.value === "number"
    ? formatUSD(rule.value)
    : String(rule.value);

  return (
    <div
      className="flex items-center gap-3 py-2.5 last:border-0"
      style={{ borderBottom: "1px solid rgba(56,189,248,0.06)" }}
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{
          background: rule.enabled ? "rgba(34,211,238,0.10)" : "rgba(56,189,248,0.04)",
          color: rule.enabled ? "#22d3ee" : "#475569",
        }}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white">{rule.label}</p>
        <p className="text-xs mt-0.5 font-mono" style={{ color: "#94a3b8" }}>{valueDisplay}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {rule.enabled ? (
          <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs text-emerald-400">Active</span></>
        ) : (
          <><XCircle className="w-3.5 h-3.5" style={{ color: "#475569" }} /><span className="text-xs" style={{ color: "#475569" }}>Off</span></>
        )}
      </div>
    </div>
  );
}

// ─── Create/Edit Policy Modal ─────────────────────────────────
interface ModalRule {
  type: PolicyRule["type"];
  label: string;
  value: string;
  enabled: boolean;
}

function PolicyModal({
  policy,
  agents,
  onClose,
  onSaved,
}: {
  policy?: Policy;
  agents: Agent[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!policy;
  const [name, setName] = useState(policy?.name ?? "");
  const [description, setDescription] = useState(policy?.description ?? "");
  const [status, setStatus] = useState<Policy["status"]>(policy?.status ?? "active");
  const [agentIds, setAgentIds] = useState<string[]>(policy?.agentIds ?? []);
  const [rules, setRules] = useState<ModalRule[]>(
    policy?.rules.map((r) => ({
      type: r.type,
      label: r.label,
      value: Array.isArray(r.value) ? r.value.join(", ") : String(r.value),
      enabled: r.enabled,
    })) ?? []
  );
  const [loading, setLoading] = useState(false);

  function addRule(type: PolicyRule["type"]) {
    const def = RULE_TYPES.find((r) => r.type === type);
    if (!def) return;
    setRules((prev) => [
      ...prev,
      { type, label: def.label, value: "", enabled: true },
    ]);
  }

  function removeRule(idx: number) {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleAgent(id: string) {
    setAgentIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  async function save() {
    if (!name.trim()) { toast({ type: "error", title: "Name is required" }); return; }
    setLoading(true);
    try {
      const payload = {
        name,
        description,
        status,
        agentIds,
        ownerId: "usr_01",
        rules: rules.map((r) => {
          const def = RULE_TYPES.find((d) => d.type === r.type);
          const rawVal = r.value.trim();
          let parsedValue: string | number | string[] = rawVal;
          if (def?.isArray) {
            parsedValue = rawVal.split(",").map((s) => s.trim()).filter(Boolean);
          } else if (!isNaN(parseFloat(rawVal)) && rawVal !== "") {
            parsedValue = parseFloat(rawVal);
          }
          return { type: r.type, label: r.label, value: parsedValue, enabled: r.enabled };
        }),
      };

      if (isEdit) {
        await apiPatch("/api/policies", { id: policy!.id, ...payload });
        toast({ type: "success", title: "Policy updated", message: name });
      } else {
        await apiPost("/api/policies", payload);
        toast({ type: "success", title: "Policy created", message: name });
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast({ type: "error", title: "Save failed", message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl"
        style={{ background: "#0b1221", border: "1px solid rgba(34,211,238,0.18)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(34,211,238,0.10)" }}>
          <h3 className="text-base font-semibold text-white">{isEdit ? "Edit Policy" : "Create New Policy"}</h3>
          <button onClick={onClose} style={{ color: "#475569" }}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          {/* Name & Description */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#94a3b8" }}>Policy Name *</label>
              <input
                className="input-dark"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Conservative Spending Policy"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "#94a3b8" }}>Description</label>
              <input
                className="input-dark"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this policy's purpose"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "#94a3b8" }}>Status</label>
            <div className="flex gap-2">
              {(["active", "inactive"] as Policy["status"][]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: status === s ? "rgba(34,211,238,0.12)" : "rgba(56,189,248,0.04)",
                    border: `1px solid ${status === s ? "rgba(34,211,238,0.35)" : "rgba(56,189,248,0.12)"}`,
                    color: status === s ? "#22d3ee" : "#475569",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Agent assignment */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "#94a3b8" }}>
              Assign Agents ({agentIds.length} selected)
            </label>
            <div className="flex flex-wrap gap-2">
              {agents.map((agent) => {
                const selected = agentIds.includes(agent.id);
                return (
                  <button
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: selected ? "rgba(139,92,246,0.12)" : "rgba(56,189,248,0.04)",
                      border: `1px solid ${selected ? "rgba(139,92,246,0.30)" : "rgba(56,189,248,0.10)"}`,
                      color: selected ? "#a78bfa" : "#475569",
                    }}
                  >
                    <Bot className="w-3 h-3" />
                    {agent.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rules */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold" style={{ color: "#94a3b8" }}>Rules ({rules.length})</label>
              <div className="relative group">
                <Button variant="outline" size="sm">
                  <Plus className="w-3 h-3" /> Add Rule
                </Button>
                <div
                  className="absolute right-0 top-full mt-1 z-10 w-56 rounded-lg overflow-hidden hidden group-hover:block"
                  style={{ background: "#0f1929", border: "1px solid rgba(34,211,238,0.18)" }}
                >
                  {RULE_TYPES.map((r) => (
                    <button
                      key={r.type}
                      onClick={() => addRule(r.type)}
                      className="w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{ color: "#94a3b8" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(34,211,238,0.06)"; e.currentTarget.style.color = "#22d3ee"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {rules.map((rule, idx) => {
                const def = RULE_TYPES.find((d) => d.type === rule.type);
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                    style={{ background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.10)" }}
                  >
                    <button
                      onClick={() => setRules((prev) => prev.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r))}
                      className="w-4 h-4 rounded flex-shrink-0"
                      style={{
                        background: rule.enabled ? "#22d3ee" : "rgba(56,189,248,0.08)",
                        border: "1px solid rgba(34,211,238,0.30)",
                      }}
                    />
                    <span className="text-xs font-medium w-40 flex-shrink-0" style={{ color: "#94a3b8" }}>{rule.label}</span>
                    <input
                      className="flex-1 bg-transparent outline-none text-xs"
                      style={{ color: "#f1f5f9", borderBottom: "1px solid rgba(56,189,248,0.20)" }}
                      placeholder={def?.placeholder}
                      value={rule.value}
                      onChange={(e) => setRules((prev) => prev.map((r, i) => i === idx ? { ...r, value: e.target.value } : r))}
                    />
                    <button onClick={() => removeRule(idx)} style={{ color: "#475569" }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {rules.length === 0 && (
                <p className="text-xs py-3 text-center" style={{ color: "#334155" }}>No rules added yet. Click Add Rule to begin.</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="primary" className="flex-1" loading={loading} onClick={save}>
              {isEdit ? "Save Changes" : "Create Policy"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [polRes, agentRes] = await Promise.all([
        apiGet<{ data: Policy[] }>("/api/policies?ownerId=usr_01"),
        apiGet<{ data: Agent[] }>("/api/agents?ownerId=usr_01"),
      ]);
      setPolicies(polRes.data);
      setAgents(agentRes.data);
    } catch (err: unknown) {
      toast({ type: "error", title: "Failed to load policies", message: String(err) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function toggleStatus(policy: Policy) {
    const newStatus: Policy["status"] = policy.status === "active" ? "inactive" : "active";
    try {
      await apiPatch("/api/policies", { id: policy.id, status: newStatus });
      toast({ type: "success", title: `Policy ${newStatus}`, message: policy.name });
      loadAll();
    } catch (err: unknown) {
      toast({ type: "error", title: "Update failed", message: String(err) });
    }
  }

  async function deletePolicy(policy: Policy) {
    if (!confirm(`Delete "${policy.name}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/policies?id=${policy.id}`, { method: "DELETE" });
      toast({ type: "warning", title: "Policy deleted", message: policy.name });
      loadAll();
    } catch (err: unknown) {
      toast({ type: "error", title: "Delete failed", message: String(err) });
    }
  }

  const active   = policies.filter((p) => p.status === "active").length;
  const inactive = policies.filter((p) => p.status === "inactive").length;
  const totalRules = policies.reduce((a, p) => a + p.rules.length, 0);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        title="Policy Management"
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> New Policy
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6 fade-up">
        {/* Notice */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-lg"
          style={{ background: "rgba(45,212,191,0.04)", border: "1px solid rgba(45,212,191,0.15)" }}
        >
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#2dd4bf" }} />
          <p className="text-xs leading-relaxed" style={{ color: "#5eead4" }}>
            <strong>Server-side enforcement active.</strong> These policies are enforced on every transaction via the policy engine.
            On-chain enforcement via <code className="bg-teal-950/50 px-1 rounded">PolicyGuardPaymaster</code> requires ERC-4337 deployment.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Policies", value: active,    color: "#22d3ee" },
            { label: "Inactive",        value: inactive,  color: "#fbbf24" },
            { label: "Total Rules",     value: totalRules,color: "#60a5fa" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="p-4">
              <p className="section-label">{label}</p>
              <p className="text-2xl font-bold mt-2" style={{ color }}>{value}</p>
            </Card>
          ))}
        </div>

        {/* Policy cards */}
        <SectionHeader
          title="Configured Policies"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={loadAll}>
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-16" style={{ color: "#475569" }}>
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading policies...
          </div>
        ) : policies.length === 0 ? (
          <Card>
            <CardBody className="py-16 text-center">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4" style={{ color: "#22d3ee", opacity: 0.4 }} />
              <p className="text-sm font-semibold text-white">No policies yet</p>
              <p className="text-xs mt-1" style={{ color: "#475569" }}>Create your first policy to start enforcing spending rules</p>
              <Button variant="primary" size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
                <Plus className="w-3 h-3" /> Create Policy
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {policies.map((policy) => {
              const assignedAgents = agents.filter((a) => policy.agentIds.includes(a.id));
              const activeRules = policy.rules.filter((r) => r.enabled).length;
              return (
                <Card key={policy.id} className={policy.status === "inactive" ? "opacity-60" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-white">{policy.name}</h3>
                          <Badge
                            className={policy.status === "active"
                              ? "badge-green"
                              : "badge-gray"
                            }
                            dot
                          >
                            {policy.status}
                          </Badge>
                          <SimulatedDataLabel />
                        </div>
                        <p className="text-xs mt-1" style={{ color: "#475569" }}>{policy.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => setEditPolicy(policy)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant={policy.status === "active" ? "danger" : "primary"}
                          size="sm"
                          onClick={() => toggleStatus(policy)}
                        >
                          {policy.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deletePolicy(policy)}>
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Rules */}
                      <div>
                        <p className="section-label mb-3">Rules ({activeRules}/{policy.rules.length} active)</p>
                        {policy.rules.length === 0 ? (
                          <p className="text-xs" style={{ color: "#334155" }}>No rules defined</p>
                        ) : (
                          policy.rules.map((rule) => <RuleRow key={rule.id} rule={rule} />)
                        )}
                      </div>

                      {/* Agents + Dates */}
                      <div className="space-y-4">
                        <div>
                          <p className="section-label mb-3">Assigned Agents ({assignedAgents.length})</p>
                          <div className="space-y-2">
                            {assignedAgents.length === 0 ? (
                              <p className="text-xs" style={{ color: "#334155" }}>No agents assigned</p>
                            ) : (
                              assignedAgents.map((agent) => (
                                <div
                                  key={agent.id}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                                  style={{ background: "rgba(56,189,248,0.04)" }}
                                >
                                  <Bot className="w-3.5 h-3.5" style={{ color: "#94a3b8" }} />
                                  <span className="text-xs font-medium text-white">{agent.name}</span>
                                  <Badge
                                    className={agent.status === "active" ? "badge-green" : "badge-gray"}
                                  >
                                    {agent.status}
                                  </Badge>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span style={{ color: "#475569" }}>Created</span>
                            <span style={{ color: "#94a3b8" }}>{formatDateTime(policy.createdAt)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: "#475569" }}>Updated</span>
                            <span style={{ color: "#94a3b8" }}>{formatDateTime(policy.updatedAt)}</span>
                          </div>
                          {policy.expiresAt && (
                            <div className="flex justify-between">
                              <span style={{ color: "#475569" }}>Expires</span>
                              <span className="text-amber-400">{formatDateTime(policy.expiresAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <PolicyModal
          agents={agents}
          onClose={() => setShowCreate(false)}
          onSaved={loadAll}
        />
      )}
      {editPolicy && (
        <PolicyModal
          policy={editPolicy}
          agents={agents}
          onClose={() => setEditPolicy(null)}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}
