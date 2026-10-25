"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  AlertBanner,
  LoadingState,
  EmptyState,
} from "@/components/ui/index";
import { apiGet } from "@/lib/api-client";
import { toast } from "@/components/ui/Toast";
import type { Policy } from "@/lib/types";
import { ListChecks, Info, CheckCircle2, XCircle } from "lucide-react";

export default function RecipientsPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ data: Policy[] }>("/api/policies")
      .then((r) => setPolicies(r.data ?? []))
      .catch(() => toast({ type: "error", title: "Failed to load policies" }))
      .finally(() => setLoading(false));
  }, []);

  // Extract allowed_recipients and allowed_contracts rules across all policies
  const recipientRules = policies.flatMap((p) =>
    p.rules
      .filter((r) => r.type === "allowed_recipients" || r.type === "allowed_contracts")
      .map((r) => ({ policy: p.name, rule: r }))
  );

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-base)" }}>
      <TopBar
        breadcrumb="Payment Security"
        title="Approved Recipients & Contracts"
        subtitle="Allowlisted addresses and smart contracts"
      />
      <div className="page-content space-y-6 fade-up">
        <AlertBanner variant="info" icon={Info}>
          Approved recipients and contracts are defined inside <strong>Policy Engine</strong> rules.
          Only addresses explicitly listed here will be permitted for agent transactions.
          Add or edit allowlists in the <strong>Policy Engine → allowed_recipients / allowed_contracts</strong> rule types.
        </AlertBanner>

        {loading ? (
          <LoadingState message="Loading policy rules…" />
        ) : recipientRules.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={ListChecks}
                title="No allowlist rules configured"
                description="Create a Policy with 'allowed_recipients' or 'allowed_contracts' rules to restrict agent transactions to approved addresses."
              />
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {recipientRules.map(({ policy, rule }) => {
              const addresses = Array.isArray(rule.value) ? rule.value : [String(rule.value)];
              return (
                <Card key={rule.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <ListChecks className="w-4 h-4 text-[#22d3ee]" />
                      <div>
                        <p className="text-sm font-semibold text-white">{rule.label}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Policy: {policy} ·{" "}
                          <Badge className={rule.enabled ? "badge-green" : "badge-gray"}>
                            {rule.enabled ? "Active" : "Disabled"}
                          </Badge>
                        </p>
                      </div>
                      <Badge className={rule.type === "allowed_recipients" ? "badge-cyan" : "badge-violet"}>
                        {rule.type === "allowed_recipients" ? "Recipients" : "Contracts"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-2">
                      {addresses.map((addr, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg"
                          style={{ background: "rgba(7,16,32,0.6)", border: "1px solid rgba(56,189,248,0.08)" }}
                        >
                          {rule.enabled ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                          )}
                          <code className="text-xs text-white font-mono">{addr}</code>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}

        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)" }}
        >
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
          <p className="text-xs leading-relaxed text-blue-400">
            <strong>On-chain enforcement:</strong> Recipient allowlists are validated at the
            smart-contract validation layer via the PolicyEnforcer contract. Any UserOperation
            targeting a non-allowlisted address will be rejected by the EntryPoint.
          </p>
        </div>
      </div>
    </div>
  );
}
